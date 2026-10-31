import { isValid, parseISO, format } from 'date-fns';
import { z } from 'zod';
import { copy } from '@/lib/copy';

function isDateOnly(value: string) {
  const date = parseISO(value);
  return isValid(date) && format(date, 'yyyy-MM-dd') === value;
}

const requiredPrice = z.string().trim()
  .refine((value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value), copy.purchasePriceRequired)
  .transform(Number);

const requiredWarranty = z.string().trim()
  .refine((value) => /^\d{1,4}$/.test(value), copy.warrantyMonthsRequired)
  .refine((value) => Number(value) <= 1200, copy.warrantyMonthsRequired)
  .transform(Number);

export const itemBrands = [
  'Apple',
  'Samsung',
  'Sony',
  'LG',
  'Whirlpool',
  'Bosch',
  'Philips',
  'HP',
  'Lenovo',
  'Dell',
  'Xiaomi',
  'OnePlus',
  'Panasonic',
  'Other',
] as const;

export const itemFormSchema = z.object({
  name: z.string().trim().min(1, copy.itemNameRequired).max(240, copy.itemNameTooLong),
  brand: z.string().trim().min(1, copy.itemBrandRequired).max(200, copy.itemBrandTooLong),
  category: z.string().trim().max(120, copy.itemCategoryTooLong).transform((value) => value || null),
  merchant: z.string().trim().max(240, copy.itemMerchantTooLong).transform((value) => value || null),
  serial_number: z.string().trim().max(120, copy.itemSerialTooLong).transform((value) => value || null),
  purchase_date: z.string().min(1, copy.purchaseDateRequired)
    .refine(isDateOnly, copy.purchaseDateRequired),
  purchase_price: requiredPrice,
  warranty_months: requiredWarranty,
  household_id: z.union([z.string().uuid(copy.itemHouseholdRequired), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  notes: z.string().max(5000, copy.itemNotesTooLong),
});

export type ItemFormInput = z.input<typeof itemFormSchema>;
export type ItemFormOutput = z.output<typeof itemFormSchema>;
export const itemEditSchema = itemFormSchema.omit({ household_id: true });
export type ItemEditInput = z.input<typeof itemEditSchema>;
export type ItemEditOutput = z.output<typeof itemEditSchema>;

export const emptyItemFormValues: ItemFormInput = {
  name: '',
  brand: '',
  category: '',
  merchant: '',
  serial_number: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  purchase_price: '',
  warranty_months: '',
  household_id: '',
  notes: '',
};
