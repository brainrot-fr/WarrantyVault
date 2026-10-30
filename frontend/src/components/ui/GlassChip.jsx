import { AlertTriangle, Check, Clock3 } from 'lucide-react';

const statusDetails = {
  active: { label: 'Active', icon: Check },
  expiring: { label: 'Expiring Soon', icon: Clock3 },
  expired: { label: 'Expired', icon: AlertTriangle },
};

export function GlassChip({ status = 'active', children, className = '' }) {
  const detail = statusDetails[status] || statusDetails.active;
  const Icon = detail.icon;
  return (
    <span className={`status-chip status-${status} inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-5 ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="whitespace-normal">{children || detail.label}</span>
    </span>
  );
}
