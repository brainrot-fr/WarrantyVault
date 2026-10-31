import type { HTMLAttributes } from 'react';

export type WarrantyStatus = 'active' | 'expiring' | 'expired';

interface StatusStampProps extends HTMLAttributes<HTMLSpanElement> {
  status: WarrantyStatus;
  label: string;
}

export function StatusStamp({ status, label, className = '', ...props }: StatusStampProps) {
  return (
    <span
      className={`status-stamp status-stamp-${status} ${className}`.trim()}
      {...props}
    >
      {label}
    </span>
  );
}
