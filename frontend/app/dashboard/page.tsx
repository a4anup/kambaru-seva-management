import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  ContactRound,
  HandCoins,
  PlusCircle,
  Printer,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricCard, type MetricTone } from "@/components/MetricCard";
import { QuickActions } from "@/components/QuickActions";
import { TodayPoojaTable } from "@/components/TodayPoojaTable";
import { UpcomingPoojas, type UpcomingPooja } from "@/components/UpcomingPoojas";
import { PageFooter } from "@/components/PageFooter";
import { getBackendServices } from "@/lib/server/backend";
import { formatDisplayDate } from "@/lib/date-format";

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
  const todayValue = dateInputValue(today);
  const [summary, todayPage, donationSummary] = await Promise.all([
    services.enrollments.getDashboardSummary(todayValue),
    services.enrollments.listRegisterPage({ mode: "today", date: todayValue, page: 1, pageSize: 10 }),
    services.donationGroups.list360({ page: 1, pageSize: 1 }),
  ]);

  const todayRows = todayPage.items.map((row) => ({
    enrollmentId: row.enrollmentId,
    beneficiaryName: row.beneficiaryName,
    relation: row.relation,
    sponsorName: row.sponsorName,
    phone: row.phone,
    addressLine: row.addressLine || "No address on file",
    addressSub: [row.addressCity, row.postalCode].filter(Boolean).join(" "),
    isCustomAddress: row.addressMode === "custom",
    hasException: row.hasException,
    exceptionNote: row.exceptionNote,
    notes: row.notes,
  }));

  const missingFieldsSummary = [
    summary.missingPhoneCount > 0 && `${summary.missingPhoneCount} phone ${summary.missingPhoneCount === 1 ? "number" : "numbers"} missing`,
    summary.missingPincodeCount > 0 && `${summary.missingPincodeCount} PIN ${summary.missingPincodeCount === 1 ? "code" : "codes"} missing`,
    summary.missingAddressCount > 0 && `${summary.missingAddressCount} ${summary.missingAddressCount === 1 ? "address" : "addresses"} missing`,
  ].filter((part): part is string => Boolean(part)).join(", ");

  const countByDate = new Map(summary.dailyCounts.map((item) => [item.date, item.count]));
  const upcoming: UpcomingPooja[] = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index + 1);
    const value = dateInputValue(date);
    return {
      day: dateLabel(date, { day: "2-digit" }),
      month: dateLabel(date, { month: "short" }).toUpperCase(),
      weekday: dateLabel(date, { weekday: "short" }),
      count: countByDate.get(value) ?? 0,
      label: formatDisplayDate(date),
      date: dateInputValue(date),
    };
  });

  const metrics: Array<{
    label: string;
    value: string | number;
    helper: string;
    icon: typeof CalendarDays;
    tone: MetricTone;
  }> = [
    { label: "Today's Poojas", value: summary.todayCount, helper: "Poojas scheduled for today", icon: CalendarDays, tone: "orange" },
    { label: "Active Poojas", value: summary.activeCount, helper: "All active pooja enrollments", icon: Sparkles, tone: "red" },
    { label: "Total Devotees", value: summary.devoteeCount, helper: "Registered devotees", icon: Users, tone: "green" },
    { label: "Total Donations", value: donationSummary.totalDonations.toLocaleString("en-IN"), helper: "Recorded donation transactions", icon: HandCoins, tone: "amber" },
    { label: "Donation Amount", value: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(donationSummary.totalAmountMinor / 100), helper: "Total recorded contributions", icon: CircleDollarSign, tone: "purple" },
  ];

  const actions = [
    { label: "Add Devotee", href: "/devotees", icon: PlusCircle },
    { label: "Add Pooja", href: "/poojas", icon: CalendarDays },
    { label: "Today's Poojas", href: "/poojas", icon: ClipboardList },
    { label: "This Week View", href: "/poojas", icon: CalendarDays },
    { label: "Generate Labels", href: "/labels", icon: Printer },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Donation 360", href: "/donations/360", icon: ContactRound },
    { label: "Donation List", href: "/donations/list", icon: CircleDollarSign },
  ];

  return (
    <AppShell title="Dashboard">
      <section className="dashboard-body">
        <div className="devotional-ambience" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
        </div>
        <div className="dashboard-metric-groups">
          <div className="metric-grid dashboard-temple-metrics">
            {metrics.slice(0, 3).map((metric) => <MetricCard key={metric.label} {...metric} />)}
          </div>
          <section className="dashboard-donation-metrics" aria-labelledby="dashboard-donations-heading">
            <div className="dashboard-donation-metrics-title"><HandCoins size={17}/><span id="dashboard-donations-heading">Donations</span></div>
            <div className="metric-grid">
              {metrics.slice(3).map((metric) => <MetricCard key={metric.label} {...metric} />)}
            </div>
          </section>
        </div>
        <QuickActions actions={actions} className="dashboard-quick-actions" />
        <div className="dashboard-grid">
          <TodayPoojaTable
            rows={todayRows}
            dateLabel={formatDisplayDate(today)}
            missingFieldsSummary={missingFieldsSummary}
          />
          <aside className="right-column">
            <UpcomingPoojas items={upcoming} />
          </aside>
        </div>
        <PageFooter />
      </section>
    </AppShell>
  );
}
