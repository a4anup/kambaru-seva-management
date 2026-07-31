import type { ReportFilters } from "@kambaru/backend";

export const REPORT_PAGE_SIZE = 25;

export function defaultReportFilters(): ReportFilters {
  const year = new Date().getFullYear();
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
    search: "",
    pincode: "",
    state: "",
    rashi: "",
    gotra: "",
    nakshatra: "",
    relation: "",
    addressMode: "",
    status: "",
  };
}
