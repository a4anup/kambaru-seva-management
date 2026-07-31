import { AppShell } from "@/components/AppShell";
import { PoojaRegister } from "@/components/poojas/PoojaRegister";
import { getBackendServices } from "@/lib/server/backend";

export default async function PoojasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const services = await getBackendServices();
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const initialMode = date ? "custom" as const : "today" as const;
  const parsedDate = new Date(`${initialDate}T00:00:00`);
  const [initialPage, initialCalendarCounts, devoteePage] = await Promise.all([
    services.enrollments.listRegisterPage({ mode: initialMode, date: initialDate, page: 1, pageSize: 10 }),
    services.enrollments.getCalendarCounts(parsedDate.getFullYear(), parsedDate.getMonth() + 1),
    services.devotees.listDirectoryPage({ page: 1, pageSize: 10 }),
  ]);
  return (
    <AppShell title="Poojas">
      <PoojaRegister
        initialPage={initialPage}
        initialCalendarCounts={initialCalendarCounts}
        devotees={devoteePage.items}
        beneficiaries={[]}
        initialDate={date}
      />
    </AppShell>
  );
}
