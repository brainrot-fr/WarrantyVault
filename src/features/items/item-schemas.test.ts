import { describe, expect, it } from 'vitest';
import { itemFormSchema } from './item-schemas';

const validItem = {
  name: 'Coffee machine',
  brand: '',
  category: '',
  merchant: '',
  serial_number: '',
  purchase_date: '',
  purchase_price: '',
  currency: '',
  warranty_months: '12',
  household_id: 'a0000000-0000-4000-8000-000000000001',
  notes: '',
};

describe('item form schema', () => {
  it('normalizes empty optional fields and validates required household and name', () => {
    expect(itemFormSchema.parse(validItem)).toMatchObject({
      name: 'Coffee machine',
      brand: null,
      purchase_date: null,
      purchase_price: null,
      currency: null,
      warranty_months: 12,
    });
    expect(itemFormSchema.safeParse({ ...validItem, name: '  ' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...validItem, household_id: '' }).success).toBe(false);
  });

  it('validates purchase prices, calendar dates, and non-negative warranty months', () => {
    expect(itemFormSchema.safeParse({ ...validItem, purchase_price: '-1' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...validItem, purchase_price: '12.345' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...validItem, purchase_date: '2025-02-29' }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...validItem, warranty_months: '-1' }).success).toBe(false);
  });
});
