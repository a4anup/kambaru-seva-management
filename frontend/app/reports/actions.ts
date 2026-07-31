"use server";

import type { ReportFilters, ReportGroupBy, ReportPage } from "@kambaru/backend";
import { getBackendServices } from "@/lib/server/backend";

export async function runReportQuery(
  input: ReportFilters & { groupBy: ReportGroupBy; page: number; pageSize: number },
): Promise<ReportPage> {
  const { reports } = await getBackendServices();
  return reports.query(input);
}

export async function exportReportCsv(input: ReportFilters): Promise<ReportPage["items"]> {
  const { reports } = await getBackendServices();
  return reports.exportRows(input);
}
