import type { HTMLAttributes } from 'react';
import { StatusStamp, type WarrantyStatus } from '@/components/StatusStamp';

interface ReceiptSlipProps extends HTMLAttributes<HTMLElement> {
  name: string;
  brand: string;
  amount: string;
  status: WarrantyStatus;
  statusLabel: string;
}

export function ReceiptSlip({
  name,
  brand,
  amount,
  status,
  statusLabel,
  className = '',
  ...props
}: ReceiptSlipProps) {
  return (
    <article className={`receipt-slip ${className}`.trim()} {...props}>
      <div className="receipt-slip-content">
        <div className="receipt-slip-copy">
          <p className="receipt-slip-brand">{brand}</p>
          <h3>{name}</h3>
        </div>
        <div className="receipt-slip-meta">
          <p className="receipt-slip-amount">{amount}</p>
          <StatusStamp status={status} label={statusLabel} />
        </div>
      </div>
    </article>
  );
}
