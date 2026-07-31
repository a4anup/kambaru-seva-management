import Link from "next/link";
import { ChevronRight, FileDown, Printer } from "lucide-react";
import type { DueRow } from "@kambaru/backend";

export function TodayPoojaTable({ rows, dateLabel, className = "" }: { rows: DueRow[]; dateLabel: string; className?: string }) {
  return (
    <section className={`panel today-panel ${className}`.trim()}>
      <div className="panel-header">
        <div>
          <h3>Today&apos;s Poojas</h3>
          <span>{dateLabel}</span>
        </div>
        <div className="header-actions">
          <Link className="secondary-button" href="/reports"><FileDown size={17} /> Export CSV</Link>
          <Link className="primary-button" href="/labels"><Printer size={17} /> Generate Labels ({rows.length})</Link>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Devotee</th><th>Beneficiary</th><th>Phone Number</th><th>Address</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.enrollmentId}>
                <td><strong>{row.sponsorName}</strong></td>
                <td>{row.relation === "Self" ? "Self" : `${row.beneficiaryName} (${row.relation})`}</td>
                <td className="mono">{row.phone ?? "—"}</td>
                <td>{[row.addressLine, row.addressSub].filter(Boolean).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-footer">
        <span>Showing {rows.length} of {rows.length} entries</span>
        <Link className="text-button" href="/poojas">View All <ChevronRight size={16} /></Link>
      </div>
    </section>
  );
}
