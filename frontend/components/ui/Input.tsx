import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    leadingIcon?: ReactNode;
    trailingAction?: ReactNode;
    className?: string;
  }
>(function Input({ leadingIcon, trailingAction, className = "", ...props }, ref) {
  return (
    <span className={`input-shell ${className}`.trim()}>
      {leadingIcon && <span className="input-leading" aria-hidden="true">{leadingIcon}</span>}
      <input
        {...props}
        ref={ref}
        className={`form-control ${leadingIcon ? "has-leading" : ""} ${trailingAction ? "has-trailing" : ""}`.trim()}
      />
      {trailingAction && <span className="input-trailing">{trailingAction}</span>}
    </span>
  );
});
