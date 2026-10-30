import type { ParsedReceipt } from '@/lib/ocr/parser';
import type { ValidatedReceipt } from '@/features/receipts/receipt-validation';
import { emptyItemFormValues, type ItemFormInput } from './item-schemas';

export type AddItemStep = 'capture' | 'review' | 'coverage';

export interface ItemDraft {
  values: ItemFormInput;
  receipt: ValidatedReceipt | null;
  parsedReceipt: ParsedReceipt | null;
  step: AddItemStep;
}

export function createEmptyItemDraft(): ItemDraft {
  return {
    values: { ...emptyItemFormValues },
    receipt: null,
    parsedReceipt: null,
    step: 'capture',
  };
}
