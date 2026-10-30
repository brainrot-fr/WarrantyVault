import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import schibstedFontData from '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2?inline';
import monoFontData from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?inline';
import type { Database } from '@/lib/supabase/types';
import { copy } from '@/lib/copy';
import { formatDateOnly } from '@/lib/dates/warranty';
import { formatMoney } from '@/lib/format/money';
import { getTemporaryReceiptUrl } from '@/features/receipts/receipt-storage';

type ItemRow = Database['public']['Tables']['items']['Row'];

export type ClaimPackItem = Pick<
  ItemRow,
  | 'id'
  | 'name'
  | 'brand'
  | 'category'
  | 'merchant'
  | 'serial_number'
  | 'purchase_date'
  | 'purchase_price'
  | 'currency'
  | 'warranty_months'
  | 'expiry_date'
  | 'receipt_public_id'
  | 'receipt_format'
>;

const pageWidth = 595.28;
const pageHeight = 841.89;
const pageMargin = 48;
const paper = rgb(0.984, 0.984, 0.973);
const ink = rgb(0.082, 0.102, 0.129);
const mutedInk = rgb(0.282, 0.318, 0.357);
const rule = rgb(0.78, 0.80, 0.78);
const accent = rgb(0.141, 0.278, 0.769);

function decodeInlineFont(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error(copy.claimPackFontError);
  const binary = atob(dataUrl.slice(comma + 1));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function wrappedText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);

    let fragment = '';
    for (const character of word) {
      const candidateFragment = fragment + character;
      if (fragment && font.widthOfTextAtSize(candidateFragment, size) > maxWidth) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment = candidateFragment;
      }
    }
    current = fragment;
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  color = ink,
  lineHeight = size * 1.4,
) {
  const lines = wrappedText(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
  return lines.length * lineHeight;
}

function drawFact(
  page: PDFPage,
  label: string,
  value: string,
  font: PDFFont,
  valueFont: PDFFont,
  y: number,
) {
  page.drawText(label, {
    x: pageMargin,
    y,
    size: 10,
    font,
    color: mutedInk,
  });
  const height = drawWrappedText(
    page,
    value,
    valueFont,
    12,
    190,
    y,
    pageWidth - 190 - pageMargin,
  );
  const rowHeight = Math.max(28, height + 12);
  page.drawRectangle({
    x: pageMargin,
    y: y - rowHeight + 8,
    width: pageWidth - pageMargin * 2,
    height: 0.6,
    color: rule,
  });
  return y - rowHeight;
}

function addFactsPage(
  document: PDFDocument,
  item: ClaimPackItem,
  headingFont: PDFFont,
  monoFont: PDFFont,
) {
  const page = document.addPage([pageWidth, pageHeight]);
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });

  page.drawText(copy.claimPackTitle, {
    x: pageMargin,
    y: pageHeight - 54,
    size: 11,
    font: headingFont,
    color: accent,
  });
  const titleY = pageHeight - 92;
  const titleHeight = drawWrappedText(
    page,
    item.name,
    headingFont,
    25,
    pageMargin,
    titleY,
    pageWidth - pageMargin * 2,
    ink,
    30,
  );
  let y = titleY - titleHeight - 8;
  page.drawText(copy.claimPackReference(item.id), {
    x: pageMargin,
    y,
    size: 10,
    font: monoFont,
    color: mutedInk,
  });
  y -= 42;
  page.drawRectangle({
    x: pageMargin,
    y,
    width: 42,
    height: 3,
    color: accent,
  });
  y -= 28;

  const facts: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: copy.itemName, value: item.name },
    { label: copy.itemBrand, value: item.brand?.trim() || copy.notRecorded },
    { label: copy.itemCategory, value: item.category?.trim() || copy.notRecorded },
    { label: copy.itemMerchant, value: item.merchant?.trim() || copy.notRecorded },
    { label: copy.itemSerialNumber, value: item.serial_number?.trim() || copy.notRecorded, mono: true },
    { label: copy.itemPurchaseDate, value: formatDateOnly(item.purchase_date) ?? copy.notRecorded, mono: true },
    { label: copy.itemPurchasePrice, value: formatMoney(item.purchase_price, item.currency), mono: true },
    {
      label: copy.itemWarrantyLength,
      value: item.warranty_months === null ? copy.notRecorded : copy.warrantyMonthsValue(item.warranty_months),
    },
    { label: copy.expiresOn, value: formatDateOnly(item.expiry_date) ?? copy.noExpiryDate, mono: true },
  ];

  for (const fact of facts) {
    y = drawFact(page, fact.label, fact.value, headingFont, fact.mono ? monoFont : headingFont, y);
  }
  return page;
}

async function addReceiptPages(
  document: PDFDocument,
  item: ClaimPackItem,
  receiptBytes: Uint8Array,
) {
  if (item.receipt_format === 'pdf') {
    const receipt = await PDFDocument.load(receiptBytes);
    const pages = await document.copyPages(receipt, receipt.getPageIndices());
    if (pages.length === 0) throw new Error(copy.claimPackReceiptEmpty);
    for (const page of pages) document.addPage(page);
    return;
  }

  if (item.receipt_format === 'jpg') {
    const image = await document.embedJpg(receiptBytes);
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
    const maxWidth = pageWidth - pageMargin * 2;
    const maxHeight = pageHeight - pageMargin * 2;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
    return;
  }

  if (item.receipt_format === 'png') {
    const image = await document.embedPng(receiptBytes);
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
    const maxWidth = pageWidth - pageMargin * 2;
    const maxHeight = pageHeight - pageMargin * 2;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
    return;
  }

  throw new Error(copy.claimPackReceiptFormatUnsupported);
}

export async function createClaimPack(item: ClaimPackItem, receiptBytes?: Uint8Array) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const headingFont = await document.embedFont(decodeInlineFont(schibstedFontData), { subset: false });
  const monoFont = await document.embedFont(decodeInlineFont(monoFontData), { subset: false });
  document.setTitle(`${copy.claimPackTitle} - ${item.name}`);
  document.setAuthor(copy.appName);
  document.setCreator(copy.appName);

  addFactsPage(document, item, headingFont, monoFont);
  if (receiptBytes) await addReceiptPages(document, item, receiptBytes);
  return document.save();
}

export async function fetchClaimPackReceipt(itemId: string) {
  try {
    const temporary = await getTemporaryReceiptUrl(itemId);
    const response = await fetch(temporary.url, { mode: 'cors' });
    if (!response.ok) throw new Error(copy.claimPackReceiptFetchError);
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw new Error(copy.claimPackReceiptFetchError, { cause: error });
  }
}

export function claimPackFilename(itemName: string) {
  const safeName = itemName.trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100);
  return `${safeName || 'warranty'}-claim-pack.pdf`;
}

export function downloadClaimPack(item: ClaimPackItem, bytes: Uint8Array) {
  const blobBytes = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobBytes).set(bytes);
  const blob = new Blob([blobBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = claimPackFilename(item.name);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function exportClaimPack(item: ClaimPackItem, bytes: Uint8Array) {
  if (!Capacitor.isNativePlatform()) {
    downloadClaimPack(item, bytes);
    return 'downloaded' as const;
  }

  const { uri } = await Filesystem.writeFile({
    path: claimPackFilename(item.name),
    directory: Directory.Cache,
    data: bytesToBase64(bytes),
  });
  await Share.share({
    title: copy.claimPackTitle,
    text: item.name,
    files: [uri],
    dialogTitle: copy.claimPackDownload,
  });
  return 'shared' as const;
}
