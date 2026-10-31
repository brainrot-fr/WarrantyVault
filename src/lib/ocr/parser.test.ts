import { describe, expect, it } from 'vitest';
import { parseReceiptText } from './parser';

describe('parseReceiptText', () => {
  it('parses labelled receipt values and a warranty duration', () => {
    const result = parseReceiptText([
      'ACME STORE',
      'Item: Smart Kettle 2000',
      'Merchant: Acme Home',
      'Purchase Date: 06/12/2024',
      'Total: $1,299.99',
      '2 year limited warranty',
    ].join('\n'));

    expect(result).toMatchObject({
      productName: 'Smart Kettle 2000',
      merchant: 'Acme Home',
      purchaseDate: '2024-06-12',
      purchasePrice: 1299.99,
      warrantyMonths: 24,
      ambiguousDate: true,
      confidence: {
        productName: 'high',
        merchant: 'high',
        purchaseDate: 'low',
        purchasePrice: 'high',
        warrantyMonths: 'high',
      },
    });
  });

  it('parses currency and locale-aware prices and handles missing values', () => {
    expect(parseReceiptText('Amount paid: EUR 1.234,50').purchasePrice).toBe(1234.5);
    expect(parseReceiptText('Grand total: USD 1,234.50').purchasePrice).toBe(1234.5);
    expect(parseReceiptText('Item: Desk\nWarranty: 1 year')).toMatchObject({
      productName: 'Desk',
      warrantyMonths: 12,
      purchasePrice: null,
    });
  });

  it('parses Indian price labels and currencies', () => {
    expect(parseReceiptText('MRP: Rs. 1,299')).toMatchObject({
      purchasePrice: 1299,
      currency: 'INR',
    });
    expect(parseReceiptText('Net amount ₹ 12,345.50')).toMatchObject({
      purchasePrice: 12345.5,
      currency: 'INR',
    });
    expect(parseReceiptText('Amount payable: Rs 599\nTotal value: 600')).toMatchObject({
      purchasePrice: 599,
      currency: 'INR',
    });
  });

  it('uses labelled dates before other dates and falls back to merchant text', () => {
    const result = parseReceiptText([
      'Fresh Store',
      'Invoice 31/12/2025',
      'Date: 02/01/2026',
    ].join('\n'));
    expect(result.purchaseDate).toBe('2026-01-02');
    expect(result.merchant).toBe('Fresh Store');
  });

  it('parses day-first bill dates and product descriptions with merchant heuristics', () => {
    const result = parseReceiptText([
      'Bill of Supply',
      'Billed From',
      '',
      'Example Appliances Private Limited',
      'GSTIN: 00AAAAA0000A0AA',
      'of Supply Date : 25-09-2025',
      'Description of Gty Gross Weight of Value of goods',
      'Goods Consignment',
      'Godrej 244 L Frost Free Fridge 10 500000 grams, 216660',
      'Double Door 4 Star Convertible Refrigerator',
      'With 6-in-1 Convertible Freezer',
      'Food Surface Disinfection (1)',
    ].join('\n'));

    expect(result).toMatchObject({
      purchaseDate: '2025-09-25',
      merchant: 'Example Appliances Private Limited',
      productName: 'Godrej 244 L Frost Free Fridge Double Door 4 Star Convertible Refrigerator With 6-in-1 Convertible Freezer Food Surface Disinfection',
      brand: 'Godrej',
      ambiguousDate: false,
    });
  });

  it('supports month durations, short years, and flags ambiguous date candidates', () => {
    expect(parseReceiptText('Warranty: 6 months').warrantyMonths).toBe(6);
    expect(parseReceiptText('Warranty: 2 yrs').warrantyMonths).toBe(24);
    expect(parseReceiptText('Date: 25/09/25').purchaseDate).toBe('2025-09-25');
    expect(parseReceiptText('Date: 04/05/2025')).toMatchObject({
      purchaseDate: '2025-04-05',
      ambiguousDate: true,
    });
  });

  it('returns empty fields and none confidence for unusable text', () => {
    expect(parseReceiptText(null)).toMatchObject({
      productName: null,
      brand: null,
      category: null,
      merchant: null,
      purchaseDate: null,
      purchasePrice: null,
      currency: null,
      warrantyMonths: null,
      ambiguousDate: false,
      confidence: {
        productName: 'none',
        brand: 'none',
        category: 'none',
        merchant: 'none',
        purchaseDate: 'none',
        purchasePrice: 'none',
        warrantyMonths: 'none',
      },
    });
  });
});
