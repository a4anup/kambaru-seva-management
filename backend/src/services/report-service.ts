import type { TempleRepository } from "../repositories";
import type { ReportFilters, ReportGroupBy } from "../types";

// Filtering, grouping, counting, and pagination all happen in Postgres
// (report_query / report_export_rows) so the Reports page only ever pulls
// the slice it's about to render, plus an explicit, on-demand export query
// for CSV — never the whole register/directory on every page view.
export function createReportService(templeData: TempleRepository) {
  return {
    async query(input: ReportFilters & { groupBy: ReportGroupBy; page?: number; pageSize?: number }) {
      return templeData.queryReport({
        ...input,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 25,
      });
    },
    async exportRows(input: ReportFilters) {
      return templeData.exportReportRows(input);
    },
  };
}
