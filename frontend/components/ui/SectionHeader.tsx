import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`section-header ${className}`.trim()}>
      <div>
        <h3>{title}</h3>
        {description && <span>{description}</span>}
      </div>
      {actions}
    </div>
  );
}
