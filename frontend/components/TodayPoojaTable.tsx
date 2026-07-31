import Link from "next/link";
import { ChevronRight, FileDown, Printer, TriangleAlert } from "lucide-react";
import type { DueRow } from "@kambaru/backend";
import { Alert } from "@/components/ui/Alert";

export function TodayPoojaTable({
  rows,
  dateLabel,
  missingFieldsSummary,
  className = "",
}: {
  rows: DueRow[];
  dateLabel: string;
  missingFieldsSummary?: string;
  className?: string;
}) {
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
      {missingFieldsSummary && (
        <Alert icon={TriangleAlert} tone="warning" className="today-panel-warning">
          {missingFieldsSummary}
        </Alert>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Devotee</th><th>Beneficiary</th><th>Phone Number</th><th>Address</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.enrollmentId} className={row.hasException ? "today-row-warning" : ""}>
                <td>
                  {row.hasException && (
                    <TriangleAlert size={16} className="today-row-warning-icon" aria-label={row.exceptionNote ?? "Missing information"} />
                  )}
                  <strong>{row.sponsorName}</strong>
                </td>
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
