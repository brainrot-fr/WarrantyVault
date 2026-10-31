import { isValid, parseISO, format } from 'date-fns';
import { z } from 'zod';
import { copy } from '@/lib/copy';

function isDateOnly(value: string) {
  const date = parseISO(value);
  return isValid(date) && format(date, 'yyyy-MM-dd') === value;
}

const optionalPrice = z.string().trim()
  .refine((value) => value === '' || /^\d{1,10}(?:\.\d{1,2})?$/.test(value), copy.purchasePriceInvalid)
  .transform((value) => value === '' ? null : Number(value));

const optionalWarranty = z.string().trim()
  .refine((value) => value === '' || /^\d{1,4}$/.test(value), copy.warrantyMonthsInvalid)
  .refine((value) => value === '' || Number(value) <= 1200, copy.warrantyMonthsInvalid)
  .transform((value) => value === '' ? null : Number(value));

export const itemFormSchema = z.object({
  name: z.string().trim().min(1, copy.itemNameRequired).max(240, copy.itemNameTooLong),
  brand: z.string().trim().max(200, copy.itemBrandTooLong).transform((value) => value || null),
  category: z.string().trim().max(120, copy.itemCategoryTooLong).transform((value) => value || null),
  merchant: z.string().trim().max(240, copy.itemMerchantTooLong).transform((value) => value || null),
  serial_number: z.string().trim().max(120, copy.itemSerialTooLong).transform((value) => value || null),
  purchase_date: z.string().refine((value) => value === '' || isDateOnly(value), copy.purchaseDateInvalid)
    .transform((value) => value || null),
  purchase_price: optionalPrice,
  currency: z.string().trim().toUpperCase()
    .refine((value) => value === '' || /^[A-Z]{3}$/.test(value), copy.currencyInvalid)
    .transform((value) => value || null),
  warranty_months: optionalWarranty,
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
  currency: '',
  warranty_months: '',
  household_id: '',
  notes: '',
};
