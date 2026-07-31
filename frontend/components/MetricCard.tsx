import type { LucideIcon } from "lucide-react";

export type MetricTone = "orange" | "amber" | "red" | "green" | "purple";

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  className = "",
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone: MetricTone;
  className?: string;
}) {
  return (
    <article className={`metric-card ui-card ${className}`.trim()}>
      <div className={`metric-icon tone-${tone}`}><Icon size={28} /></div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong className={`value tone-text-${tone}`}>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}
