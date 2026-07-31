import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileDown,
  PlusCircle,
  Printer,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricCard, type MetricTone } from "@/components/MetricCard";
import { QuickActions } from "@/components/QuickActions";
import { TodayPoojaTable } from "@/components/TodayPoojaTable";
import { UpcomingPoojas, type UpcomingPooja } from "@/components/UpcomingPoojas";
import { getBackendServices } from "@/lib/server/backend";

function dateLabel(date: Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    ...options,
  }).format(date);
}

function dateInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default async function DashboardPage() {
  const services = await getBackendServices();
  const today = new Date();
  const monday = services.enrollments.mondayOfWeek(today);
  const [todayRows, weekCount, directory, register] = await Promise.all([
    services.enrollments.listByDate(today),
    services.enrollments.countInRange(monday, 7),
    services.devotees.listDirectory(),
    services.enrollments.listRegister(),
  ]);

  const upcoming: UpcomingPooja[] = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index + 1);
    return {
      day: dateLabel(date, { day: "2-digit" }),
      month: dateLabel(date, { month: "short" }).toUpperCase(),
      weekday: dateLabel(date, { weekday: "short" }),
      count: await services.enrollments.countByDate(date),
      label: dateLabel(date, { weekday: "long", day: "2-digit", month: "short", year: "numeric" }),
      date: dateInputValue(date),
    };
  }));

  const metrics: Array<{
    label: string;
    value: string | number;
    helper: string;
    icon: typeof CalendarDays;
    tone: MetricTone;
  }> = [
    { label: "Today's Poojas", value: todayRows.length, helper: "Poojas scheduled for today", icon: CalendarDays, tone: "orange" },
    { label: "This Week Poojas", value: weekCount, helper: "Poojas this week", icon: ClipboardList, tone: "amber" },
    { label: "Active Poojas", value: register.filter((pooja) => pooja.status === "active").length, helper: "All active pooja enrollments", icon: Sparkles, tone: "red" },
    { label: "Total Devotees", value: directory.length, helper: "Registered devotees", icon: Users, tone: "green" },
    { label: "Labels Ready", value: todayRows.length, helper: "Available for today's poojas", icon: Printer, tone: "purple" },
  ];

  const actions = [
    { label: "Add Devotee", href: "/devotees", icon: PlusCircle },
    { label: "Add Pooja", href: "/poojas", icon: CalendarDays },
    { label: "Today's Poojas", href: "/poojas", icon: ClipboardList },
    { label: "This Week View", href: "/poojas", icon: CalendarDays },
    { label: "Generate Labels", href: "/labels", icon: Printer },
    { label: "Export to CSV", href: "/reports", icon: FileDown },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Search Devotee", href: "/devotees", icon: Search },
  ];

  return (
    <AppShell title="Dashboard">
      <section className="dashboard-body">
        <div className="metric-grid">
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </div>
        <QuickActions actions={actions} className="dashboard-quick-actions" />
        <div className="dashboard-grid">
          <TodayPoojaTable
            rows={todayRows}
            dateLabel={dateLabel(today, { day: "2-digit", month: "short", year: "numeric", weekday: "long" })}
          />
          <aside className="right-column">
            <UpcomingPoojas items={upcoming} />
          </aside>
        </div>
        <footer className="page-footer"><span /> Kambaru Sri Durgaparameshwari Temple <span /></footer>
      </section>
    </AppShell>
  );
}
