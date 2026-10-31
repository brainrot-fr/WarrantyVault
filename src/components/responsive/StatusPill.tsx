interface StatusPillProps {
  label: string;
  tone?: 'active' | 'expiring' | 'expired' | 'neutral';
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}
