import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Camera, FileText, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copy } from '@/lib/copy';
import { captureReceiptPhoto, receiptPhotoToFile } from '@/features/receipts/native-camera';
import { calculateWarrantyExpiry, formatDateOnly } from '@/lib/dates/warranty';
import { parseReceiptText } from '@/lib/ocr/parser';
import { recognizeReceipt } from '@/lib/ocr/receipt-ocr';
import { deleteReceipt, uploadReceipt } from '@/features/receipts/receipt-storage';
import { validateReceiptFile } from '@/features/receipts/receipt-validation';
import type { AppShellContext } from '@/app/AppShell';
import { supabase } from '@/lib/supabase/client';
import { ItemFormFields } from './ItemFormFields';
import { createEmptyItemDraft } from './item-draft';
import { errorMessage } from '@/lib/errors';
import { emptyItemFormValues, itemFormSchema, type ItemFormInput, type ItemFormOutput } from './item-schemas';

const reviewFields = [
  'name',
  'brand',
  'category',
  'merchant',
  'serial_number',
  'purchase_price',
  'currency',
] as const;
function stepLabel(step: 'capture' | 'review' | 'coverage') {
  if (step === 'capture') return copy.stepCapture;
  if (step === 'review') return copy.stepReview;
  return copy.stepCoverage;
}

