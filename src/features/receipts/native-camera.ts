import { Camera, type MediaResult } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { copy } from '@/lib/copy';

function isPhotoResult(value: unknown): value is MediaResult {
  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'Photo') {
    return false;
  }
  if (!('metadata' in value) || !value.metadata || typeof value.metadata !== 'object') {
    return false;
  }
  return 'format' in value.metadata && typeof value.metadata.format === 'string';
}

export async function receiptPhotoToFile(value: unknown) {
  if (!isPhotoResult(value)) {
    throw new Error(copy.nativeCameraFormatError);
  }

  const photo = value;
  const format = photo.metadata?.format.toLowerCase();
  const extension = format === 'png' ? 'png' : format === 'jpg' || format === 'jpeg' ? 'jpg' : null;
  if (!extension) throw new Error(copy.nativeCameraFormatError);

  let blob: Blob;
  if (photo.uri) {
    const result = await Filesystem.readFile({ path: photo.uri });
    if (typeof result.data !== 'string') {
      throw new Error(copy.nativeCameraReadError);
    }
    const binary = atob(result.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    blob = new Blob([bytes], { type: `image/${extension === 'jpg' ? 'jpeg' : extension}` });
  } else if (photo.webPath) {
    const response = await fetch(photo.webPath);
    if (!response.ok) throw new Error(copy.nativeCameraReadError);
    blob = await response.blob();
  } else {
    throw new Error(copy.nativeCameraReadError);
  }

  return new File([blob], `camera-receipt.${extension}`, { type: blob.type });
}

export async function captureReceiptPhoto() {
  const photo = await Camera.takePhoto({
    quality: 90,
    includeMetadata: true,
    correctOrientation: true,
  });
  return receiptPhotoToFile(photo);
}
