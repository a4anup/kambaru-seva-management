import type { LucideIcon } from "lucide-react";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge, type DisplayStatus } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export interface ResourceRow {
  primary: string;
  secondary: string;
  detail: string;
  status: DisplayStatus;
}

export function ResourcePage({
  title,
  eyebrow,
  description,
  actionLabel,
  icon: Icon,
  rows,
  className = "",
}: {
  title: string;
  eyebrow: string;
  description: string;
  actionLabel: string;
  icon: LucideIcon;
  rows: ResourceRow[];
  className?: string;
}) {
  return (
    <AppShell title={title}>
      <section className={`dashboard-body resource-page ${className}`.trim()}>
        <div className="page-intro">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <Button><Plus size={18} /> {actionLabel}</Button>
        </div>
        <Card className="panel">
          <div className="resource-toolbar">
            <label className="resource-search">
              <Search size={17} />
              <input aria-label={`Search ${title}`} placeholder={`Search ${title.toLowerCase()}…`} />
            </label>
            <span>{rows.length} records</span>
          </div>
          <div className="resource-list">
            {rows.map((row) => (
              <article className="resource-row" key={`${row.primary}-${row.detail}`}>
                <span className="resource-icon"><Icon size={20} /></span>
                <div><strong>{row.primary}</strong><small>{row.secondary}</small></div>
                <p>{row.detail}</p>
                <StatusBadge status={row.status} />
              </article>
            ))}
          </div>
        </Card>
        <footer className="page-footer"><span /> Kambaru Sri Durgaparameshwari Temple <span /></footer>
      </section>
    </AppShell>
  );
}
