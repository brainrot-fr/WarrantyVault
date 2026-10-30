import { supabase } from '@/lib/supabase/client';
import { copy } from '@/lib/copy';
import { MAX_RECEIPT_BYTES, type ValidatedReceipt } from './receipt-validation';

interface CloudinarySignature {
  api_key: string;
  cloud_name: string;
  parameters: Record<string, string>;
  signature: string;
  upload_url: string;
}

export interface ReceiptMetadata {
  receipt_public_id: string;
  receipt_resource_type: string;
  receipt_format: string;
  receipt_bytes: number;
  receipt_filename: string;
}

export interface TemporaryReceiptUrl {
  url: string;
  expires_at: string;
  disposition: 'attachment';
}

function isCloudinarySignature(value: unknown, householdId: string): value is CloudinarySignature {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  if (
    typeof result.api_key !== 'string' ||
    typeof result.cloud_name !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(result.cloud_name) ||
    typeof result.signature !== 'string' ||
    typeof result.upload_url !== 'string' ||
    typeof result.parameters !== 'object' ||
    result.parameters === null ||
    !Object.values(result.parameters).every((parameter) => typeof parameter === 'string')
  ) {
    return false;
  }
  const parameters = result.parameters as Record<string, string>;
  let uploadUrl: URL;
  try {
    uploadUrl = new URL(result.upload_url);
  } catch {
    return false;
  }
  const folder = `warrantyvault/${householdId}`;
  return uploadUrl.origin === 'https://api.cloudinary.com' &&
    uploadUrl.pathname === `/v1_1/${result.cloud_name}/image/upload` &&
    uploadUrl.search === '' &&
    parameters.folder === folder &&
    parameters.asset_folder === folder &&
    parameters.public_id_prefix === folder &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(parameters.public_id ?? '') &&
    parameters.type === 'authenticated' &&
    parameters.allowed_formats === 'jpg,png,pdf' &&
    parameters.overwrite === 'false';
}

export async function uploadReceipt(
  householdId: string,
  receipt: ValidatedReceipt,
): Promise<ReceiptMetadata> {
  const { data, error } = await supabase.functions.invoke<unknown>('cloudinary-sign', {
    body: { household_id: householdId },
  });
  if (error) throw new Error(copy.receiptUploadPrepareError);
  if (!isCloudinarySignature(data, householdId)) {
    throw new Error(copy.receiptUploadSignatureInvalid);
  }

  const form = new FormData();
  form.set('file', receipt.file, receipt.filename);
  form.set('api_key', data.api_key);
  form.set('signature', data.signature);
  for (const [key, value] of Object.entries(data.parameters)) form.set(key, value);

  let response: Response;
  try {
    response = await fetch(data.upload_url, { method: 'POST', body: form });
  } catch {
    throw new Error(copy.receiptUploadConnectionError);
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(copy.receiptUploadRejected);
  }
  if (
    typeof result !== 'object' ||
    result === null ||
    !('public_id' in result) ||
    typeof result.public_id !== 'string' ||
    !('resource_type' in result) ||
    typeof result.resource_type !== 'string' ||
    !('format' in result) ||
    typeof result.format !== 'string' ||
    !('bytes' in result) ||
    typeof result.bytes !== 'number' ||
    !('public_id_prefix' in data.parameters) ||
    result.public_id !== `${data.parameters.public_id_prefix}/${data.parameters.public_id}` ||
    result.resource_type !== 'image' ||
    result.format !== receipt.format ||
    result.bytes !== receipt.bytes ||
    result.bytes > MAX_RECEIPT_BYTES
  ) {
    throw new Error(copy.receiptUploadIncomplete);
  }

  return {
    receipt_public_id: result.public_id,
    receipt_resource_type: result.resource_type,
    receipt_format: result.format,
    receipt_bytes: result.bytes,
    receipt_filename: receipt.filename,
  };
}

export async function getTemporaryReceiptUrl(itemId: string): Promise<TemporaryReceiptUrl> {
  const { data, error } = await supabase.functions.invoke<unknown>('cloudinary-url', {
    body: { item_id: itemId },
  });
  if (error) throw new Error(copy.receiptOpenError);
  if (
    typeof data !== 'object' ||
    data === null ||
    !('url' in data) ||
    typeof data.url !== 'string' ||
    !('expires_at' in data) ||
    typeof data.expires_at !== 'string' ||
    !('disposition' in data) ||
    data.disposition !== 'attachment'
  ) {
    throw new Error(copy.receiptUrlInvalid);
  }
  return {
    url: data.url,
    expires_at: data.expires_at,
    disposition: 'attachment',
  };
}

export async function deleteReceipt(publicId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('receipt-delete', {
    body: { public_id: publicId, resource_type: 'image' },
  });
  if (error) throw new Error(copy.receiptDeleteError);
}
