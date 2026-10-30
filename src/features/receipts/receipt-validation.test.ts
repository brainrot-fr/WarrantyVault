import { describe, expect, it } from 'vitest';
import { MAX_RECEIPT_BYTES, validateReceiptFile } from './receipt-validation';

function fileWithBytes(name: string, bytes: number[], size?: number) {
  const blob = new Blob([new Uint8Array(bytes)]);
  const file = new File([blob], name);
  if (size === undefined || size === file.size) return file;
  return new File([new Uint8Array(size)], name);
}

describe('receipt file validation', () => {
  it.each([
    ['scan.pdf', [0x25, 0x50, 0x44, 0x46], 'pdf', 'scan.pdf'],
    ['scan.jpeg', [0xff, 0xd8, 0xff, 0xe0], 'jpg', 'scan.jpg'],
    ['scan.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'png', 'scan.png'],
  ] as const)('accepts %s based on its file signature', async (name, signature, format, filename) => {
    const result = await validateReceiptFile(fileWithBytes(name, [...signature, 0]));
    expect(result.format).toBe(format);
    expect(result.filename).toBe(filename);
  });

  it('does not trust an extension or MIME type', async () => {
    const file = new File([new Uint8Array([0x00, 0x01, 0x02])], 'receipt.pdf', {
      type: 'application/pdf',
    });
    await expect(validateReceiptFile(file)).rejects.toThrow('file contents');
  });

  it('sanitizes the filename and enforces the 5 MB limit', async () => {
    const file = fileWithBytes('../récéipt?.jpg', [0xff, 0xd8, 0xff]);
    await expect(validateReceiptFile(file)).resolves.toMatchObject({
      filename: 'r_c_ipt_.jpg',
    });
    await expect(
      validateReceiptFile(fileWithBytes('large.png', [0x89, 0x50, 0x4e, 0x47], MAX_RECEIPT_BYTES + 1)),
    ).rejects.toThrow('5 MB or smaller');
  });

  it('rejects empty files', async () => {
    await expect(validateReceiptFile(new File([], 'empty.pdf'))).rejects.toThrow('empty');
  });
});
