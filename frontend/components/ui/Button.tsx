import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type={type} className={`ui-button ui-button-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
