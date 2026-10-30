import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Download, FileText, Pencil, Shield, Trash2 } from 'lucide-react';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassChip } from '../components/ui/GlassChip';
import { GlassInput } from '../components/ui/GlassInput';
import { GlassModal } from '../components/ui/GlassModal';
import { CardSkeleton } from '../components/ui/GlassSkeleton';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { daysUntil, formatCurrency, formatDate, getWarrantyStatus } from '../lib/format';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ItemDetails() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(null);
  const [actionError, setActionError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const itemQuery = useQuery({
    queryKey: ['items', id],
    queryFn: () => api.get(`/items/${id}`),
  });
  const billQuery = useQuery({
    queryKey: ['bill-url', id],
    queryFn: () => api.get(`/items/${id}/bill-url`),
    enabled: Boolean(itemQuery.data),
    retry: false,
  });
  const item = itemQuery.data;

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || '',
        brand: item.brand || '',
        category: item.category || '',
        purchaseDate: item.purchaseDate || '',
        purchasePrice: item.purchasePrice ?? '',
        warrantyMonths: item.warrantyMonths ?? '',
        notes: item.notes || '',
      });
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put(`/items/${id}`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['items', id], updated);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditing(false);
      setActionError('');
      toast('Warranty details updated.');
    },
    onError: (error) => setActionError(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Item removed from your vault.');
      navigate('/dashboard');
    },
    onError: (error) => {
      setActionError(error.message);
      setConfirmDelete(false);
    },
  });
  const claimMutation = useMutation({
    mutationFn: () => api.get(`/items/${id}/claim-pack`),
    onSuccess: (blob) => {
      saveBlob(blob, `${(item?.name || 'warranty-claim').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-claim-pack.pdf`);
      toast('Your claim pack is ready.');
    },
    onError: (error) => setActionError(error.message),
  });

  const urlPayload = billQuery.data;
  const billUrl = typeof urlPayload === 'string' ? urlPayload : urlPayload?.url || urlPayload?.signedUrl;
  const isPdf = item?.contentType === 'application/pdf' || item?.billPath?.toLowerCase().endsWith('.pdf');
  const status = item ? getWarrantyStatus(item) : 'active';
  const days = item ? daysUntil(item.expiryDate) : null;

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submitEdit(event) {
    event.preventDefault();
    updateMutation.mutate({
      ...form,
      purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice),
      warrantyMonths: Number(form.warrantyMonths),
      householdId: item.householdId,
    });
  }

  if (itemQuery.isLoading) {
    return <main className="page-shell grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></main>;
  }
  if (itemQuery.error) {
    return (
      <main className="page-shell">
        <GlassCard role="alert">
          <h1 className="font-heading text-3xl font-semibold">We couldn’t open this item.</h1>
          <p className="mt-2 text-sm text-muted-foreground">{itemQuery.error.message}</p>
          <GlassButton as={Link} to="/dashboard" variant="secondary" className="mt-5">Back to dashboard</GlassButton>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Link to="/dashboard" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg pr-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
      </Link>
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="eyebrow"><span className="eyebrow-dot" /> Warranty details</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-5xl font-semibold leading-none">{item.name || 'Untitled item'}</h1>
            <GlassChip status={status} />
          </div>
          <p className="mt-2 text-muted-foreground">{[item.brand, item.category].filter(Boolean).join(' · ') || 'Household purchase'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton variant="secondary" onClick={() => { setActionError(''); setEditing(true); }}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
          </GlassButton>
          <GlassButton onClick={() => claimMutation.mutate()} loading={claimMutation.isPending}>
            <Download className="h-4 w-4" aria-hidden="true" /> Claim pack
          </GlassButton>
        </div>
      </div>

      {actionError && <p role="alert" className="mb-5 rounded-xl border border-destructive/strong bg-destructive/soft p-3 text-sm font-medium text-destructive">{actionError}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_0.9fr]">
        <GlassCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-primary/soft p-5">
            <div>
              <h2 className="font-heading text-2xl font-semibold">Purchase bill</h2>
              <p className="mt-1 text-xs text-muted-foreground">{item.originalFilename || item.billFileName || 'Private household document'}</p>
            </div>
            <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          {billQuery.isLoading ? (
            <div className="grid min-h-64 place-items-center p-6 text-sm text-muted-foreground">Preparing your private bill preview…</div>
          ) : billQuery.error ? (
            <div className="grid min-h-64 place-items-center p-6 text-center">
              <div><p className="font-semibold">The bill preview could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">{billQuery.error.message}</p></div>
            </div>
          ) : billUrl && isPdf ? (
            <iframe title={`Purchase bill for ${item.name}`} src={billUrl} className="h-[min(70vh,680px)] w-full bg-white" />
          ) : billUrl ? (
            <a href={billUrl} target="_blank" rel="noreferrer" className="block bg-primary/soft p-4">
              <img src={billUrl} alt={`Purchase bill for ${item.name}`} className="mx-auto max-h-[min(70vh,680px)] w-full rounded-lg object-contain" />
            </a>
          ) : (
            <div className="grid min-h-64 place-items-center p-6 text-sm text-muted-foreground">No bill was attached to this item.</div>
          )}
          {billUrl && (
            <div className="border-t border-primary/soft p-4 text-right">
              <a href={billUrl} target="_blank" rel="noreferrer" className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/soft">Open bill in a new tab</a>
            </div>
          )}
        </GlassCard>

        <div className="grid gap-5">
          <GlassCard>
            <div className="mb-5 flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" aria-hidden="true" />
              <h2 className="font-heading text-2xl font-semibold">Coverage timeline</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Purchase date" value={formatDate(item.purchaseDate)} />
              <Detail label="Warranty length" value={item.warrantyMonths == null ? 'Not set' : `${item.warrantyMonths} months`} />
              <Detail label="Purchase price" value={formatCurrency(item.purchasePrice)} />
              <Detail label="Warranty expires" value={formatDate(item.expiryDate)} />
            </div>
            <div className="mt-5 rounded-xl bg-primary/soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-accent" aria-hidden="true" /> Coverage status</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {days === null ? 'Add a purchase date and warranty period to track coverage.' : days < 0 ? `Expired ${Math.abs(days)} days ago.` : days === 0 ? 'This warranty expires today.' : `There are ${days} days left in this warranty.`}
              </p>
            </div>
          </GlassCard>
          {item.notes && (
            <GlassCard>
              <h2 className="font-heading text-2xl font-semibold">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{item.notes}</p>
            </GlassCard>
          )}
          <GlassCard className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">No longer need this record?</h2>
              <p className="mt-1 text-xs text-muted-foreground">Removing an item deletes its saved bill from the vault.</p>
            </div>
            <GlassButton variant="danger" onClick={() => { setActionError(''); setConfirmDelete(true); }}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
            </GlassButton>
          </GlassCard>
        </div>
      </div>

      <GlassModal open={editing} title="Edit warranty details" onClose={() => setEditing(false)}>
        {form && (
          <form className="grid gap-4" onSubmit={submitEdit}>
            <GlassInput label="Product name" name="name" value={form.name} onChange={updateField} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <GlassInput label="Brand" name="brand" value={form.brand} onChange={updateField} />
              <GlassInput label="Category" name="category" value={form.category} onChange={updateField} />
              <GlassInput label="Purchase date" name="purchaseDate" type="date" value={form.purchaseDate} onChange={updateField} required />
              <GlassInput label="Price" name="purchasePrice" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={updateField} />
              <GlassInput label="Warranty (months)" name="warrantyMonths" type="number" min="0" max="1200" value={form.warrantyMonths} onChange={updateField} required />
            </div>
            <GlassInput as="textarea" className="min-h-24 resize-y" label="Notes" name="notes" value={form.notes} onChange={updateField} />
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
            <div className="flex justify-end gap-3">
              <GlassButton variant="secondary" onClick={() => setEditing(false)}>Cancel</GlassButton>
              <GlassButton type="submit" loading={updateMutation.isPending}>Save changes</GlassButton>
            </div>
          </form>
        )}
      </GlassModal>
      <GlassModal open={confirmDelete} title="Remove this item?" onClose={() => setConfirmDelete(false)}>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">This removes <strong className="text-foreground">{item.name}</strong> and its stored bill from your household vault. This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <GlassButton variant="secondary" onClick={() => setConfirmDelete(false)}>Keep item</GlassButton>
          <GlassButton variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Delete item</GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
