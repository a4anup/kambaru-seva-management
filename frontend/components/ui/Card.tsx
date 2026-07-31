import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { className?: string; children: ReactNode }) {
  return <section className={`ui-card ${className}`.trim()} {...props}>{children}</section>;
}
