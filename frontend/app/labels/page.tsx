import { AppShell } from "@/components/AppShell";
import { LabelGenerator } from "@/components/labels/LabelGenerator";
import { getBackendServices } from "@/lib/server/backend";

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function isDateString(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; from?: string; to?: string }>;
}) {
  const { mode, date, from, to } = await searchParams;
  const services = await getBackendServices();
  const today = todayInputValue();

  if (mode === "all" || mode === "devotees" || mode === "beneficiaries") {
    const initialRecipients = await services.labels.listInvitation(mode);
    return (
      <AppShell title="Generate Labels">
        <LabelGenerator initialRecipients={initialRecipients} initialDate={today} initialChoice={mode} />
      </AppShell>
    );
  }

  if (mode === "range" && isDateString(from) && isDateString(to)) {
    const initialRecipients = await services.labels.listForDate({ mode: "range", rangeFrom: from, rangeTo: to });
    return (
      <AppShell title="Generate Labels">
        <LabelGenerator
          initialRecipients={initialRecipients}
          initialDate={today}
          initialChoice="range"
          initialRangeFrom={from}
          initialRangeTo={to}
        />
      </AppShell>
    );
  }

  if (mode === "tomorrow") {
    const [year, month, day] = today.split("-").map(Number);
    const tomorrowValue = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    const initialRecipients = await services.labels.listForDate({ mode: "tomorrow", date: tomorrowValue });
    return (
      <AppShell title="Generate Labels">
        <LabelGenerator initialRecipients={initialRecipients} initialDate={today} initialChoice="tomorrow" />
      </AppShell>
    );
  }

  if (mode === "custom" && isDateString(date)) {
    const initialRecipients = await services.labels.listForDate({ mode: "custom", date });
    return (
      <AppShell title="Generate Labels">
        <LabelGenerator
          initialRecipients={initialRecipients}
          initialDate={today}
          initialChoice="custom"
          initialCustomDate={date}
        />
      </AppShell>
    );
  }

  const initialRecipients = await services.labels.listForDate({ mode: "today", date: today });
  return (
    <AppShell title="Generate Labels">
      <LabelGenerator initialRecipients={initialRecipients} initialDate={today} />
    </AppShell>
  );
}
