import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function QuickActions({ actions, className = "" }: { actions: QuickAction[]; className?: string }) {
  return (
    <section className={`panel quick-panel ${className}`.trim()}>
      <div className="panel-header compact"><h3>Quick Actions</h3></div>
      <div className="quick-grid">
        {actions.map(({ label, href, icon: Icon }) => (
          <Link className="quick-action" key={label} href={href}>
            <Icon size={26} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
