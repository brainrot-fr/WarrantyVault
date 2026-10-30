import { copy } from '@/lib/copy';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReceiptFormat = 'pdf' | 'jpg' | 'png';

export interface ValidatedReceipt {
  file: File;
  format: ReceiptFormat;
  filename: string;
  bytes: number;
}

const formatExtensions: Record<ReceiptFormat, string> = {
  pdf: '.pdf',
  jpg: '.jpg',
  png: '.png',
};

function detectReceiptFormat(bytes: Uint8Array): ReceiptFormat | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }

  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'jpg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  return null;
}

function sanitizeFilename(filename: string, format: ReceiptFormat) {
  const basename = filename.split(/[\\/]/).at(-1) ?? '';
  const stem = basename.replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 120);
  return `${stem || 'receipt'}${formatExtensions[format]}`;
}

export async function validateReceiptFile(file: File): Promise<ValidatedReceipt> {
  if (file.size === 0) {
    throw new Error(copy.receiptFileEmpty);
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error(copy.receiptFileTooLarge);
  }

  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const format = detectReceiptFormat(bytes);
  if (!format) {
    throw new Error(copy.receiptFileUnsupported);
  }

  return {
    file,
    format,
    filename: sanitizeFilename(file.name, format),
    bytes: file.size,
  };
}
