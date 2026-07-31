"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReportFilters, ReportGroupBy, ReportPage } from "@kambaru/backend";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PageFooter } from "@/components/PageFooter";
import { exportReportCsv, runReportQuery } from "@/app/reports/actions";
import { defaultReportFilters, REPORT_PAGE_SIZE } from "@/lib/reports";

function displayAnnualDate(row: { annualMonth: number; annualDay: number }) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" })
    .format(new Date(2028, row.annualMonth - 1, row.annualDay));
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

/** First/last page plus a small neighborhood around the current page, with "…"
 * gaps — keeps pagination on one line even across hundreds of pages. */
function paginationWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 1) return [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const window: Array<number | "…"> = [1];
  if (left > 2) window.push("…");
  for (let page = left; page <= right; page += 1) window.push(page);
  if (right < total - 1) window.push("…");
  window.push(total);
  return window;
}

export function ReportsWorkspace({
  initialFilters,
  initialPage,
}: {
  initialFilters: ReportFilters;
  initialPage: ReportPage;
}) {
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("date");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [reportPage, setReportPage] = useState(1);
  const [page, setPage] = useState<ReportPage>(initialPage);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    let cancelled = false;
    startTransition(() => {
      const load = async () => {
        const result = await runReportQuery({ ...filters, groupBy, page: reportPage, pageSize: REPORT_PAGE_SIZE });
        if (!cancelled) setPage(result);
      };
      void load();
    });
    return () => {
      cancelled = true;
    };
  }, [filters, groupBy, reportPage]);

  function update<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setReportPage(1);
  }

  async function exportCsv() {
    setIsExporting(true);
    try {
      const rows = await exportReportCsv(filters);
      const headers = ["Annual Date", "Devotee ID", "Devotee", "Beneficiary", "Relation", "Phone", "Rashi", "Nakshatra", "Gotra", "City", "State", "PIN", "Address Type", "Status"];
      const lines = rows.map((row) => [
        displayAnnualDate(row), row.devoteeNo, row.sponsorName, row.beneficiaryName, row.relation,
        row.phone ?? "", row.rashi, row.nakshatra, row.gotra, row.addressCity, row.state,
        row.postalCode, row.addressMode, row.status,
      ]);
      const csv = [headers, ...lines].map((line) => line.map(csvCell).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `shashwatha-pooja-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const reportPageCount = Math.max(1, Math.ceil(page.total / REPORT_PAGE_SIZE));
  const visibleReportPage = Math.min(reportPage, reportPageCount);

  return (
    <section className="dashboard-body reports-page">
      <div className="page-intro reports-intro">
        <div>
          <span className="eyebrow">Operations and exports</span>
          <h1>Reports</h1>
          <p>Filter the Shashwatha Pooja register, review grouped summaries, and export the exact records temple staff need.</p>
        </div>
        <Button onClick={exportCsv} disabled={page.total === 0 || isExporting}>
          <Download size={18} /> {isExporting ? "Preparing…" : "Export CSV"}
        </Button>
      </div>

      <section className="panel report-filter-panel">
        <header className="report-filter-header">
          <div><span className="resource-icon"><Filter size={19} /></span><div><h2>Report filters</h2><p>Combine any filters to narrow the report.</p></div></div>
          <div>
            <Button variant="ghost" onClick={() => { setFilters(defaultReportFilters()); setReportPage(1); }}><RotateCcw size={16} /> Reset</Button>
            <Button
              variant="outline"
              aria-controls="report-filter-fields"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showAdvanced ? "Hide filters" : "Expand filters"}
            </Button>
          </div>
        </header>

        {showAdvanced && (
          <div className="report-filter-grid" id="report-filter-fields">
            <FormField id="report-from" label="From annual date">
              <input className="form-control" id="report-from" type="date" value={filters.fromDate} onChange={(event) => update("fromDate", event.target.value)} />
            </FormField>
            <FormField id="report-to" label="To annual date">
              <input className="form-control" id="report-to" type="date" value={filters.toDate} onChange={(event) => update("toDate", event.target.value)} />
            </FormField>
            <FormField id="report-devotee" label="Devotee, beneficiary, ID or phone" className="report-search-field">
              <span className="modal-search-control"><Search size={17} /><input className="form-control" id="report-devotee" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Search name, DEV ID, or phone…" /></span>
            </FormField>
            <ReportSelect id="report-pincode" label="PIN code" value={filters.pincode ?? ""} values={page.filterOptions.pincodes} onChange={(value) => update("pincode", value)} />
            <ReportSelect id="report-state" label="State" value={filters.state ?? ""} values={page.filterOptions.states} onChange={(value) => update("state", value)} />
            <ReportSelect id="report-rashi" label="Rashi" value={filters.rashi ?? ""} values={page.filterOptions.rashis} onChange={(value) => update("rashi", value)} />
            <ReportSelect id="report-gotra" label="Gotra" value={filters.gotra ?? ""} values={page.filterOptions.gotras} onChange={(value) => update("gotra", value)} />
            <ReportSelect id="report-nakshatra" label="Nakshatra" value={filters.nakshatra ?? ""} values={page.filterOptions.nakshatras} onChange={(value) => update("nakshatra", value)} />
            <ReportSelect id="report-relation" label="Beneficiary relation" value={filters.relation ?? ""} values={["Self", "Son", "Daughter", "Wife", "Husband", "Father", "Mother", "Other"]} onChange={(value) => update("relation", value)} />
            <ReportSelect id="report-address" label="Address type" value={filters.addressMode ?? ""} values={["devotee_primary", "custom"]} labels={{ devotee_primary: "Devotee primary", custom: "Custom address" }} onChange={(value) => update("addressMode", value)} />
            <ReportSelect id="report-status" label="Enrollment status" value={filters.status ?? ""} values={["active", "paused", "cancelled"]} onChange={(value) => update("status", value)} />
            <ReportSelect id="report-group" label="Group summary by" value={groupBy} values={["date", "pincode", "devotee", "rashi", "gotra", "nakshatra", "state"]} onChange={(value) => setGroupBy(value as ReportGroupBy)} />
          </div>
        )}
      </section>

      <div className="report-metric-grid">
        <ReportMetric icon={Sparkles} label="Matching Poojas" value={page.total} />
        <ReportMetric icon={Users} label="Devotees" value={page.uniqueDevotees} />
        <ReportMetric icon={CalendarDays} label="Active Enrollments" value={page.activeCount} />
        <ReportMetric icon={MapPin} label="Needs Attention" value={page.incompleteCount} warning />
      </div>

      <div className="report-content-grid">
        <section className="panel report-group-panel">
          <header><div><span className="eyebrow">Summary</span><h2>Grouped by {groupBy}</h2></div><span>{page.groups.length} groups</span></header>
          <div className="report-groups">
            {page.groups.length === 0 ? <p>No grouped results.</p> : page.groups.map((group) => (
              <div key={group.label}><span>{group.label}</span><strong>{group.count}</strong></div>
            ))}
          </div>
        </section>

        <section className="panel report-results-panel">
          <header><div><span className="eyebrow">Detailed report</span><h2>Matching records</h2></div><span>{isPending ? "Loading…" : `${page.total} records`}</span></header>
          <div className="report-table-wrap">
            <table>
              <thead><tr><th>Every Year</th><th>Devotee</th><th>Beneficiary</th><th>Phone</th><th>Spiritual Details</th><th>Location</th></tr></thead>
              <tbody>
                {page.items.length === 0 ? (
                  <tr><td colSpan={6} className="report-empty">{isPending ? "Loading…" : "No records match these filters."}</td></tr>
                ) : page.items.map((row) => (
                  <tr key={row.enrollmentId}>
                    <td>{displayAnnualDate(row)}</td>
                    <td><strong>{row.sponsorName}</strong><small>{row.devoteeNo}</small></td>
                    <td>{row.relation === "Self" ? "Self" : row.beneficiaryName}<small>{row.relation}</small></td>
                    <td>{row.phone ?? "Not provided"}</td>
                    <td>{[row.rashi, row.nakshatra, row.gotra].filter(Boolean).join(" · ") || "Not provided"}</td>
                    <td>{[row.addressCity, row.state, row.postalCode].filter(Boolean).join(", ") || "Not provided"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page.total > REPORT_PAGE_SIZE && (
            <nav className="list-pagination report-pagination" aria-label="Report result pages">
              <span>
                Showing {(visibleReportPage - 1) * REPORT_PAGE_SIZE + 1}–{Math.min(visibleReportPage * REPORT_PAGE_SIZE, page.total)} of {page.total}
              </span>
              <div>
                <Button variant="outline" disabled={visibleReportPage === 1} onClick={() => setReportPage(visibleReportPage - 1)}>
                  <ChevronLeft size={16} /> Previous
                </Button>
                {paginationWindow(visibleReportPage, reportPageCount).map((item, index) => (
                  item === "…" ? (
                    <span className="list-pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span>
                  ) : (
                    <Button
                      aria-label={`Show report page ${item}`}
                      aria-current={visibleReportPage === item ? "page" : undefined}
                      key={item}
                      variant={visibleReportPage === item ? "primary" : "ghost"}
                      onClick={() => setReportPage(item)}
                    >
                      {item}
                    </Button>
                  )
                ))}
                <Button variant="outline" disabled={visibleReportPage === reportPageCount} onClick={() => setReportPage(visibleReportPage + 1)}>
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            </nav>
          )}
        </section>
      </div>

      <PageFooter />
    </section>
  );
}

function ReportSelect({
  id,
  label,
  value,
  values,
  labels = {},
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  values: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={id} label={label}>
      <select className="form-control" id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {values.map((item) => <option value={item} key={item}>{labels[item] ?? item}</option>)}
      </select>
    </FormField>
  );
}

function ReportMetric({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <article className={`panel report-metric ${warning ? "warning" : ""}`}>
      <span><Icon size={19} /></span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  );
}
