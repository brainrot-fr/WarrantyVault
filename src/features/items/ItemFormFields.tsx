import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { copy } from '@/lib/copy';
import type { FieldConfidence } from '@/lib/ocr/parser';
import type { ItemFormInput, ItemFormOutput } from './item-schemas';

type FieldGroup = 'review' | 'coverage' | 'all';
type TextFieldName =
  | 'name'
  | 'brand'
  | 'category'
  | 'merchant'
  | 'serial_number'
  | 'purchase_price'
  | 'currency'
  | 'warranty_months';

interface ItemFormFieldsProps {
  register: UseFormRegister<ItemFormInput>;
  control: Control<ItemFormInput, unknown, ItemFormOutput>;
  errors: FieldErrors<ItemFormInput>;
  households: Array<{ id: string; name: string }>;
  group: FieldGroup;
  includeHousehold?: boolean;
  confidence?: Partial<Record<TextFieldName, FieldConfidence>>;
  ambiguousDate?: boolean;
}

const textFields: Array<{ name: TextFieldName; label: string; type?: string; placeholder?: string }> = [
  { name: 'name', label: copy.itemName, placeholder: copy.inputPlaceholder },
  { name: 'brand', label: copy.itemBrand },
  { name: 'category', label: copy.itemCategory },
  { name: 'merchant', label: copy.itemMerchant },
  { name: 'serial_number', label: copy.itemSerialNumber },
  { name: 'purchase_price', label: copy.itemPurchasePrice, type: 'number' },
  { name: 'currency', label: copy.itemCurrency, placeholder: copy.currencyExample },
  { name: 'warranty_months', label: copy.itemWarrantyLength, type: 'number', placeholder: copy.monthsExample },
];

const groupFields: Record<Exclude<FieldGroup, 'all'>, TextFieldName[]> = {
  review: ['name', 'brand', 'category', 'merchant', 'serial_number', 'purchase_price', 'currency'],
  coverage: ['warranty_months'],
};

function isInGroup(name: TextFieldName, group: FieldGroup) {
  return group === 'all' || groupFields[group].includes(name);
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p className="form-field-error" id={id}>{message}</p>;
}

export function ItemFormFields({
  register,
  control,
  errors,
  households,
  group,
  includeHousehold = true,
  confidence,
  ambiguousDate = false,
}: ItemFormFieldsProps) {
  const showDate = group !== 'review';
  const showHousehold = group !== 'review' && includeHousehold;
  const showNotes = group !== 'review';

  return (
    <div className="item-form-grid">
      {textFields.filter((field) => isInGroup(field.name, group)).map((field) => {
        const id = `item-${field.name}`;
        const errorId = `${id}-error`;
        const error = errors[field.name]?.message;
        const input = (
          <Input
            id={id}
            type={field.type ?? 'text'}
            placeholder={field.placeholder}
            aria-required={field.name === 'name'}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            min={field.name === 'purchase_price' || field.name === 'warranty_months' ? 0 : undefined}
            step={field.name === 'purchase_price' ? '0.01' : field.name === 'warranty_months' ? '1' : undefined}
            {...register(field.name)}
          />
        );
        return (
          <div className="item-form-field" key={field.name}>
            <label htmlFor={id}>{field.label}{field.name === 'name' ? ' *' : ''}</label>
            {input}
            {confidence?.[field.name] && (
              <Badge variant="outline" className={`item-confidence item-confidence-${confidence[field.name]}`}>
                {confidence[field.name] === 'high'
                  ? copy.receiptConfidenceHigh
                  : confidence[field.name] === 'medium'
                    ? copy.receiptConfidenceMedium
                    : confidence[field.name] === 'low'
                      ? copy.receiptConfidenceLow
                      : copy.receiptConfidenceNone}
              </Badge>
            )}
            <FieldError id={errorId} message={typeof error === 'string' ? error : undefined} />
          </div>
        );
      })}

      {showDate && (
        <Controller
          control={control}
          name="purchase_date"
          render={({ field }) => {
            const id = 'item-purchase-date';
            const errorId = `${id}-error`;
            const error = errors.purchase_date?.message;
            return (
              <div className="item-form-field">
                <label className="item-form-label" htmlFor={id}>{copy.itemPurchaseDate}</label>
                <Input
                  id={id}
                  type="date"
                  max={new Date().toLocaleDateString('en-CA')}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
                {ambiguousDate && <p className="item-ambiguous-date">{copy.ambiguousReceiptDate}</p>}
                <FieldError id={errorId} message={typeof error === 'string' ? error : undefined} />
              </div>
            );
          }}
        />
      )}

      {showHousehold && (
        <Controller
          control={control}
          name="household_id"
          render={({ field }) => {
            const id = 'item-household';
            const errorId = `${id}-error`;
            const error = errors.household_id?.message;
            return (
              <div className="item-form-field">
                <label htmlFor={id}>{copy.itemHousehold} *</label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={id}
                    aria-required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                  >
                    <SelectValue placeholder={copy.itemHousehold} />
                  </SelectTrigger>
                  <SelectContent>
                    {households.map((household) => (
                      <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id={errorId} message={typeof error === 'string' ? error : undefined} />
              </div>
            );
          }}
        />
      )}

      {showNotes && (
        <div className="item-form-field item-form-field-wide">
          <label htmlFor="item-notes">{copy.itemNotes}</label>
          <Textarea
            id="item-notes"
            placeholder={copy.notesPlaceholder}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'item-notes-error' : undefined}
            {...register('notes')}
          />
          <FieldError
            id="item-notes-error"
            message={typeof errors.notes?.message === 'string' ? errors.notes.message : undefined}
          />
        </div>
      )}
    </div>
  );
}
