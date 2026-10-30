import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export function GlassToast({ id, message, variant, onDismiss }) {
  const Icon = variant === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      key={id}
      role={variant === 'error' ? 'alert' : 'status'}
      className="glass-surface flex items-start gap-3 rounded-xl p-4 shadow-lg"
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${variant === 'error' ? 'text-destructive' : 'text-green-700 dark:text-green-300'}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words text-sm font-medium">{message}</p>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-primary/soft"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
