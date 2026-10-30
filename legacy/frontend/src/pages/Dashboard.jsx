import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Plus, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { daysUntil, getWarrantyStatus, normalizeItems } from '../lib/format';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassCard } from '../components/ui/GlassCard';
import { CardSkeleton } from '../components/ui/GlassSkeleton';
import { WarrantyItemCard } from '../components/WarrantyItemCard';

const sectionDetails = [
  { key: 'active', title: 'Active', description: 'Covered and in good hands', Icon: CheckCircle2 },
  { key: 'expiring', title: 'Expiring soon', description: 'A little time to make a plan', Icon: Clock3 },
  { key: 'expired', title: 'Expired', description: 'Your history, always within reach', Icon: AlertTriangle },
];

function responseItems(data) {
  const direct = normalizeItems(data);
  if (direct.length) return direct;
  const groups = [
    ...(Array.isArray(data?.active) ? data.active : []),
    ...(Array.isArray(data?.activeItems) ? data.activeItems : []),
    ...(Array.isArray(data?.expiringSoon) ? data.expiringSoon : []),
    ...(Array.isArray(data?.expiringSoonItems) ? data.expiringSoonItems : []),
    ...(Array.isArray(data?.expired) ? data.expired : []),
    ...(Array.isArray(data?.expiredItems) ? data.expiredItems : []),
  ];
  return Array.from(new Map(groups.map((item) => [item.id, item])).values());
}

export function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/items/dashboard'),
  });
  const items = useMemo(() => responseItems(data), [data]);
  const sections = useMemo(
    () => ({
      active: items.filter((item) => getWarrantyStatus(item) === 'active'),
      expiring: items.filter((item) => getWarrantyStatus(item) === 'expiring'),
      expired: items.filter((item) => getWarrantyStatus(item) === 'expired'),
    }),
    [items],
  );
  const upcoming = [...items]
    .filter((item) => daysUntil(item.expiryDate) !== null && daysUntil(item.expiryDate) >= 0)
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))[0];

  return (
    <main className="page-shell">
      <section className="mb-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="eyebrow"><span className="eyebrow-dot" /> Your home, thoughtfully protected</p>
          <h1 className="mt-3 font-heading text-5xl font-semibold leading-[0.96] sm:text-6xl">A clear view of what’s covered.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Every purchase, proof of ownership, and warranty date — all in one considered place.
          </p>
        </div>
        <GlassButton as={Link} to="/items/new" className="w-full shrink-0 sm:w-auto"><Plus className="h-4 w-4" aria-hidden="true" /> Add a purchase</GlassButton>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-3" aria-label="Warranty totals">
        {sectionDetails.map(({ key, title, description, Icon }) => (
          <GlassCard key={key} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <p className="mt-1 font-heading text-4xl font-semibold tabular-nums">{isLoading ? '—' : sections[key].length}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/soft text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </GlassCard>
        ))}
      </section>

      {upcoming && (
        <GlassCard className="mb-8 flex flex-col gap-4 border-accent/border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/tint text-accent">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Worth a look</p>
              <h2 className="mt-0.5 font-heading text-2xl font-semibold">{upcoming.name || upcoming.productName || 'Your next expiry'}</h2>
              <p className="text-sm text-muted-foreground">
                {daysUntil(upcoming.expiryDate) === 0 ? 'Expires today' : `Expires in ${daysUntil(upcoming.expiryDate)} days`}
              </p>
            </div>
          </div>
          <Link to={`/items/${upcoming.id}`} className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-accent transition hover:bg-accent/tint sm:self-auto">
            Review details <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </GlassCard>
      )}

      {error && (
        <GlassCard className="mb-8 border-destructive/strong">
          <p role="alert" className="font-semibold text-destructive">Your items could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <GlassButton variant="secondary" className="mt-4" onClick={() => refetch()}>Try again</GlassButton>
        </GlassCard>
      )}

      <div className="grid gap-10">
        {sectionDetails.map(({ key, title, description, Icon }) => (
          <section key={key} aria-labelledby={`section-${key}`}>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h2 id={`section-${key}`} className="font-heading text-3xl font-semibold">{title}</h2>
                  {!isLoading && <span className="rounded-full bg-primary/soft px-2.5 py-0.5 text-xs font-semibold tabular-nums">{sections[key].length}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <CardSkeleton /><CardSkeleton />
              </div>
            ) : sections[key].length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sections[key].map((item) => <WarrantyItemCard key={item.id} item={item} />)}
              </div>
            ) : (
              <GlassCard className="flex flex-col items-start gap-3 py-7 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Nothing here just yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {key === 'active' ? 'Add your first purchase to start building your vault.' : 'We’ll keep this space up to date as warranties change.'}
                  </p>
                </div>
                {key === 'active' && (
                  <GlassButton as={Link} to="/items/new" variant="secondary"><Plus className="h-4 w-4" aria-hidden="true" /> Add item</GlassButton>
                )}
              </GlassCard>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
