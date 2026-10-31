import type { ReactNode } from 'react';

interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  error?: ReactNode;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
