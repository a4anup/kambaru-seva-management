import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = "",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <Icon size={30} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}
