import { forwardRef } from 'react';

export const GlassInput = forwardRef(function GlassInput(
  { label, id, hint, error, className = '', as: Element = 'input', ...props },
  ref,
) {
  const inputId = id || props.name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-foreground" htmlFor={inputId}>
          {label}
        </label>
      )}
      <Element
        ref={ref}
        id={inputId}
        className={`glass-input w-full min-h-11 rounded-lg px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground ${error ? 'border-destructive' : ''} ${className}`}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
});
