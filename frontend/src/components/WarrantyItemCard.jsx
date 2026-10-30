import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Tag } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { GlassChip } from './ui/GlassChip';
import { daysUntil, formatCurrency, formatDate, getWarrantyStatus } from '../lib/format';

export function WarrantyItemCard({ item }) {
  const status = getWarrantyStatus(item);
  const days = daysUntil(item.expiryDate);
  const countdown =
    days === null
      ? 'Expiry date not set'
      : days < 0
        ? `Expired ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`
        : days === 0
          ? 'Expires today'
          : `${days} ${days === 1 ? 'day' : 'days'} left`;

  return (
    <GlassCard className="group h-full transition duration-glass hover:-translate-y-0.5">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {item.category || item.brand || 'Household item'}
            </p>
            <h3 className="line-clamp-2 font-heading text-2xl font-semibold leading-tight">{item.name || item.productName || 'Untitled item'}</h3>
            {item.brand && item.name && <p className="mt-1 text-sm text-muted-foreground">{item.brand}</p>}
          </div>
          <GlassChip status={status} className="shrink-0" />
        </div>

        <div className="my-5 grid grid-cols-2 gap-3 border-y border-primary/soft py-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Purchase date
            </p>
            <p className="text-sm font-semibold">{formatDate(item.purchaseDate)}</p>
          </div>
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              Purchase price
            </p>
            <p className="truncate text-sm font-semibold">{formatCurrency(item.purchasePrice)}</p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Warranty expires</p>
            <p className="font-semibold">{formatDate(item.expiryDate)}</p>
            <p className={`mt-0.5 text-xs ${status === 'expired' ? 'text-destructive' : 'text-muted-foreground'}`}>{countdown}</p>
          </div>
          <Link
            to={`/items/${item.id}`}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-accent transition hover:bg-accent/tint"
            aria-label={`View ${item.name || 'item'} details`}
          >
            Details
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
