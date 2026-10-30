import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Check, FileImage, FileText, LoaderCircle, ScanLine, UploadCloud } from 'lucide-react';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassInput } from '../components/ui/GlassInput';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { calculateExpiryDate, formatDate, normalizeItems } from '../lib/format';

const blankForm = {
  name: '',
  brand: '',
  category: '',
  purchaseDate: '',
  purchasePrice: '',
  warrantyMonths: '',
  notes: '',
};

const supportedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
const maximumSize = 5 * 1024 * 1024;

export function AddItem() {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [ocrState, setOcrState] = useState('idle');
  const [ocrError, setOcrError] = useState('');
  const [fileError, setFileError] = useState('');
  const [householdId, setHouseholdId] = useState('');
  const [householdName, setHouseholdName] = useState('My household');
  const [createHouseholdError, setCreateHouseholdError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const householdsQuery = useQuery({
    queryKey: ['households'],
    queryFn: () => api.get('/households'),
  });
  const households = normalizeItems(householdsQuery.data);
  const selectedHousehold = householdId || households[0]?.id || '';
  const expiryDate = useMemo(
    () => calculateExpiryDate(form.purchaseDate, form.warrantyMonths),
    [form.purchaseDate, form.warrantyMonths],
  );

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/items', body),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast('Your purchase is safely in the vault.');
      navigate(saved?.id ? `/items/${saved.id}` : '/dashboard');
    },
    onError: (error) => toast(error.message, 'error'),
  });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function selectFile(nextFile) {
    setFileError('');
    setOcrError('');
    setOcrState('idle');
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!supportedTypes.includes(nextFile.type)) {
      setFile(null);
      setFileError('Choose a JPEG, PNG, or PDF receipt.');
      return;
    }
    if (nextFile.size > maximumSize) {
      setFile(null);
      setFileError('This file is larger than 5 MB. Choose a smaller receipt.');
      return;
    }
    setFile(nextFile);
    setOcrState('loading');
    const request = new FormData();
    request.append('file', nextFile);
    if (selectedHousehold) request.append('householdId', selectedHousehold);
    try {
      const extracted = await api.post('/items/ocr', request);
      setForm((current) => ({
        ...current,
        name: extracted.name || extracted.productName || current.name,
        brand: extracted.brand || current.brand,
        category: extracted.category || current.category,
        purchaseDate: extracted.purchaseDate || current.purchaseDate,
        purchasePrice: extracted.purchasePrice ?? extracted.price ?? current.purchasePrice,
        warrantyMonths: extracted.warrantyMonths ?? current.warrantyMonths,
        notes: extracted.merchant && !current.notes ? `Purchased from: ${extracted.merchant}` : current.notes,
      }));
      setOcrState('done');
    } catch (error) {
      setOcrState('error');
      setOcrError(`${error.message} You can still enter the details manually.`);
    }
  }

  async function handleCreateHousehold() {
    setCreateHouseholdError('');
    try {
      const created = await api.post('/households', { name: householdName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['households'] });
      setHouseholdId(created.id);
      toast('Household created.');
    } catch (error) {
      setCreateHouseholdError(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedHousehold) {
      setFileError('Create a household before saving this item.');
      return;
    }
    if (!file) {
      setFileError('Add a photo or PDF of the purchase bill to continue.');
      return;
    }
    const item = {
      ...form,
      purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice),
      warrantyMonths: Number(form.warrantyMonths),
      householdId: selectedHousehold,
    };
    const body = new FormData();
    body.append('item', new Blob([JSON.stringify(item)], { type: 'application/json' }));
    body.append('bill', file);
    createMutation.mutate(body);
  }

  return (
    <main className="page-shell">
      <Link to="/dashboard" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg pr-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
      </Link>
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-dot" /> Add to your home inventory</p>
        <h1>Keep the details close.</h1>
        <p>Upload a receipt, review the details we find, then add the warranty dates you want to remember.</p>
      </div>

      {householdsQuery.isLoading ? (
        <GlassCard><p className="text-sm text-muted-foreground">Loading your households…</p></GlassCard>
      ) : householdsQuery.error ? (
        <GlassCard role="alert" className="mb-6 border-destructive/30">
          <p className="font-semibold text-destructive">Your households could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{householdsQuery.error.message}</p>
        </GlassCard>
      ) : !households.length ? (
        <GlassCard className="mb-6">
          <h2 className="font-heading text-2xl font-semibold">Start with a household</h2>
          <p className="mt-1 text-sm text-muted-foreground">Every item belongs to a household, so you can share warranties with the people at home.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <GlassInput label="Household name" name="householdName" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} />
            <GlassButton onClick={handleCreateHousehold}>Create household</GlassButton>
          </div>
          {createHouseholdError && <p role="alert" className="mt-3 text-sm text-destructive">{createHouseholdError}</p>}
        </GlassCard>
      ) : households.length > 1 ? (
        <GlassCard className="mb-6">
          <label htmlFor="householdId" className="mb-1.5 block text-sm font-semibold">Save to household</label>
          <select
            id="householdId"
            className="glass-input min-h-11 w-full max-w-md rounded-lg px-4 py-2.5 text-foreground"
            value={selectedHousehold}
            onChange={(event) => setHouseholdId(event.target.value)}
          >
            {households.map((household) => <option key={household.id} value={household.id}>{household.name}</option>)}
          </select>
        </GlassCard>
      ) : null}

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="lg:sticky lg:top-24">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/tint text-accent">
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-2xl font-semibold">Your purchase bill</h2>
              <p className="mt-1 text-sm text-muted-foreground">JPG, PNG, or PDF · up to 5 MB</p>
            </div>
          </div>
          <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/border bg-primary/soft px-5 py-8 text-center transition hover:border-accent/half hover:bg-accent/soft focus-within:ring-2 focus-within:ring-accent">
            <input
              type="file"
              className="sr-only"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              aria-label="Choose a purchase bill image or PDF"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-card text-accent shadow-sm">
              {file?.type === 'application/pdf' ? <FileText className="h-5 w-5" aria-hidden="true" /> : <FileImage className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span className="font-semibold">{file?.name || 'Choose a receipt'}</span>
            <span className="mt-1 text-sm text-muted-foreground">Browse files from your device</span>
          </label>
          {fileError && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{fileError}</p>}
          {ocrState === 'loading' && (
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-accent" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading your receipt…
            </div>
          )}
          {ocrState === 'done' && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-status-active">
              <Check className="h-4 w-4" aria-hidden="true" /> Details found. Please review them before saving.
            </p>
          )}
          {ocrState === 'error' && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">{ocrError}</p>
          )}
          <div className="mt-5 rounded-xl bg-primary/soft p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="h-4 w-4 text-accent" aria-hidden="true" /> Receipt reading is a starting point
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">You can always edit the extracted details. The original bill stays private to your household.</p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-5">
            <p className="eyebrow">Purchase details</p>
            <h2 className="mt-1 font-heading text-3xl font-semibold">Make it yours.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput label="Product name" name="name" value={form.name} onChange={updateField} placeholder="e.g. Espresso machine" required />
            <GlassInput label="Brand" name="brand" value={form.brand} onChange={updateField} placeholder="e.g. Breville" />
            <GlassInput label="Category" name="category" value={form.category} onChange={updateField} placeholder="e.g. Kitchen" />
            <GlassInput label="Purchase price" name="purchasePrice" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={updateField} placeholder="0.00" />
            <GlassInput label="Purchase date" name="purchaseDate" type="date" value={form.purchaseDate} onChange={updateField} required />
            <GlassInput label="Warranty period (months)" name="warrantyMonths" type="number" min="0" max="1200" step="1" value={form.warrantyMonths} onChange={updateField} placeholder="e.g. 24" required />
          </div>
          <div className="mt-4 rounded-xl bg-accent/soft p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-accent" aria-hidden="true" /> Warranty expiry
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {expiryDate ? formatDate(expiryDate) : 'Enter a purchase date and warranty period to calculate the date.'}
            </p>
          </div>
          <GlassInput
            as="textarea"
            className="min-h-24 resize-y"
            label="Notes (optional)"
            name="notes"
            value={form.notes}
            onChange={updateField}
            placeholder="Serial number, store location, or anything useful for a future claim"
          />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to="/dashboard"><GlassButton variant="secondary" className="w-full sm:w-auto">Cancel</GlassButton></Link>
            <GlassButton type="submit" loading={createMutation.isPending} className="w-full sm:w-auto">Save warranty</GlassButton>
          </div>
        </GlassCard>
      </form>
    </main>
  );
}
