import { LoaderCircle } from 'lucide-react';

const variants = {
  primary: 'button-primary bg-accent shadow-md hover:brightness-105',
  secondary: 'border border-primary/border bg-transparent text-foreground hover:bg-primary/soft',
  ghost: 'text-foreground hover:bg-primary/soft',
  danger: 'button-danger bg-destructive hover:brightness-105',
};

export function GlassButton({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled = false,
  as: Element = 'button',
  type = 'button',
  ...props
}) {
  return (
    <Element
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition duration-glass hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${variants[variant]} ${className}`}
      {...(Element === 'button' ? { type, disabled: loading || disabled } : { 'aria-disabled': loading || disabled || undefined })}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Element>
  );
}
