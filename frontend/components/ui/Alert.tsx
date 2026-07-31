import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Alert({
  children,
  icon: Icon,
  tone = "danger",
  className = "",
  role = "alert",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: "danger" | "info" | "warning";
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div className={`ui-alert ui-alert-${tone} ${className}`.trim()} role={role}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}
