import { AppShell } from "@/components/AppShell";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";
import { getBackendServices } from "@/lib/server/backend";
import { defaultReportFilters, REPORT_PAGE_SIZE } from "@/lib/reports";

export default async function ReportsPage() {
  const services = await getBackendServices();
  const filters = defaultReportFilters();
  const initialPage = await services.reports.query({
    ...filters,
    groupBy: "date",
    page: 1,
    pageSize: REPORT_PAGE_SIZE,
  });
  return (
    <AppShell title="Reports">
      <ReportsWorkspace initialFilters={filters} initialPage={initialPage} />
    </AppShell>
  );
}
