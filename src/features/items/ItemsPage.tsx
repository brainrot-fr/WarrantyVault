import { useEffect, useMemo, useRef, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowLeft, CalendarDays, ChevronRight, FileText, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { StatusStamp } from '@/components/StatusStamp';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { copy } from '@/lib/copy';
import { formatDateOnly, getCoverageProgress, getWarrantyStatus } from '@/lib/dates/warranty';
import { formatMoney } from '@/lib/format/money';
import { deleteReceipt, getTemporaryReceiptUrl, uploadReceipt } from '@/features/receipts/receipt-storage';
import { validateReceiptFile } from '@/features/receipts/receipt-validation';
import type { Database } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import type { AppShellContext } from '@/app/AppShell';
import { useAuth } from '@/app/auth-context';
import { ItemFormFields } from './ItemFormFields';
import { itemEditSchema, type ItemEditInput, type ItemEditOutput, type ItemFormInput, type ItemFormOutput } from './item-schemas';

type Item = Database['public']['Tables']['items']['Row'];
type BucketFilter = 'all' | 'active' | 'expiring' | 'expired';

const filters: Array<{ value: BucketFilter; label: string }> = [
  { value: 'all', label: copy.filterAll },
  { value: 'active', label: copy.filterActive },
  { value: 'expiring', label: copy.filterExpiring },
  { value: 'expired', label: copy.filterExpired },
];

function itemFormValues(item: Item): ItemEditInput {
  return {
    name: item.name,
    brand: item.brand ?? '',
    category: item.category ?? '',
    merchant: item.merchant ?? '',
    serial_number: item.serial_number ?? '',
    purchase_date: item.purchase_date ?? '',
    purchase_price: item.purchase_price === null ? '' : String(item.purchase_price),
    currency: item.currency ?? '',
    warranty_months: item.warranty_months === null ? '' : String(item.warranty_months),
    notes: item.notes ?? '',
  };
}

function statusLabel(item: Item) {
  const status = getWarrantyStatus(item.expiry_date);
  if (status.bucket === 'expired') return copy.expiredDaysAgo(status.daysLeft ?? 0);
  if (status.bucket === 'expiring') {
    return status.daysLeft === 0 ? copy.expiresToday : copy.expiresInDays(status.daysLeft ?? 0);
  }
  return copy.warrantyActive;
}

function compareUrgency(left: Item, right: Item) {
  const leftStatus = getWarrantyStatus(left.expiry_date);
  const rightStatus = getWarrantyStatus(right.expiry_date);
  return (leftStatus.daysLeft ?? Number.POSITIVE_INFINITY) -
    (rightStatus.daysLeft ?? Number.POSITIVE_INFINITY);
}

function itemMatchesSearch(item: Item, query: string) {
  if (!query) return true;
  return [item.name, item.brand, item.merchant, item.serial_number]
    .some((value) => value?.toLocaleLowerCase().includes(query));
}

function ItemList({
  items,
  selectedItemId,
  searchTerm,
  isLoading,
  isError,
  onRetry,
}: {
  items: Item[];
  selectedItemId?: string;
  searchTerm: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<BucketFilter>('all');
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const filteredItems = items
    .filter((item) => itemMatchesSearch(item, normalizedSearch))
    .filter((item) => filter === 'all' || getWarrantyStatus(item.expiry_date).bucket === filter);
  const urgentItems = filteredItems
    .filter((item) => getWarrantyStatus(item.expiry_date).bucket !== 'active')
    .sort(compareUrgency);
  const endedItems = urgentItems.filter((item) => getWarrantyStatus(item.expiry_date).bucket === 'expired');
  const expiringSoonItems = urgentItems.filter((item) => getWarrantyStatus(item.expiry_date).bucket === 'expiring');
  const groupedItems = filteredItems
    .filter((item) => getWarrantyStatus(item.expiry_date).bucket === 'active')
    .reduce<Record<string, Item[]>>((groups, item) => {
      const category = item.category?.trim() || copy.unknownCategory;
      (groups[category] ??= []).push(item);
      return groups;
    }, {});
  const groupedEntries = Object.entries(groupedItems).sort(([left], [right]) => left.localeCompare(right));

  if (isLoading) {
    return (
      <div className="item-list-loading" aria-label={copy.loadingItems}>
        <div /><div /><div />
      </div>
    );
  }

  return (
    <section className="drawer-list" aria-label={copy.warranties}>
      <div className="item-filter-chips" role="group" aria-label={copy.filterItems}>
        {filters.map((option) => (
          <Button
            type="button"
            key={option.value}
            variant={filter === option.value ? 'default' : 'outline'}
            size="sm"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {isError ? (
        <div className="drawer-empty" role="alert">
          <p>{copy.itemLoadError}</p>
          <Button type="button" variant="outline" onClick={onRetry}>{copy.retry}</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="drawer-empty">
          <h2>{copy.noItemsTitle}</h2>
          <p>{copy.noItemsDescription}</p>
          <Button asChild><Link to="/items/new">{copy.addFirstItem}</Link></Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="drawer-empty">
          <p>{normalizedSearch ? copy.itemSearchEmpty : copy.noFilteredItems}</p>
        </div>
      ) : (
        <div className="drawer-item-sections">
          {expiringSoonItems.length > 0 && (
            <section aria-labelledby="needs-attention-heading">
              <h2 id="needs-attention-heading">{copy.needsAttention}</h2>
              <div className="drawer-item-list">
                {expiringSoonItems.map((item) => (
                  <ItemLink key={item.id} item={item} selected={item.id === selectedItemId} />
                ))}
              </div>
            </section>
          )}
          {groupedEntries.map(([category, categoryItems]) => (
            <section key={category} aria-label={category}>
              <h2>{category}</h2>
              <div className="drawer-item-list">
                {categoryItems.map((item) => (
                  <ItemLink key={item.id} item={item} selected={item.id === selectedItemId} />
                ))}
                {endedItems.length > 0 && (
                  <details className="ended-warranties">
                    <summary>{copy.endedWarranties} ({endedItems.length})</summary>
                    <div className="drawer-item-list">
                      {endedItems.map((item) => (
                        <ItemLink key={item.id} item={item} selected={item.id === selectedItemId} />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function ItemLink({ item, selected }: { item: Item; selected: boolean }) {
  const status = getWarrantyStatus(item.expiry_date).bucket;
  const expiry = item.expiry_date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${item.expiry_date}T00:00:00`))
    : copy.noExpiryDate;
  const days = getWarrantyStatus(item.expiry_date).daysLeft;
  return (
    <Link
      className={`drawer-item-link${selected ? ' is-selected' : ''}`}
      to={`/items/${item.id}`}
      aria-current={selected ? 'page' : undefined}
    >
      <span className="warranty-row-icon" aria-hidden="true">{(item.category?.trim().charAt(0) || item.name.charAt(0)).toUpperCase()}</span>
      <span className="warranty-row-copy">
        <strong>{item.name}</strong>
        <small>{status === 'expired' ? copy.warrantyExpired : `${copy.expiresOn} ${expiry}${days !== null ? ` · ${statusLabel(item)}` : ''}`}</small>
      </span>
      <StatusStamp status={status} label={statusLabel(item)} />
      <ChevronRight className="warranty-row-chevron" aria-hidden="true" />
    </Link>
  );
}

function ItemDetail({ item, onChanged }: { item: Item; onChanged: () => Promise<void> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { households } = useOutletContext<AppShellContext>();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isGeneratingClaimPack, setIsGeneratingClaimPack] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const status = getWarrantyStatus(item.expiry_date);
  const progress = getCoverageProgress(item.purchase_date, item.expiry_date);

  async function openReceipt() {
    try {
      const temporary = await getTemporaryReceiptUrl(item.id);
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: temporary.url });
        return;
      }
      window.open(temporary.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(copy.receiptOpenError, {
        description: errorMessage(error),
      });
    }
  }

  async function replaceReceipt(file: File) {
    setIsReplacing(true);
    let uploaded: Awaited<ReturnType<typeof uploadReceipt>> | null = null;
    let replacementSaved = false;
    try {
      const validated = await validateReceiptFile(file);
      uploaded = await uploadReceipt(item.household_id, validated);
      const { error } = await supabase
        .from('items')
        .update(uploaded)
        .eq('id', item.id)
        .select('id')
        .single();
      if (error) throw error;
      replacementSaved = true;
    } catch (error) {
      if (uploaded && !replacementSaved) {
        try {
          await deleteReceipt(uploaded.receipt_public_id);
        } catch (cleanupError) {
          console.error('Could not clean up an unsuccessful receipt replacement.', cleanupError);
          toast.error(copy.receiptCleanupFailed);
        }
      }
      toast.error(copy.receiptReplaceError, {
        description: errorMessage(error),
      });
      return;
    } finally {
      setIsReplacing(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
    try {
      await onChanged();
    } catch (error) {
      console.error('The replacement receipt was saved, but the drawer could not refresh.', error);
      toast.error(copy.receiptReplaceRefreshError);
    }
    if (item.receipt_public_id) {
      try {
        await deleteReceipt(item.receipt_public_id);
      } catch (error) {
        console.error('The replacement was saved, but the old receipt could not be deleted.', error);
        toast.error(copy.receiptDeleteError);
      }
    }
    toast.success(copy.receiptReplaced);
  }

  async function deleteItem() {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('items').delete().eq('id', item.id).select('id').single();
      if (error) throw error;
    } catch (error) {
      toast.error(copy.itemDeleteError, {
        description: errorMessage(error),
      });
      setIsDeleting(false);
      return;
    }
    setIsDeleting(false);
    setDeleteOpen(false);
    navigate('/');
    toast.success(copy.itemDeleted);
    if (item.receipt_public_id) {
      try {
        await deleteReceipt(item.receipt_public_id);
      } catch (error) {
        console.error('The item was deleted, but its receipt could not be removed from storage.', error);
        toast.error(copy.receiptDeleteError);
      }
    }
    try {
      await queryClient.invalidateQueries({ queryKey: ['items'] });
    } catch (error) {
      console.error('The item was deleted, but the drawer could not refresh.', error);
      toast.error(copy.itemDeleteRefreshError);
    }
  }

  function showValue(value: string | null) {
    return value?.trim() || copy.notRecorded;
  }

  async function generateClaimPack() {
    setIsGeneratingClaimPack(true);
    try {
      const { createClaimPack, exportClaimPack, fetchClaimPackReceipt } =
        await import('@/features/claim/claim-pack');
      const receiptBytes = item.receipt_public_id
        ? await fetchClaimPackReceipt(item.id)
        : undefined;
      const bytes = await createClaimPack(item, receiptBytes);
      const result = await exportClaimPack(item, bytes);
      toast.success(result === 'shared' ? copy.claimPackShared : copy.claimPackDownloaded);
    } catch (error) {
      toast.error(copy.claimPackGenerationError, {
        description: errorMessage(error),
      });
    } finally {
      setIsGeneratingClaimPack(false);
    }
  }

  return (
    <article className="item-detail">
      <div className="item-detail-mobile-back">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft aria-hidden="true" />{copy.backToWarranties}</Link>
        </Button>
      </div>
      <header className="item-detail-heading">
        <div>
          <p className="app-section-label">{copy.itemDetails}</p>
          <h2>{item.name}</h2>
          <p>{[item.brand, item.category].filter(Boolean).join(' · ') || copy.noBrand}</p>
        </div>
        <StatusStamp status={status.bucket} label={statusLabel(item)} className="item-detail-stamp" />
      </header>

      <section className="coverage-panel" aria-labelledby="coverage-timeline-heading">
        <h3 id="coverage-timeline-heading">{copy.coverageTimeline}</h3>
        {progress !== null ? (
          <div
            className="coverage-timeline"
            role="img"
            aria-label={`${copy.purchasedOn} ${formatDateOnly(item.purchase_date)}. ${copy.today}. ${copy.expiresOn} ${formatDateOnly(item.expiry_date)}.`}
          >
            <div className="coverage-timeline-track">
              <span className="coverage-timeline-fill" style={{ width: `${progress}%` }} />
              <span className="coverage-timeline-today" style={{ left: `${progress}%` }} />
            </div>
            <div className="coverage-timeline-labels">
              <span>{formatDateOnly(item.purchase_date)}</span>
              <span
                className="coverage-today-label"
                style={{ left: `${Math.min(92, Math.max(8, progress))}%` }}
              >
                {copy.today}
              </span>
              <span>{formatDateOnly(item.expiry_date)}</span>
            </div>
          </div>
        ) : (
          <p className="coverage-timeline-missing">
            {copy.noPurchaseDate} · {copy.expiryPreviewMissing}
          </p>
        )}
      </section>

      <Button
        type="button"
        className="claim-pack-button"
        disabled={isGeneratingClaimPack}
        onClick={() => { void generateClaimPack(); }}
      >
        <ArrowDownToLine aria-hidden="true" />
        {isGeneratingClaimPack ? copy.claimPackGenerating : copy.claimPackDownload}
      </Button>

      <div className="item-detail-actions">
        <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil aria-hidden="true" />{copy.editItem}
        </Button>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              <Trash2 aria-hidden="true" />{copy.deleteItem}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.deleteItemTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.deleteItemDescription(item.name)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isDeleting}
                onClick={(event) => {
                  event.preventDefault();
                  void deleteItem();
                }}
              >
                {isDeleting ? copy.working : copy.deleteItem}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <section className="item-facts" aria-labelledby="item-facts-heading">
        <h3 id="item-facts-heading">{copy.itemSavedDetails}</h3>
        <div className="item-facts-grid">
          <Fact label={copy.itemMerchant} value={showValue(item.merchant)} />
          <Fact label={copy.itemSerialNumber} value={showValue(item.serial_number)} mono />
          <Fact label={copy.itemPurchaseDate} value={formatDateOnly(item.purchase_date) ?? copy.notRecorded} mono />
          <Fact label={copy.itemPurchasePrice} value={formatMoney(item.purchase_price, item.currency)} mono />
          <Fact
            label={copy.itemWarrantyLength}
            value={item.warranty_months === null ? copy.notRecorded : copy.warrantyMonthsValue(item.warranty_months)}
          />
          <Fact label={copy.expiresOn} value={formatDateOnly(item.expiry_date) ?? copy.noExpiryDate} mono />
          {item.notes && <Fact label={copy.itemNotes} value={item.notes} wide />}
        </div>
      </section>

      <section className="item-receipt-section" aria-labelledby="receipt-heading">
        <header className="item-section-heading">
          <h3 id="receipt-heading">{copy.receiptDetails}</h3>
          <input
            ref={receiptInputRef}
            className="visually-hidden-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void replaceReceipt(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isReplacing}
            onClick={() => receiptInputRef.current?.click()}
          >
            {isReplacing ? copy.working : item.receipt_public_id ? copy.replaceReceipt : copy.addReceipt}
          </Button>
        </header>
        {item.receipt_public_id ? (
          <div className="receipt-document-slip">
            <FileText aria-hidden="true" />
            <div>
              <strong>{item.receipt_filename ?? copy.documentName}</strong>
              <span>
                {item.receipt_format ? copy.receiptFormat(item.receipt_format) : copy.receiptDetails}
                {item.receipt_bytes ? ` · ${copy.receiptSize(Math.max(1, Math.round(item.receipt_bytes / 1024)))}` : ''}
              </span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void openReceipt()}>
              <ArrowDownToLine aria-hidden="true" />{copy.receiptDownload}
            </Button>
          </div>
        ) : (
          <div className="receipt-empty"><p>{copy.receiptNotAttached}</p></div>
        )}
      </section>

      <EditItemSheet
        item={item}
        households={households}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onChanged}
      />
    </article>
  );
}

function Fact({ label, value, mono = false, wide = false }: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`item-fact${mono ? ' is-mono' : ''}${wide ? ' is-wide' : ''}`}>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function EditItemSheet({
  item,
  households,
  open,
  onOpenChange,
  onSaved,
}: {
  item: Item;
  households: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<ItemEditInput, unknown, ItemEditOutput>({
    resolver: zodResolver(itemEditSchema),
    defaultValues: itemFormValues(item),
    mode: 'onBlur',
  });
  const { control, formState: { errors }, handleSubmit, register, reset } = form;

  useEffect(() => reset(itemFormValues(item)), [item, reset]);

  async function save(values: ItemEditOutput) {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({ ...values, notes: values.notes || null })
        .eq('id', item.id)
        .select('id')
        .single();
      if (error) throw error;
    } catch (error) {
      toast.error(copy.itemUpdateError, {
        description: errorMessage(error),
      });
      setIsSaving(false);
      return;
    }
    try {
      await onSaved();
    } catch (error) {
      console.error('The item was updated, but the drawer could not refresh.', error);
      toast.error(copy.itemUpdateRefreshError);
    }
    toast.success(copy.editSaved);
    onOpenChange(false);
    setIsSaving(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="item-edit-sheet">
        <SheetHeader>
          <SheetTitle>{copy.editItemTitle}</SheetTitle>
          <SheetDescription>{copy.itemDetails}</SheetDescription>
        </SheetHeader>
        <form className="item-edit-form" onSubmit={handleSubmit(save)} noValidate>
          <ItemFormFields
            register={register as unknown as import('react-hook-form').UseFormRegister<ItemFormInput>}
            control={control as unknown as Control<ItemFormInput, unknown, ItemFormOutput>}
            errors={errors}
            households={households}
            group="all"
            includeHousehold={false}
          />
          <div className="item-edit-actions">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? copy.working : copy.itemDraftSave}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ItemsPage() {
  const { user } = useAuth();
  const { activeHouseholdId, searchTerm, setSearchTerm, households, changeHousehold } =
    useOutletContext<AppShellContext>();
  const { itemId } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const itemsQuery = useQuery({
    queryKey: ['items', user?.id, activeHouseholdId],
    queryFn: async () => {
      const result = activeHouseholdId === 'all'
        ? await supabase.from('items').select('*').order('created_at', { ascending: false })
        : await supabase.from('items').select('*')
          .eq('household_id', activeHouseholdId)
          .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  useEffect(() => {
    if (itemsQuery.isError) {
      toast.error(copy.itemLoadError, {
        description: errorMessage(itemsQuery.error),
      });
    }
  }, [itemsQuery.error, itemsQuery.isError]);

  async function reloadItems() {
    await queryClient.invalidateQueries({ queryKey: ['items'] });
  }

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const item = items.find((candidate) => candidate.id === itemId);
  const expiringCount = items.filter((candidate) => getWarrantyStatus(candidate.expiry_date).bucket === 'expiring').length;
  return (
    <div className="page warranties-page">
      <header className="page-header warranties-header">
        <div>
          <h1>{copy.warrantiesHeading}</h1>
          <p>{copy.warrantiesSummary(0, expiringCount)}</p>
        </div>
        <div className="warranties-header-controls">
          <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label={copy.searchItems} placeholder={copy.searchPlaceholder} />
          {households.length > 1 && (
            <Select value={activeHouseholdId} onValueChange={changeHousehold}>
              <SelectTrigger aria-label={copy.selectHouseholdLabel}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allHouseholds}</SelectItem>
                {households.map((household) => <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button asChild><Link to="/items/new">{copy.addItemAction}</Link></Button>
        </div>
      </header>
      {items.length === 0 && !itemsQuery.isLoading ? (
        <section className="warranties-onboarding">
          <h2>{copy.noItemsTitle}</h2>
          <p>{copy.noItemsDescription}</p>
          <div>
            <Button asChild><Link to="/items/new">{copy.scanReceipt}</Link></Button>
            <Button asChild variant="outline"><Link to="/items/new?manual=1">{copy.enterManually}</Link></Button>
          </div>
        </section>
      ) : (
      <div className={`items-layout${itemId ? ' has-selection' : ''}`}>
      <ItemList
        items={itemsQuery.data ?? []}
        selectedItemId={itemId}
        searchTerm={searchTerm}
        isLoading={itemsQuery.isLoading}
        isError={!itemsQuery.data && itemsQuery.isError}
        onRetry={() => { void itemsQuery.refetch(); }}
      />
      {itemId ? (
        item ? (
          <ItemDetail item={item} onChanged={reloadItems} />
        ) : itemsQuery.isLoading ? (
          <div className="item-detail-loading" aria-label={copy.loadingItem} />
        ) : (
          <section className="item-not-found">
            <p>{copy.itemNotFound}</p>
            <Button type="button" onClick={() => navigate('/')}>{copy.backToWarranties}</Button>
          </section>
        )
      ) : (
        <section className="item-desktop-empty">
          <CalendarDays aria-hidden="true" />
          <h2>{copy.chooseItemTitle}</h2>
          <p>{copy.chooseItemDescription}</p>
          <Button asChild variant="outline"><Link to="/items/new">{copy.addItemAction}</Link></Button>
        </section>
      )}
      </div>
      )}
    </div>
  );
}
