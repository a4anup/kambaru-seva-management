import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

export interface UpcomingPooja {
  day: string;
  month: string;
  weekday: string;
  count: number;
  label: string;
  date: string;
}

export function UpcomingPoojas({ items, className = "" }: { items: UpcomingPooja[]; className?: string }) {
  return (
    <section className={`panel upcoming-panel ${className}`.trim()}>
      <div className="panel-header compact">
        <h3>Upcoming Poojas</h3>
        <Link className="secondary-button small" href="/poojas"><CalendarDays size={15} /> View Calendar</Link>
      </div>
      <div className="upcoming-list">
        {items.map((item) => (
          <Link className="upcoming-item" key={item.label} href={`/poojas?date=${item.date}`}>
            <span className="date-chip"><strong>{item.day}</strong><small>{item.month}</small><em>{item.weekday}</em></span>
            <span className="upcoming-copy"><strong>{item.count} Poojas</strong><small>{item.label}</small></span>
            <ChevronRight size={18} />
          </Link>
        ))}
      </div>
      <Link className="text-button centered" href="/poojas">View All Upcoming <ChevronRight size={16} /></Link>
    </section>
  );
}
