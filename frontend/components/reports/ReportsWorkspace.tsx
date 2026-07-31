"use client";

import { useMemo, useState } from "react";
import type { DevoteeDirectoryRow, PoojaRegisterRow } from "@kambaru/backend";
import {
  BarChart3,
  CalendarDays,
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

type GroupBy = "date" | "pincode" | "devotee" | "rashi" | "gotra" | "nakshatra" | "state";

interface Filters {
  fromDate: string;
  toDate: string;
  devotee: string;
  pincode: string;
  state: string;
  rashi: string;
  gotra: string;
  nakshatra: string;
  relation: string;
  addressMode: string;
  status: string;
}

function yearBoundary(month: number, day: number) {
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function initialFilters(): Filters {
  const year = new Date().getFullYear();
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
    devotee: "",
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

function displayAnnualDate(row: PoojaRegisterRow) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" })
    .format(new Date(2028, row.annualMonth - 1, row.annualDay));
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function ReportsWorkspace({
  poojas,
  devotees,
}: {
  poojas: PoojaRegisterRow[];
  devotees: DevoteeDirectoryRow[];
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [showAdvanced, setShowAdvanced] = useState(true);

  const records = useMemo(() => poojas.map((pooja) => {
    const devotee = devotees.find((item) => item.fullName === pooja.sponsorName);
    return {
      ...pooja,
      devoteeNo: devotee?.devoteeNo ?? "—",
      rashi: pooja.beneficiaryRashi || devotee?.rashi || "",
      nakshatra: pooja.beneficiaryNakshatra || devotee?.nakshatra || "",
      gotra: pooja.beneficiaryGotra || devotee?.gotra || "",
      state: pooja.addressState || devotee?.state || "",
    };
  }), [devotees, poojas]);

  const options = useMemo(() => ({
    states: unique(records.map((row) => row.state)),
    rashis: unique(records.map((row) => row.rashi)),
    gotras: unique(records.map((row) => row.gotra)),
    nakshatras: unique(records.map((row) => row.nakshatra)),
    pincodes: unique(records.map((row) => row.postalCode)),
  }), [records]);

  const filtered = useMemo(() => {
    const query = filters.devotee.trim().toLocaleLowerCase();
    return records.filter((row) => {
      const annualDate = yearBoundary(row.annualMonth, row.annualDay);
      return (
        (!filters.fromDate || annualDate >= filters.fromDate) &&
        (!filters.toDate || annualDate <= filters.toDate) &&
        (!query || [row.sponsorName, row.beneficiaryName, row.devoteeNo, row.phone ?? ""]
          .some((value) => value.toLocaleLowerCase().includes(query))) &&
        (!filters.pincode || row.postalCode === filters.pincode) &&
        (!filters.state || row.state === filters.state) &&
        (!filters.rashi || row.rashi === filters.rashi) &&
        (!filters.gotra || row.gotra === filters.gotra) &&
        (!filters.nakshatra || row.nakshatra === filters.nakshatra) &&
        (!filters.relation || row.relation === filters.relation) &&
        (!filters.addressMode || row.addressMode === filters.addressMode) &&
        (!filters.status || row.status === filters.status)
      );
    });
  }, [filters, records]);

  const grouped = useMemo(() => {
    const groups = new Map<string, number>();
    filtered.forEach((row) => {
      const keyByMode: Record<GroupBy, string> = {
        date: displayAnnualDate(row),
        pincode: row.postalCode || "Missing PIN",
        devotee: row.sponsorName,
        rashi: row.rashi || "Not provided",
        gotra: row.gotra || "Not provided",
        nakshatra: row.nakshatra || "Not provided",
        state: row.state || "Not provided",
      };
      const key = keyByMode[groupBy];
      groups.set(key, (groups.get(key) ?? 0) + 1);
    });
    return [...groups.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  const activeCount = filtered.filter((row) => row.status === "active").length;
  const uniqueDevotees = new Set(filtered.map((row) => row.sponsorName)).size;
  const incomplete = filtered.filter((row) => row.hasException).length;

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function exportCsv() {
    const headers = ["Annual Date", "Devotee ID", "Devotee", "Beneficiary", "Relation", "Phone", "Rashi", "Nakshatra", "Gotra", "City", "State", "PIN", "Address Type", "Status"];
    const lines = filtered.map((row) => [
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
  }

  return (
    <section className="dashboard-body reports-page">
      <div className="page-intro reports-intro">
        <div>
          <span className="eyebrow">Operations and exports</span>
          <h1>Reports</h1>
          <p>Filter the Shashwatha Pooja register, review grouped summaries, and export the exact records temple staff need.</p>
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0}><Download size={18} /> Export CSV</Button>
      </div>

      <section className="panel report-filter-panel">
        <header className="report-filter-header">
          <div><span className="resource-icon"><Filter size={19} /></span><div><h2>Report filters</h2><p>Combine any filters to narrow the report.</p></div></div>
          <div>
            <Button variant="ghost" onClick={() => setFilters(initialFilters())}><RotateCcw size={16} /> Reset</Button>
            <Button variant="outline" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "Hide filters" : "Show filters"}</Button>
          </div>
        </header>

        {showAdvanced && (
          <div className="report-filter-grid">
            <FormField id="report-from" label="From annual date">
              <input className="form-control" id="report-from" type="date" value={filters.fromDate} onChange={(event) => update("fromDate", event.target.value)} />
            </FormField>
            <FormField id="report-to" label="To annual date">
              <input className="form-control" id="report-to" type="date" value={filters.toDate} onChange={(event) => update("toDate", event.target.value)} />
            </FormField>
            <FormField id="report-devotee" label="Devotee, beneficiary, ID or phone" className="report-search-field">
              <span className="modal-search-control"><Search size={17} /><input className="form-control" id="report-devotee" value={filters.devotee} onChange={(event) => update("devotee", event.target.value)} placeholder="Search name, DEV ID, or phone…" /></span>
            </FormField>
            <ReportSelect id="report-pincode" label="PIN code" value={filters.pincode} values={options.pincodes} onChange={(value) => update("pincode", value)} />
            <ReportSelect id="report-state" label="State" value={filters.state} values={options.states} onChange={(value) => update("state", value)} />
            <ReportSelect id="report-rashi" label="Rashi" value={filters.rashi} values={options.rashis} onChange={(value) => update("rashi", value)} />
            <ReportSelect id="report-gotra" label="Gotra" value={filters.gotra} values={options.gotras} onChange={(value) => update("gotra", value)} />
            <ReportSelect id="report-nakshatra" label="Nakshatra" value={filters.nakshatra} values={options.nakshatras} onChange={(value) => update("nakshatra", value)} />
            <ReportSelect id="report-relation" label="Beneficiary relation" value={filters.relation} values={["Self", "Son", "Daughter", "Wife", "Husband", "Father", "Mother", "Other"]} onChange={(value) => update("relation", value)} />
            <ReportSelect id="report-address" label="Address type" value={filters.addressMode} values={["devotee_primary", "custom"]} labels={{ devotee_primary: "Devotee primary", custom: "Custom address" }} onChange={(value) => update("addressMode", value)} />
            <ReportSelect id="report-status" label="Enrollment status" value={filters.status} values={["active", "paused", "cancelled"]} onChange={(value) => update("status", value)} />
            <ReportSelect id="report-group" label="Group summary by" value={groupBy} values={["date", "pincode", "devotee", "rashi", "gotra", "nakshatra", "state"]} onChange={(value) => setGroupBy(value as GroupBy)} />
          </div>
        )}
      </section>

      <div className="report-metric-grid">
        <ReportMetric icon={Sparkles} label="Matching Poojas" value={filtered.length} />
        <ReportMetric icon={Users} label="Devotees" value={uniqueDevotees} />
        <ReportMetric icon={CalendarDays} label="Active Enrollments" value={activeCount} />
        <ReportMetric icon={MapPin} label="Needs Attention" value={incomplete} warning />
      </div>

      <div className="report-content-grid">
        <section className="panel report-group-panel">
          <header><div><span className="eyebrow">Summary</span><h2>Grouped by {groupBy}</h2></div><span>{grouped.length} groups</span></header>
          <div className="report-groups">
            {grouped.length === 0 ? <p>No grouped results.</p> : grouped.slice(0, 12).map(([label, count]) => (
              <div key={label}><span>{label}</span><strong>{count}</strong></div>
            ))}
          </div>
        </section>

        <section className="panel report-results-panel">
          <header><div><span className="eyebrow">Detailed report</span><h2>Matching records</h2></div><span>{filtered.length} records</span></header>
          <div className="report-table-wrap">
            <table>
              <thead><tr><th>Every Year</th><th>Devotee</th><th>Beneficiary</th><th>Phone</th><th>Spiritual Details</th><th>Location</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="report-empty">No records match these filters.</td></tr>
                ) : filtered.map((row) => (
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
        </section>
      </div>

      <footer className="page-footer"><span /> Kambaru Sri Durgaparameshwari Temple <span /></footer>
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
