import type { InputHTMLAttributes, ReactNode } from "react";

export function FormField({
  id,
  label,
  help,
  error,
  className = "",
  children,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  help?: string;
  error?: string;
  className?: string;
  children?: ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`form-field ${className}`.trim()}>
      <label className="form-label" htmlFor={id}>{label}</label>
      {children ?? (
        <input
          {...inputProps}
          id={id}
          className="form-control"
          aria-invalid={Boolean(error)}
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        />
      )}
      {help && <span className="form-help" id={helpId}>{help}</span>}
      {error && <span className="form-error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}
