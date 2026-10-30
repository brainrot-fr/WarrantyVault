import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  claimPackFilename,
  createClaimPack,
  type ClaimPackItem,
} from './claim-pack';

const item: ClaimPackItem = {
  id: 'a7ee3ca0-70bc-4ac7-a625-b97607b79e16',
  name: 'Coffee machine',
  brand: 'Morrow',
  category: 'Kitchen',
  merchant: 'Home Market',
  serial_number: 'CM-2048',
  purchase_date: '2024-02-29',
  purchase_price: 249.5,
  currency: 'USD',
  warranty_months: 12,
  expiry_date: '2025-02-28',
  receipt_public_id: null,
  receipt_format: null,
};

function bytesFromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

describe('claim pack generation', () => {
  it('creates a facts page and keeps receipt optional', async () => {
    const bytes = await createClaimPack(item);
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBe(1);
    expect(result.getTitle()).toContain(item.name);
  });

  it('appends every page from the receipt PDF', async () => {
    const receipt = await PDFDocument.create();
    receipt.addPage([200, 300]);
    receipt.addPage([200, 300]);

    const bytes = await createClaimPack(
      { ...item, receipt_public_id: 'warrantyvault/home/receipt', receipt_format: 'pdf' },
      await receipt.save(),
    );
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBe(3);
  });

  it('embeds a PNG receipt on its own page', async () => {
    const png = bytesFromBase64(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    );
    const bytes = await createClaimPack(
      { ...item, receipt_public_id: 'warrantyvault/home/receipt', receipt_format: 'png' },
      png,
    );
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBe(2);
  });

  it('embeds a JPEG receipt on its own page', async () => {
    const jpg = bytesFromBase64(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8Af3//2Q==',
    );
    const bytes = await createClaimPack(
      { ...item, receipt_public_id: 'warrantyvault/home/receipt', receipt_format: 'jpg' },
      jpg,
    );
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBe(2);
  });

  it('sanitizes the claim-pack download filename', () => {
    expect(claimPackFilename('../Coffee machine / 2')).toBe('Coffee_machine_2-claim-pack.pdf');
    expect(claimPackFilename('...')).toBe('warranty-claim-pack.pdf');
  });
});
