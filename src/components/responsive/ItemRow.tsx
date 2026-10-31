export interface ItemRowProps {
  name: string;
  detail: string;
  amount?: string;
  status: string;
  statusTone?: 'active' | 'expiring' | 'expired';
  onClick?: () => void;
}

export function ItemRow({ name, detail, amount, status, statusTone = 'active', onClick }: ItemRowProps) {
  return (
    <button className="item-row" type="button" onClick={onClick}>
      <span className="item-row-main">
        <strong>{name}</strong>
        <span>{detail}</span>
      </span>
      {amount && <span className="item-row-amount">{amount}</span>}
      <span className={`status-pill status-${statusTone}`}>{status}</span>
    </button>
  );
}
