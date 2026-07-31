"use client";

import { useMemo, useRef, useState } from "react";
import type { DevoteeDirectoryRow, PoojaRegisterRow } from "@kambaru/backend";
import {
  CalendarDays,
  Printer,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

type DateChoice = "today" | "tomorrow" | "custom" | "all";

interface LabelRecipient {
  id: string;
  name: string;
  phone: string | null;
  addressLine: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}

const TEMPLE_TIME_ZONE = "Asia/Kolkata";

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEMPLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function inputDate(date: Date) {
  const { year, month, day } = dateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TEMPLE_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isDueOn(row: PoojaRegisterRow, value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (row.status !== "active") return false;
  if (row.annualMonth === month && row.annualDay === day) return true;
  return row.annualMonth === 2 && row.annualDay === 29 && month === 2 && day === 28 && !isLeapYear(year);
}

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

function normalizeAddress(recipient: LabelRecipient) {
  return [
    recipient.addressLine,
    recipient.addressLine2,
    recipient.city,
    recipient.state,
    recipient.postalCode,
  ]
    .filter(Boolean)
    .join("|")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9|]/g, "");
}

export function LabelGenerator({
  enrollments,
  devotees,
}: {
  enrollments: PoojaRegisterRow[];
  devotees: DevoteeDirectoryRow[];
}) {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => inputDate(now), [now]);
  const tomorrow = useMemo(() => inputDate(addDays(now, 1)), [now]);
  const [choice, setChoice] = useState<DateChoice>("today");
  const [customDate, setCustomDate] = useState(today);
  const selectedDate = choice === "today" ? today : choice === "tomorrow" ? tomorrow : customDate;
  const allInvitationRecipients = useMemo(() => {
    const candidates: LabelRecipient[] = [
      ...devotees.map((devotee) => ({
        id: `devotee-${devotee.id}`,
        name: devotee.fullName,
        phone: devotee.phone,
        addressLine: devotee.addressLine1,
        addressLine2: devotee.addressLine2,
        city: devotee.city === "City missing" ? "" : devotee.city,
        state: devotee.state,
        postalCode: /^\d{6}$/.test(devotee.postalCode) ? devotee.postalCode : "",
      })),
      ...enrollments.map((row) => ({
          id: `beneficiary-${row.enrollmentId}`,
          name: row.beneficiaryName,
          phone: row.beneficiaryPhone || row.phone,
          addressLine: row.addressLine,
          addressLine2: row.addressLine2,
          city: row.addressCity,
          state: row.addressState,
          postalCode: row.postalCode,
        })),
    ];
    const seen = new Set<string>();
    return candidates.filter((recipient) => {
      const normalized = normalizeAddress(recipient);
      const key = normalized || `missing-${recipient.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [devotees, enrollments]);
  const matchingRows = useMemo<LabelRecipient[]>(() => {
    if (choice === "all") return allInvitationRecipients;
    return enrollments
      .filter((row) => isDueOn(row, selectedDate))
      .map((row) => ({
        id: row.enrollmentId,
        name: row.beneficiaryName,
        phone: row.phone,
        addressLine: row.addressLine,
        addressLine2: row.addressLine2,
        city: row.addressCity,
        state: row.addressState,
        postalCode: row.postalCode,
      }));
  }, [allInvitationRecipients, choice, enrollments, selectedDate]);
  const selectionKey = choice === "all" ? "all-devotees" : selectedDate;
  const [removedByDate, setRemovedByDate] = useState<Record<string, string[]>>({});
  const previewRef = useRef<HTMLDivElement>(null);
  const removedIds = removedByDate[selectionKey] ?? [];
  const labels = matchingRows.filter((row) => !removedIds.includes(row.id));
  const pages = chunk(labels, 15);

  function removeLabel(id: string) {
    setRemovedByDate((current) => ({
      ...current,
      [selectionKey]: [...(current[selectionKey] ?? []), id],
    }));
  }

  function restoreLabels() {
    setRemovedByDate((current) => ({ ...current, [selectionKey]: [] }));
  }

  function showAllInvitationLabels() {
    setChoice("all");
    setRemovedByDate((current) => ({ ...current, "all-devotees": [] }));
    window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <section className="dashboard-body label-generator-page">
      <div className="page-intro label-page-intro">
        <div>
          <span className="eyebrow">Prasada dispatch</span>
          <h1>Generate Labels</h1>
          <p>Generate daily dispatch labels or a deduplicated invitation list for every devotee and beneficiary address.</p>
        </div>
        <Button onClick={() => window.print()} disabled={labels.length === 0}>
          <Printer size={18} /> Print {labels.length} {labels.length === 1 ? "Label" : "Labels"}
        </Button>
      </div>

      <section className="panel label-controls" aria-label="Label date filter">
        <div className="label-date-tabs" role="group" aria-label="Choose label date">
          <Button variant={choice === "today" ? "primary" : "outline"} onClick={() => setChoice("today")}>
            Today
          </Button>
          <Button variant={choice === "tomorrow" ? "primary" : "outline"} onClick={() => setChoice("tomorrow")}>
            Tomorrow
          </Button>
          <Button variant={choice === "custom" ? "primary" : "outline"} onClick={() => setChoice("custom")}>
            <CalendarDays size={17} /> Choose date
          </Button>
        </div>

        <label className={`label-custom-date ${choice !== "custom" ? "is-muted" : ""}`}>
          <span>Date</span>
          <input
            type="date"
            value={customDate}
            onChange={(event) => {
              setCustomDate(event.target.value);
              setChoice("custom");
            }}
          />
        </label>

        <div className="label-filter-summary">
          <strong>{choice === "all" ? "All devotee and beneficiary addresses" : displayDate(selectedDate)}</strong>
          <span>
            {labels.length} of {matchingRows.length} {choice === "all" ? "unique household labels" : "labels"} selected
          </span>
        </div>

        {removedIds.length > 0 && (
          <Button variant="ghost" onClick={restoreLabels}>
            <RotateCcw size={16} /> Restore removed
          </Button>
        )}

        <Button
          className="all-devotee-label-button"
          variant={choice === "all" ? "primary" : "outline"}
          onClick={showAllInvitationLabels}
        >
          <Printer size={17} /> Generate for All Devotees
        </Button>
      </section>

      <div className="label-preview-heading" ref={previewRef}>
        <div>
          <span className="eyebrow">A4 print preview</span>
          <h2>{choice === "all" ? "Annual Festival Invitations" : displayDate(selectedDate)}</h2>
        </div>
        <span>3 columns × 5 rows · Print at 100% scale</span>
      </div>

      {labels.length === 0 ? (
        <section className="panel label-empty-state">
          <Printer size={32} />
          <strong>No labels to print</strong>
          <span>
            {matchingRows.length > 0
              ? `All labels for this ${choice === "all" ? "invitation list" : "date"} were removed. Restore them to continue.`
              : choice === "all"
                ? "There are no devotee or beneficiary addresses available."
                : "There are no active Shashwatha Poojas scheduled for this date."}
          </span>
          {matchingRows.length > 0 && <Button variant="secondary" onClick={restoreLabels}>Restore labels</Button>}
        </section>
      ) : (
        <div className="label-pages">
          {pages.map((page, pageIndex) => (
            <section className="a4-label-sheet" key={`page-${pageIndex}`} aria-label={`A4 label sheet ${pageIndex + 1}`}>
              {Array.from({ length: 15 }, (_, slotIndex) => {
                const row = page[slotIndex];
                if (!row) return <div className="courier-label is-empty" key={`blank-${slotIndex}`} aria-hidden="true" />;
                return (
                  <article className="courier-label" key={row.id}>
                    <button
                      className="label-remove-button"
                      type="button"
                      onClick={() => removeLabel(row.id)}
                      aria-label={`Remove label for ${row.name}`}
                      title="Remove from this print sheet"
                    >
                      <X size={16} />
                    </button>
                    <strong>{row.name}</strong>
                    <span className="courier-label-address-heading">Address</span>
                    <address>
                      <span>{row.addressLine || "Address unavailable"}</span>
                      {row.addressLine2 && <span>{row.addressLine2}</span>}
                      <span>
                        {[row.city, row.state].filter(Boolean).join(", ") || "Location unavailable"}
                      </span>
                      {row.postalCode && <span><b>{row.postalCode}</b></span>}
                    </address>
                    <span className="courier-label-phone">{row.phone || "Phone unavailable"}</span>
                  </article>
                );
              })}
              <span className="label-sheet-page-number">Page {pageIndex + 1} of {pages.length}</span>
            </section>
          ))}
        </div>
      )}

      <footer className="page-footer"><span /> Kambaru Sri Durgaparameshwari Temple <span /></footer>
    </section>
  );
}