export function AddItemPage() {
  const { activeHouseholdId, households, itemDraft, updateItemDraft } =
    useOutletContext<AppShellContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftValuesRef = useRef(itemDraft.values);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const form = useForm<ItemFormInput, unknown, ItemFormOutput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: itemDraft.values,
    mode: 'onBlur',
  });
  const { control, formState: { errors }, getValues, handleSubmit, register, setValue, subscribe, trigger } = form;
  const purchaseDate = useWatch({ control, name: 'purchase_date' });
  const warrantyMonths = useWatch({ control, name: 'warranty_months' });
  const expiryPreview = calculateWarrantyExpiry(
    purchaseDate || null,
    warrantyMonths === '' ? null : Number(warrantyMonths),
  );

  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        draftValuesRef.current = { ...draftValuesRef.current, ...values };
        updateItemDraft({
          values: { ...emptyItemFormValues, ...draftValuesRef.current },
        });
      },
    });
    return unsubscribe;
  }, [subscribe, updateItemDraft]);

  useEffect(() => {
    if (
      !getValues('household_id') &&
      activeHouseholdId !== 'all' &&
      households.some((household) => household.id === activeHouseholdId)
    ) {
      setValue('household_id', activeHouseholdId, { shouldDirty: false });
    }
  }, [activeHouseholdId, getValues, households, setValue]);

  const selectReceipt = useCallback(async (file: File) => {
    let receipt;
    try {
      receipt = await validateReceiptFile(file);
    } catch (error) {
      toast.error(errorMessage(error) || copy.receiptFileUnsupported);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    updateItemDraft({ receipt, parsedReceipt: null });
    setIsReading(true);
    setProgress(0);
    try {
      const result = await recognizeReceipt(receipt, ({ percent }) => setProgress(percent));
      const parsed = parseReceiptText(result.text);
      updateItemDraft({ parsedReceipt: parsed });
      if (parsed.productName) setValue('name', parsed.productName, { shouldDirty: true });
      if (parsed.brand) setValue('brand', parsed.brand, { shouldDirty: true });
      if (parsed.category) setValue('category', parsed.category, { shouldDirty: true });
      if (parsed.merchant) setValue('merchant', parsed.merchant, { shouldDirty: true });
      if (parsed.purchaseDate) setValue('purchase_date', parsed.purchaseDate, { shouldDirty: true });
      if (parsed.purchasePrice !== null) {
        setValue('purchase_price', String(parsed.purchasePrice), { shouldDirty: true });
      }
      if (parsed.warrantyMonths !== null) {
        setValue('warranty_months', String(parsed.warrantyMonths), { shouldDirty: true });
      }
      toast.success(copy.receiptScanComplete);
    } catch (error) {
      console.error('Receipt OCR failed.', error);
      console.error('Receipt OCR cause.', error instanceof Error ? error.cause : undefined);
      toast.error(copy.receiptScanFailed);
    } finally {
      setIsReading(false);
    }
  }, [setValue, updateItemDraft]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let restoredResultListener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener('appRestoredResult', (event) => {
      if (event.pluginId !== 'Camera' || event.methodName !== 'takePhoto') return;
      if (!event.success) {
        toast.error(copy.nativeCameraError, { description: event.error?.message });
        return;
      }
      void receiptPhotoToFile(event.data).then(selectReceipt).catch((error: unknown) => {
        toast.error(copy.nativeCameraError, {
          description: errorMessage(error),
        });
      });
    }).then((listener) => {
      if (active) restoredResultListener = listener;
      else void listener.remove();
    }).catch((error: unknown) => {
      toast.error(copy.nativeCameraError, {
        description: errorMessage(error),
      });
    });

    return () => {
      active = false;
      if (restoredResultListener) void restoredResultListener.remove();
    };
  }, [selectReceipt]);

  async function takeReceiptPhoto() {
    try {
      await selectReceipt(await captureReceiptPhoto());
    } catch (error) {
      toast.error(copy.nativeCameraError, {
        description: errorMessage(error),
      });
    }
  }

  function removeReceipt() {
    updateItemDraft({ receipt: null, parsedReceipt: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function continueToReview() {
    if (isReading) return;
    updateItemDraft({ step: 'review' });
  }

  async function continueToCoverage() {
    if (await trigger(reviewFields)) updateItemDraft({ step: 'coverage' });
  }

  function backToCapture() {
    updateItemDraft({ step: 'capture' });
  }

  async function saveItem(values: ItemFormOutput) {
    setIsSaving(true);
    let uploadedReceipt: Awaited<ReturnType<typeof uploadReceipt>> | null = null;
    let itemId: string;
    try {
      if (itemDraft.receipt) {
        uploadedReceipt = await uploadReceipt(values.household_id, itemDraft.receipt);
      }
      const { data, error } = await supabase
        .from('items')
        .insert({
          ...values,
          notes: values.notes || null,
          ...(uploadedReceipt ?? {}),
        })
        .select('id')
        .single();
      if (error) throw error;
      itemId = data.id;
    } catch (error) {
      if (uploadedReceipt) {
        try {
          await deleteReceipt(uploadedReceipt.receipt_public_id);
        } catch (cleanupError) {
          console.error('Could not clean up the receipt after item creation failed.', cleanupError);
          toast.error(copy.receiptCleanupFailed);
        }
      }
      toast.error(copy.itemSaveError, {
        description: errorMessage(error),
      });
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    updateItemDraft(createEmptyItemDraft());
    toast.success(copy.itemSaved);
    navigate(`/items/${itemId}`);
    void queryClient.invalidateQueries({ queryKey: ['items'] }).catch((error: unknown) => {
      console.error('The item was saved, but the drawer could not refresh.', error);
      toast.error(copy.itemSaveRefreshError);
    });
  }

  const confidence = itemDraft.parsedReceipt
    ? {
      name: itemDraft.parsedReceipt.confidence.productName,
      brand: itemDraft.parsedReceipt.confidence.brand,
      category: itemDraft.parsedReceipt.confidence.category,
      merchant: itemDraft.parsedReceipt.confidence.merchant,
      purchase_price: itemDraft.parsedReceipt.confidence.purchasePrice,
    }
    : undefined;

  return (
    <section className="add-item-page">
      <header className="item-page-heading">
        <p className="app-section-label">{copy.addItem}</p>
        <h1>{copy.addItemTitle}</h1>
        <p>{copy.addItemDescription}</p>
      </header>

      <nav className="item-step-nav" aria-label={copy.addItemTitle}>
        {(['capture', 'review', 'coverage'] as const).map((step) => (
          <div
            className={`item-step${itemDraft.step === step ? ' is-current' : ''}`}
            aria-current={itemDraft.step === step ? 'step' : undefined}
            key={step}
          >
            <span>{stepLabel(step)}</span>
          </div>
        ))}
      </nav>

      <form className="item-flow-card" onSubmit={handleSubmit(saveItem)} noValidate>
        {itemDraft.step === 'capture' && (
          <section aria-labelledby="capture-heading">
            <h2 id="capture-heading">{copy.captureReceiptTitle}</h2>
            <p className="item-flow-description">{copy.captureReceiptDescription}</p>
            <label className="receipt-dropzone" htmlFor="receipt-file">
              <ImagePlus aria-hidden="true" />
              <span>{copy.chooseReceipt}</span>
              <span className="receipt-dropzone-help">{copy.receiptOptional}</span>
            </label>
            {Capacitor.isNativePlatform() && (
              <Button type="button" variant="outline" onClick={() => void takeReceiptPhoto()}>
                <Camera aria-hidden="true" />{copy.takeReceiptPhoto}
              </Button>
            )}
            <Input
              ref={fileInputRef}
              id="receipt-file"
              className="visually-hidden-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void selectReceipt(file);
              }}
            />
            {isReading && (
              <div className="receipt-reading" role="status" aria-live="polite">
                <LoaderCircle aria-hidden="true" className="item-spinner" />
                <span>{copy.scanningReceipt}</span>
                <progress value={progress} max={100} aria-label={copy.scanningReceipt} />
              </div>
            )}
            {itemDraft.receipt && (
              <div className="selected-receipt">
                {itemDraft.receipt.format === 'pdf'
                  ? <FileText aria-hidden="true" />
                  : <ImagePlus aria-hidden="true" />}
                <span>{itemDraft.receipt.filename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={copy.removeReceipt}
                  onClick={removeReceipt}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            )}
            <p className="item-optional-nudge">{copy.addReceiptNudge}</p>
            <div className="item-flow-actions">
              <Button type="button" variant="outline" onClick={() => updateItemDraft({ step: 'review' })}>
                {copy.skipReceipt}
              </Button>
              <Button type="button" onClick={() => void continueToReview()} disabled={isReading}>
                {copy.continue}<ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </section>
        )}

        {itemDraft.step === 'review' && (
          <section aria-labelledby="review-heading">
            <h2 id="review-heading">{copy.reviewReceiptTitle}</h2>
            <p className="item-flow-description">{copy.reviewReceiptDescription}</p>
            {itemDraft.receipt && (
              <div className="item-receipt-summary">
                <FileText aria-hidden="true" />
                <span>{itemDraft.receipt.filename}</span>
                <Badge variant="outline">{copy.receiptFormat(itemDraft.receipt.format)}</Badge>
              </div>
            )}
            <ItemFormFields
              register={register}
              control={control}
              errors={errors}
              households={households}
              group="review"
              confidence={confidence}
            />
            <div className="item-flow-actions">
              <Button type="button" variant="outline" onClick={() => void backToCapture()}>
                <ArrowLeft aria-hidden="true" />{copy.back}
              </Button>
              <Button type="button" onClick={() => void continueToCoverage()}>
                {copy.continue}<ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </section>
        )}

        {itemDraft.step === 'coverage' && (
          <section aria-labelledby="coverage-heading">
            <h2 id="coverage-heading">{copy.coverageTitle}</h2>
            <p className="item-flow-description">{copy.coverageDescription}</p>
            <ItemFormFields
              register={register}
              control={control}
              errors={errors}
              households={households}
              group="coverage"
              ambiguousDate={Boolean(itemDraft.parsedReceipt?.ambiguousDate)}
            />
            <div className="warranty-quick-picks" aria-label={copy.itemWarrantyLength}>
              {[6, 12, 24, 36].map((months) => (
                <Button
                  key={months}
                  type="button"
                  variant={getValues('warranty_months') === String(months) ? 'default' : 'outline'}
                  onClick={() => setValue('warranty_months', String(months), { shouldDirty: true, shouldValidate: true })}
                >
                  {months === 6 ? copy.warrantyChip6
                    : months === 12 ? copy.warrantyChip12
                      : months === 24 ? copy.warrantyChip24 : copy.warrantyChip36}
                </Button>
              ))}
            </div>
            <div className="expiry-preview" aria-live="polite">
              <span>{copy.expiryPreview}</span>
              <strong>{expiryPreview ? formatDateOnly(expiryPreview) : copy.expiryPreviewMissing}</strong>
            </div>
            <p className="item-optional-nudge">{copy.receiptOptional}</p>
            <div className="item-flow-actions">
              <Button type="button" variant="outline" onClick={() => void backToCapture()}>
                <ArrowLeft aria-hidden="true" />{copy.back}
              </Button>
              <Button type="submit" disabled={isSaving || households.length === 0}>
                {isSaving ? copy.savingItem : copy.saveItem}
              </Button>
            </div>
          </section>
        )}
      </form>

      <Button asChild variant="ghost" className="item-flow-cancel">
        <Link to="/">{copy.backToDrawer}</Link>
      </Button>
    </section>
  );
}
