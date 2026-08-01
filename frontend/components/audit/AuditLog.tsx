"use client";

import { useEffect, useState, useTransition } from "react";
import type { AuditLogRow, PageResult } from "@kambaru/backend";
import { ChevronLeft, ChevronRight, Clock3, FileClock, Search, ShieldCheck, UserRound } from "lucide-react";
import { loadAuditLog } from "@/app/audit/actions";
import { Button } from "@/components/ui/Button";
import { PageFooter } from "@/components/PageFooter";

const PAGE_SIZE = 25;

const entityLabels: Record<string, string> = {
  devotee: "Devotee",
  pooja_enrollment: "Shashwatha Pooja",
  beneficiary: "Beneficiary",
  occurrence: "Pooja occurrence",
};

const actionLabels: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  imported: "Imported",
  archived: "Archived",
  status_corrected: "Status corrected",
};

const fieldLabels: Record<string, string> = {
  full_name: "name",
  phone_primary: "phone",
  phone_alternate: "alternate phone",
  address_line1: "address",
  address_line2: "address line 2",
  address_city: "city",
  address_state: "state",
  address_postal_code: "PIN code",
  annual_month: "annual month",
  annual_day: "annual day",
  beneficiary_id: "beneficiary",
  address_mode: "address choice",
  status: "status",
  notes: "notes",
};

function readable(value: string, dictionary: Record<string, string>) {
  return dictionary[value] ?? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AuditLog({ initialPage }: { initialPage: PageResult<AuditLogRow> }) {
  const [rows, setRows] = useState(initialPage.items);
  const [total, setTotal] = useState(initialPage.total);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await loadAuditLog({ search, entity, action, page });
        setRows(result.items);
        setTotal(result.total);
      });
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [action, entity, page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);

  return (
    <section className="dashboard-body audit-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Security and accountability</span>
          <h1>Audit Log</h1>
          <p>Review append-only records of imports and changes made to temple data.</p>
        </div>
        <div className="audit-total"><ShieldCheck size={20} /><span><strong>{total}</strong> matching events</span></div>
      </div>

      <section className="panel audit-panel" aria-busy={isPending}>
        <div className="audit-toolbar">
          <label className="resource-search audit-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Search audit log"
              placeholder="Search action, reference, or staff…"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </label>
          <label>
            <span>Record type</span>
            <select value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }}>
              <option value="">All record types</option>
              <option value="devotee">Devotees</option>
              <option value="pooja_enrollment">Shashwatha Poojas</option>
              <option value="beneficiary">Beneficiaries</option>
              <option value="occurrence">Occurrences</option>
            </select>
          </label>
          <label>
            <span>Action</span>
            <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}>
              <option value="">All actions</option>
              <option value="imported">Imported</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="status_corrected">Status corrected</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div className="audit-table-head" aria-hidden="true">
          <span>When</span><span>Who</span><span>Action</span><span>Record</span><span>Changed fields</span>
        </div>
        <div className={`audit-list ${isPending ? "loading" : ""}`} aria-live="polite">
          {rows.length === 0 ? (
            <div className="empty-state"><FileClock size={30} /><strong>No audit events found</strong><span>Change the search or filters.</span></div>
          ) : rows.map((row) => (
            <article className="audit-row" key={row.id}>
              <span className="audit-time"><Clock3 size={16} /><time dateTime={row.occurredAt}>{formatTimestamp(row.occurredAt)}</time></span>
              <span className="audit-actor"><UserRound size={16} /><strong>{row.actorName}</strong></span>
              <span><b className={`audit-action action-${row.action}`}>{readable(row.action, actionLabels)}</b></span>
              <span className="audit-entity"><strong>{readable(row.entityType, entityLabels)}</strong><small className="mono">{row.referenceNo}</small></span>
              <span className="audit-fields">
                {row.changedFields.length === 0
                  ? "Record metadata"
                  : row.changedFields.slice(0, 4).map((field) => readable(field, fieldLabels)).join(", ")}
                {row.changedFields.length > 4 && ` +${row.changedFields.length - 4} more`}
              </span>
            </article>
          ))}
        </div>

        {total > 0 && (
          <nav className="list-pagination" aria-label="Audit log pages">
            <span>Showing {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, total)} of {total}</span>
            <div>
              <Button variant="outline" disabled={activePage === 1 || isPending} onClick={() => setPage(activePage - 1)}><ChevronLeft size={16} /> Previous</Button>
              <strong>Page {activePage} of {totalPages}</strong>
              <Button variant="outline" disabled={activePage === totalPages || isPending} onClick={() => setPage(activePage + 1)}>Next <ChevronRight size={16} /></Button>
            </div>
          </nav>
        )}
      </section>
      <PageFooter />
    </section>
  );
}
