"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Beneficiary, DevoteeDirectoryRow, EnrollmentStatus, PageResult, PoojaRegisterRow } from "@kambaru/backend";
import { PageFooter } from "@/components/PageFooter";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { loadBeneficiaries, loadPoojaCalendar, loadPoojaRegister, savePooja, searchDevotees } from "@/app/poojas/actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PAGE_SIZE = 10;
type PoojaDateFilter = "today" | "tomorrow" | "week" | "month" | "all" | "custom";

function todayInputValue() {
  return inputValueOf(new Date());
}

function inputValueOf(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ageFromDateOfBirth(value: string) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return null;
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age -= 1;
  return age;
}

function recurringDate(row: PoojaRegisterRow) {
  return `${String(row.annualDay).padStart(2, "0")} ${MONTHS[row.annualMonth - 1]}`;
}

function displayFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hasMissingContact(row: PoojaRegisterRow) {
  return !row.phone || !row.addressLine.trim() || !row.addressCity.trim() || !/^\d{6}$/.test(row.postalCode);
}

function capitalizeRelation(relation: Beneficiary["relation"]): PoojaRegisterRow["relation"] {
  return (relation.charAt(0).toUpperCase() + relation.slice(1)) as PoojaRegisterRow["relation"];
}

export function PoojaRegister({
  initialPage,
  initialCalendarCounts,
  devotees,
  beneficiaries,
  initialDate,
  className = "",
}: {
  initialPage: PageResult<PoojaRegisterRow>;
  initialCalendarCounts: Record<number, number>;
  devotees: DevoteeDirectoryRow[];
  beneficiaries: Beneficiary[];
  initialDate?: string;
  className?: string;
}) {
  const [rows, setRows] = useState(initialPage.items);
  const [total, setTotal] = useState(initialPage.total);
  const [dateFilter, setDateFilter] = useState(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayInputValue,
  );
  const [dateFilterMode, setDateFilterMode] = useState<PoojaDateFilter>(
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? "custom" : "today",
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const value = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayInputValue();
    return new Date(`${value}T00:00:00`);
  });
  const [selected, setSelected] = useState<PoojaRegisterRow>();
  const [adding, setAdding] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string>();
  const [calendarCounts, setCalendarCounts] = useState(initialCalendarCounts);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startLoading(async () => {
        const result = await loadPoojaRegister({ mode: dateFilterMode, date: dateFilter || todayInputValue(), search: query, page });
        setRows(result.items);
        setTotal(result.total);
      });
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [dateFilter, dateFilterMode, page, query]);

  useEffect(() => {
    startLoading(async () => {
      setCalendarCounts(await loadPoojaCalendar(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1));
    });
  }, [calendarMonth]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const paginatedRows = rows;
  const activeDateLabel = useMemo(() => {
    const today = new Date(`${todayInputValue()}T00:00:00`);
    if (dateFilterMode === "all") return null;
    if (dateFilterMode === "today") return `Today · ${displayFullDate(today)}`;
    if (dateFilterMode === "tomorrow") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return `Tomorrow · ${displayFullDate(tomorrow)}`;
    }
    if (dateFilterMode === "custom") {
      if (!dateFilter) return "Custom date";
      return `Custom date · ${displayFullDate(new Date(`${dateFilter}T00:00:00`))}`;
    }
    if (dateFilterMode === "week") {
      const monday = new Date(today);
      const weekday = monday.getDay();
      monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return `This week · ${displayFullDate(monday)} – ${displayFullDate(sunday)}`;
    }
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return `This month · ${displayFullDate(firstDay)} – ${displayFullDate(lastDay)}`;
  }, [dateFilter, dateFilterMode]);

  const labelsHref = useMemo(() => {
    const today = new Date(`${todayInputValue()}T00:00:00`);
    const params = new URLSearchParams();
    if (dateFilterMode === "tomorrow") {
      params.set("mode", "tomorrow");
    } else if (dateFilterMode === "custom" && dateFilter) {
      params.set("mode", "custom");
      params.set("date", dateFilter);
    } else if (dateFilterMode === "week") {
      const monday = new Date(today);
      const weekday = monday.getDay();
      monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      params.set("mode", "range");
      params.set("from", inputValueOf(monday));
      params.set("to", inputValueOf(sunday));
    } else if (dateFilterMode === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      params.set("mode", "range");
      params.set("from", inputValueOf(firstDay));
      params.set("to", inputValueOf(lastDay));
    } else if (dateFilterMode === "all") {
      params.set("mode", "beneficiaries");
    }
    const query = params.toString();
    return `/labels${query ? `?${query}` : ""}`;
  }, [dateFilter, dateFilterMode]);

  function saveRow(updated: PoojaRegisterRow) {
    setRows((current) => current.map((row) => row.enrollmentId === updated.enrollmentId ? updated : row));
    setSelected(undefined);
    setSavedMessage(`Changes to ${updated.beneficiaryName}'s pooja were saved.`);
  }

  return (
    <section className={`dashboard-body pooja-register-page ${className}`.trim()}>
      <div className="page-intro">
        <div>
          <span className="eyebrow">Shashwatha Pooja register</span>
          <h1>Poojas</h1>
          <p>Choose a date to see its annual poojas. Open any record to review or edit the enrollment.</p>
        </div>
        <div className="page-intro-actions">
          <Link className="ui-button ui-button-outline" href={labelsHref}>
            <Printer size={18} /> Generate Labels
          </Link>
          <Button onClick={() => setAdding(true)}><Plus size={18} /> Add Pooja</Button>
        </div>
      </div>

      {savedMessage && (
        <Alert icon={CircleAlert} tone="info" role="status" className="pooja-save-notice">
          {savedMessage}
        </Alert>
      )}

      <section className="panel pooja-register-panel">
        <div className="pooja-filter-bar">
          <div className="pooja-filter-presets" role="group" aria-label="Filter poojas by date range">
            {([
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["all", "All"],
            ] as Array<[PoojaDateFilter, string]>).map(([value, label]) => (
              <Button
                key={value}
                variant={dateFilterMode === value ? "primary" : "outline"}
                onClick={() => { setDateFilterMode(value); setPage(1); setCalendarView(false); }}
              >
                {label}
              </Button>
            ))}
          </div>

          <label className="resource-search pooja-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              aria-label="Search filtered poojas"
              placeholder="Search name or phone…"
            />
          </label>

          <div className="pooja-custom-date-group">
            <label className="pooja-date-filter">
              <span>Custom date</span>
              <span className={`pooja-filter-control ${dateFilterMode === "custom" ? "active" : ""}`}>
                <CalendarDays size={18} aria-hidden="true" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(event.target.value);
                    setDateFilterMode("custom");
                    setPage(1);
                    setCalendarView(false);
                    if (event.target.value) setCalendarMonth(new Date(`${event.target.value}T00:00:00`));
                  }}
                  onFocus={() => setDateFilterMode("custom")}
                  aria-label="Filter poojas by custom annual date"
                />
              </span>
            </label>
            <Button
              variant={calendarView ? "primary" : "outline"}
              aria-expanded={calendarView}
              onClick={() => {
                if (!calendarView && dateFilter) setCalendarMonth(new Date(`${dateFilter}T00:00:00`));
                setCalendarView((current) => !current);
              }}
            >
              <CalendarDays size={17} /> {calendarView ? "Hide Calendar" : "Calendar View"}
            </Button>
          </div>
        </div>
        {calendarView ? (
          <PoojaMonthCalendar
            month={calendarMonth}
            counts={calendarCounts}
            selectedDate={dateFilter}
            onMonthChange={setCalendarMonth}
            onSelectDate={(value) => {
              setDateFilter(value);
              setDateFilterMode("custom");
              setPage(1);
              setCalendarView(false);
            }}
          />
        ) : (
        <>
        {activeDateLabel && (
          <div className="pooja-active-date" role="status">
            <CalendarDays size={16} aria-hidden="true" />
            <span>{activeDateLabel}</span>
          </div>
        )}

        <div className={`list-loading-wrap ${isLoading ? "is-loading" : ""}`}>
        <div className="pooja-list-head" aria-hidden="true">
          <span>Devotee</span>
          <span>Beneficiary</span>
          <span>Phone Number</span>
          <span>Every year</span>
          <span>Address</span>
          <span>Edit</span>
        </div>

        <div className="pooja-list" aria-live="polite">
          {total === 0 ? (
            <div className="empty-state">
              <CalendarDays size={30} aria-hidden="true" />
              <strong>No poojas found</strong>
              <span>Choose another date or clear the filters.</span>
              <Button variant="secondary" onClick={() => { setDateFilterMode("all"); setPage(1); }}>Show all poojas</Button>
            </div>
          ) : (
            paginatedRows.map((row) => {
              const missingContact = hasMissingContact(row);
              return (
                <article
                  className={`pooja-list-row ${missingContact ? "pooja-contact-warning" : ""}`}
                  key={row.enrollmentId}
                >
                  <span className="resource-icon"><Sparkles size={20} /></span>
                  <span className="pooja-list-primary">
                    {missingContact && (
                      <TriangleAlert
                        size={17}
                        aria-label="Phone, address, or PIN code is missing"
                      />
                    )}
                    <strong>{row.sponsorName}</strong>
                  </span>
                  <span className="pooja-list-beneficiary">
                    <strong>{row.relation === "Self" ? "Self" : row.beneficiaryName}</strong>
                    {row.relation !== "Self" && <em>{row.relation}</em>}
                  </span>
                  <span className="pooja-list-phone mono">{row.phone ?? "Phone missing"}</span>
                  <span className="pooja-list-date">
                    <strong>{recurringDate(row)}</strong>
                    <small className="mono">{row.poojaNo}</small>
                  </span>
                  <span className="pooja-list-address">
                    {[row.addressCity, row.postalCode].filter(Boolean).join(" — ") || "Address missing"}
                  </span>
                  <Button className="pooja-row-edit" variant="outline" onClick={() => setSelected(row)}>
                    <Pencil size={16} /> Edit
                  </Button>
                </article>
              );
            })
          )}
        </div>
        <div className={`list-loading-overlay ${isLoading ? "is-active" : ""}`} aria-hidden="true">
          <span className="list-loading-spinner" />
        </div>
        </div>
        {total > 0 && (
          <nav className="list-pagination" aria-label="Pooja pages">
            <span>
              Showing {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, total)} of {total}
            </span>
            <div>
              <Button variant="outline" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <strong>Page {activePage} of {totalPages}</strong>
              <Button variant="outline" disabled={activePage === totalPages} onClick={() => setPage(activePage + 1)}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </nav>
        )}
        </>
        )}
      </section>

      <PageFooter />

      {selected && (
        <PoojaEditor
          key={`${selected.enrollmentId}-${selected.annualMonth}-${selected.annualDay}`}
          row={selected}
          onClose={() => setSelected(undefined)}
          onSave={saveRow}
        />
      )}
      {adding && (
        <AddPoojaModal
          devotees={devotees}
          beneficiaries={beneficiaries}
          onClose={() => setAdding(false)}
          onSave={(created) => {
            setRows((current) => [created, ...current]);
            setDateFilterMode("all");
            setPage(1);
            setAdding(false);
            setSavedMessage(`${created.beneficiaryName}'s pooja was added.`);
          }}
        />
      )}
    </section>
  );
}

function PoojaMonthCalendar({
  month,
  counts,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: {
  month: Date;
  counts: Record<number, number>;
  selectedDate: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (value: string) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = new Date(year, monthIndex, 1).getDay();
  const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
  const today = todayInputValue();
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(month);
  const monthTotal = Object.values(counts).reduce((sum, count) => sum + count, 0);

  function inputValue(day: number) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <section className="pooja-calendar" aria-label={`Pooja calendar for ${monthLabel}`}>
      <header className="pooja-calendar-header">
        <Button variant="outline" aria-label="Previous month" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}>
          <ChevronLeft size={18} /> Previous
        </Button>
        <div>
          <span className="eyebrow">Monthly pooja calendar</span>
          <h2>{monthLabel}</h2>
          <span className="pooja-calendar-month-total">{monthTotal} {monthTotal === 1 ? "pooja" : "poojas"} this month</span>
        </div>
        <Button variant="outline" aria-label="Next month" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}>
          Next <ChevronRight size={18} />
        </Button>
      </header>
      <div className="pooja-calendar-weekdays" aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span className={day === 'Sun' ? 'sunday' : ''} key={day}>{day}</span>)}
      </div>
      <div className="pooja-calendar-grid">
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - leadingBlanks + 1;
          if (day < 1 || day > daysInMonth) return <span className="pooja-calendar-blank" key={`blank-${index}`} aria-hidden="true" />;
          const value = inputValue(day);
          const count = counts[day] ?? 0;
          const loadClass = count >= 6 ? "pooja-load-high" : count >= 3 ? "pooja-load-medium" : count > 0 ? "pooja-load-low" : "";
          const isSunday = index % 7 === 0;
          return (
            <button
              className={`${count > 0 ? "has-poojas" : ""} ${loadClass} ${isSunday ? "sunday" : ""} ${value === selectedDate ? "selected" : ""} ${value === today ? "today" : ""}`.trim()}
              key={value}
              type="button"
              onClick={() => onSelectDate(value)}
              aria-label={`${displayFullDate(new Date(`${value}T00:00:00`))}, ${count} ${count === 1 ? "pooja" : "poojas"}`}
            >
              <strong>{day}</strong>
              <span>{count} {count === 1 ? "Pooja" : "Poojas"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PoojaEditor({
  row,
  onClose,
  onSave,
}: {
  row: PoojaRegisterRow;
  onClose: () => void;
  onSave: (row: PoojaRegisterRow) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [beneficiaryName, setBeneficiaryName] = useState(row.beneficiaryName);
  const [relation, setRelation] = useState(row.relation);
  const [beneficiaryPhone, setBeneficiaryPhone] = useState(row.beneficiaryPhone ?? "");
  const [beneficiaryRashi, setBeneficiaryRashi] = useState(row.beneficiaryRashi ?? "");
  const [beneficiaryNakshatra, setBeneficiaryNakshatra] = useState(row.beneficiaryNakshatra ?? "");
  const [beneficiaryGotra, setBeneficiaryGotra] = useState(row.beneficiaryGotra ?? "");
  const [beneficiaryNotes, setBeneficiaryNotes] = useState(row.beneficiaryNotes ?? "");
  const [date, setDate] = useState(
    `${currentYear}-${String(row.annualMonth).padStart(2, "0")}-${String(row.annualDay).padStart(2, "0")}`,
  );
  const [status, setStatus] = useState<EnrollmentStatus>(row.status);
  const [addressMode, setAddressMode] = useState(row.addressMode);
  const [addressLine, setAddressLine] = useState(row.addressLine);
  const [addressLine2, setAddressLine2] = useState(row.addressLine2 ?? "");
  const [addressCity, setAddressCity] = useState(row.addressCity);
  const [addressDistrict, setAddressDistrict] = useState(row.addressDistrict ?? "");
  const [addressState, setAddressState] = useState(row.addressState);
  const [postalCode, setPostalCode] = useState(row.postalCode);
  const [fee, setFee] = useState(String(row.feeMinor / 100));
  const [paymentReference, setPaymentReference] = useState(row.paymentReference ?? "");
  const [enrollmentDate, setEnrollmentDate] = useState(row.enrollmentDate);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = beneficiaryName.trim();
    const parsedDate = new Date(`${date}T00:00:00`);
    if (!trimmedName || Number.isNaN(parsedDate.getTime())) {
      setError("Beneficiary name and annual pooja date are required.");
      return;
    }
    setError(undefined);
    startSaving(async () => {
      const result = await savePooja({
        id: row.enrollmentId,
        expectedModifiedAt: row.modifiedAt,
        devoteeId: row.devoteeId,
        forSelf: relation === "Self",
        beneficiary: relation === "Self" ? undefined : {
          id: row.beneficiaryId ?? undefined,
          fullName: trimmedName,
          relation: relation.toLowerCase(),
          phone: beneficiaryPhone,
          rashi: beneficiaryRashi,
          nakshatra: beneficiaryNakshatra,
          gotra: beneficiaryGotra,
          notes: beneficiaryNotes,
        },
        annualMonth: parsedDate.getMonth() + 1,
        annualDay: parsedDate.getDate(),
        status,
        addressMode,
        customAddress: addressMode === "custom" ? {
          line1: addressLine,
          line2: addressLine2,
          city: addressCity,
          district: addressDistrict,
          state: addressState,
          postalCode,
        } : undefined,
        feeMinor: Math.round(Number(fee || 0) * 100),
        currency: "INR",
        paymentReference,
        enrollmentDate,
        notes,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSave(result.pooja);
    });
  }

  return (
    <div className="pooja-editor-layer" role="presentation">
      <button className="pooja-editor-backdrop" aria-label="Close pooja details" onClick={onClose} type="button" />
      <aside className="pooja-editor pooja-editor-modal" role="dialog" aria-modal="true" aria-labelledby="pooja-editor-title">
        <header className="pooja-editor-header">
          <div>
            <span className="eyebrow">Enrollment details</span>
            <h2 id="pooja-editor-title">{row.beneficiaryName}</h2>
            <p>Sponsored by {row.sponsorName} · {row.phone ?? "No phone"}</p>
          </div>
          <button className="icon-button" aria-label="Close pooja details" onClick={onClose} type="button"><X size={21} /></button>
        </header>

        <form className="pooja-editor-form" onSubmit={submit}>
          {error && <Alert>{error}</Alert>}

          <FormField id="beneficiary-name" label="Beneficiary name">
            <input className="form-control" id="beneficiary-name" value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} />
          </FormField>
          <div className="pooja-editor-grid">
            <FormField id="beneficiary-relation" label="Relation">
              <select className="form-control" id="beneficiary-relation" value={relation} onChange={(event) => setRelation(event.target.value as PoojaRegisterRow["relation"])}>
                {["Self", "Son", "Daughter", "Wife", "Husband", "Father", "Mother", "Other"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
            <FormField id="beneficiary-phone" label="Beneficiary phone">
              <input className="form-control" id="beneficiary-phone" inputMode="tel" value={beneficiaryPhone} onChange={(event) => setBeneficiaryPhone(event.target.value)} />
            </FormField>
          </div>
          <FormField id="beneficiary-notes" label="Beneficiary notes">
            <input className="form-control" id="beneficiary-notes" value={beneficiaryNotes} onChange={(event) => setBeneficiaryNotes(event.target.value)} />
          </FormField>
          <div className="pooja-editor-grid">
            <FormField id="beneficiary-rashi" label="Rashi">
              <input className="form-control" id="beneficiary-rashi" value={beneficiaryRashi} onChange={(event) => setBeneficiaryRashi(event.target.value)} />
            </FormField>
            <FormField id="beneficiary-nakshatra" label="Nakshatra">
              <input className="form-control" id="beneficiary-nakshatra" value={beneficiaryNakshatra} onChange={(event) => setBeneficiaryNakshatra(event.target.value)} />
            </FormField>
          </div>
          <FormField id="beneficiary-gotra" label="Gotra">
            <input className="form-control" id="beneficiary-gotra" value={beneficiaryGotra} onChange={(event) => setBeneficiaryGotra(event.target.value)} />
          </FormField>

          <FormField id="annual-date" label="Annual pooja date" help="The year is ignored; the month and day repeat every year.">
            <input className="form-control" id="annual-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </FormField>

          <div className="pooja-editor-grid">
            <FormField id="enrollment-status" label="Status">
              <select className="form-control" id="enrollment-status" value={status} onChange={(event) => setStatus(event.target.value as EnrollmentStatus)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>
            <FormField id="address-mode" label="Dispatch address">
              <select className="form-control" id="address-mode" value={addressMode} onChange={(event) => setAddressMode(event.target.value as PoojaRegisterRow["addressMode"])}>
                <option value="devotee_primary">Devotee primary</option>
                <option value="custom">Custom for this pooja</option>
              </select>
            </FormField>
          </div>

          {addressMode === "custom" && (
            <fieldset className="pooja-address-fields">
              <legend>Custom address</legend>
              <FormField id="address-line" label="Address">
                <input className="form-control" id="address-line" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
              </FormField>
              <FormField id="address-line-2" label="Address line 2">
                <input className="form-control" id="address-line-2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
              </FormField>
              <div className="pooja-editor-grid">
                <FormField id="address-city" label="City">
                  <input className="form-control" id="address-city" value={addressCity} onChange={(event) => setAddressCity(event.target.value)} />
                </FormField>
                <FormField id="address-district" label="District">
                  <input className="form-control" id="address-district" value={addressDistrict} onChange={(event) => setAddressDistrict(event.target.value)} />
                </FormField>
              </div>
              <div className="pooja-editor-grid">
                <FormField id="address-state" label="State">
                  <input className="form-control" id="address-state" value={addressState} onChange={(event) => setAddressState(event.target.value)} />
                </FormField>
                <FormField id="postal-code" label="PIN code">
                  <input className="form-control" id="postal-code" inputMode="numeric" maxLength={6} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                </FormField>
              </div>
            </fieldset>
          )}

          <fieldset className="pooja-address-fields">
            <legend>Payment and enrollment</legend>
            <div className="pooja-editor-grid">
              <FormField id="pooja-fee" label="Fee (₹)">
                <input className="form-control" id="pooja-fee" type="number" min="0" value={fee} onChange={(event) => setFee(event.target.value)} />
              </FormField>
              <FormField id="enrollment-date" label="Enrollment date">
                <input className="form-control" id="enrollment-date" type="date" value={enrollmentDate} onChange={(event) => setEnrollmentDate(event.target.value)} />
              </FormField>
            </div>
            <FormField id="payment-reference" label="Payment reference">
              <input className="form-control" id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
            </FormField>
          </fieldset>

          <FormField id="pooja-notes" label="Pooja Remarks">
            <textarea className="form-control pooja-notes" id="pooja-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>

          <div className="pooja-editor-actions">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function AddPoojaModal({
  devotees,
  beneficiaries,
  onClose,
  onSave,
}: {
  devotees: DevoteeDirectoryRow[];
  beneficiaries: Beneficiary[];
  onClose: () => void;
  onSave: (row: PoojaRegisterRow) => void;
}) {
  const [devoteeMode, setDevoteeMode] = useState<"existing" | "new">("existing");
  const [availableDevotees, setAvailableDevotees] = useState(devotees);
  const [availableBeneficiaries, setAvailableBeneficiaries] = useState(beneficiaries);
  const [devoteeId, setDevoteeId] = useState("");
  const [devoteeSearch, setDevoteeSearch] = useState("");
  const [isDevoteeSearchOpen, setIsDevoteeSearchOpen] = useState(false);
  const [quickDevoteeNo, setQuickDevoteeNo] = useState("");
  const selectedDevotee = availableDevotees.find((item) => item.id === devoteeId);
  const devoteeBeneficiaries = selectedDevotee
    ? availableBeneficiaries.filter((item) => item.devoteeId === selectedDevotee.id)
    : [];
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState("");
  const matchingDevotees = availableDevotees.filter((item) => {
    const search = devoteeSearch.trim().toLocaleLowerCase();
    return Boolean(search) && [item.fullName, item.devoteeNo, item.phone ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(search));
  }).slice(0, 8);
  const [devoteeName, setDevoteeName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneAlternate, setPhoneAlternate] = useState("");
  const [email, setEmail] = useState("");
  const [rashi, setRashi] = useState("");
  const [nakshatra, setNakshatra] = useState("");
  const [gotra, setGotra] = useState("");
  const [devoteeNotes, setDevoteeNotes] = useState("");
  const [poojaStep, setPoojaStep] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [newDevoteeStep, setNewDevoteeStep] = useState(1);
  const [newDevoteeAcknowledged, setNewDevoteeAcknowledged] = useState(false);
  const [forSelf, setForSelf] = useState(true);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [relation, setRelation] = useState<PoojaRegisterRow["relation"]>("Other");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [beneficiaryRashi, setBeneficiaryRashi] = useState("");
  const [beneficiaryNakshatra, setBeneficiaryNakshatra] = useState("");
  const [beneficiaryGotra, setBeneficiaryGotra] = useState("");
  const [beneficiaryNotes, setBeneficiaryNotes] = useState("");
  const [annualDate, setAnnualDate] = useState(todayInputValue);
  const [addressMode, setAddressMode] = useState<PoojaRegisterRow["addressMode"]>("devotee_primary");
  const [addressLine, setAddressLine] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [fee, setFee] = useState("1000");
  const [paymentReference, setPaymentReference] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(todayInputValue);
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    if (!devoteeSearch.trim()) return;
    const timer = window.setTimeout(() => {
      startSaving(async () => setAvailableDevotees(await searchDevotees(devoteeSearch)));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [devoteeSearch]);

  useEffect(() => {
    if (!devoteeId) return;
    startSaving(async () => setAvailableBeneficiaries(await loadBeneficiaries(devoteeId)));
  }, [devoteeId]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function continueFromDevotee() {
    if (!devoteeName.trim()) {
      setError("Devotee name is required.");
      return;
    }
    if (!newDevoteeAcknowledged) {
      setError("Please confirm that you reviewed the new devotee information.");
      return;
    }
    setError(undefined);
    setBeneficiaryName(devoteeName.trim());
    setBeneficiaryRashi(rashi);
    setBeneficiaryNakshatra(nakshatra);
    setBeneficiaryGotra(gotra);
    setPoojaStep(2);
  }

  function continueWithExistingDevotee() {
    if (!selectedDevotee) {
      setError("Search for and select a devotee before continuing.");
      return;
    }
    setError(undefined);
    setBeneficiaryName(selectedDevotee.fullName);
    setBeneficiaryRashi(selectedDevotee.rashi ?? "");
    setBeneficiaryNakshatra(selectedDevotee.nakshatra ?? "");
    setBeneficiaryGotra(selectedDevotee.gotra ?? "");
    setPoojaStep(2);
  }

  function selectByDevoteeNumber() {
    const entered = quickDevoteeNo.trim().toLocaleLowerCase();
    const numericPart = entered.replace(/^(?:kdp-)?dev-?/i, "").replace(/^0+/, "");
    startSaving(async () => {
      const matches = await searchDevotees(quickDevoteeNo);
      const match = matches.find((item) =>
        item.devoteeNo.toLocaleLowerCase() === entered ||
        item.devoteeNo.replace(/^(?:KDP-)?DEV-0*/i, "") === numericPart,
      );
      if (!match) {
        setError("No devotee was found with that Devotee ID.");
        return;
      }
      setAvailableDevotees((current) => [match, ...current.filter((item) => item.id !== match.id)]);
      setDevoteeId(match.id);
      setDevoteeSearch("");
      setIsDevoteeSearchOpen(false);
      setError(undefined);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sponsorName = devoteeMode === "existing" ? selectedDevotee?.fullName ?? "" : devoteeName.trim();
    const primaryAddress = devoteeMode === "existing"
      ? {
          line1: selectedDevotee?.addressLine1 ?? "",
          line2: selectedDevotee?.addressLine2,
          city: selectedDevotee?.city === "City missing" ? "" : selectedDevotee?.city ?? "",
          district: selectedDevotee?.district,
          state: selectedDevotee?.state ?? "",
          pin: /^\d{6}$/.test(selectedDevotee?.postalCode ?? "") ? selectedDevotee?.postalCode ?? "" : "",
        }
      : { line1: addressLine, line2: addressLine2, city, district, state, pin: postalCode };
    const parsedDate = new Date(`${annualDate}T00:00:00`);

    if (!sponsorName || Number.isNaN(parsedDate.getTime())) {
      setError("Select or enter a devotee and choose the annual pooja date.");
      return;
    }
    if (!forSelf && !beneficiaryName.trim()) {
      setError("Beneficiary name is required when the pooja is not for the devotee.");
      return;
    }
    if (!acknowledged) {
      setError("Please confirm that you reviewed the pooja information.");
      return;
    }
    const resolvedAddress = addressMode === "custom"
      ? { line1: addressLine.trim(), line2: addressLine2.trim() || undefined, city: city.trim(), district: district.trim() || undefined, state: state.trim(), pin: postalCode.trim() }
      : primaryAddress;
    const resolvedBeneficiary = forSelf ? sponsorName : beneficiaryName.trim();
    const resolvedRelation: PoojaRegisterRow["relation"] = forSelf ? "Self" : relation;

    startSaving(async () => {
      const result = await savePooja({
      devoteeId: devoteeMode === "existing" ? selectedDevotee?.id : undefined,
      newDevotee: devoteeMode === "new" ? {
        fullName: devoteeName,
        dateOfBirth,
        phone,
        phoneAlternate,
        email,
        rashi,
        nakshatra,
        gotra,
        notes: devoteeNotes,
        addressLine1: addressLine,
        addressLine2,
        city,
        district,
        state,
        postalCode,
      } : undefined,
      forSelf,
      beneficiary: forSelf ? undefined : {
        id: selectedBeneficiaryId || undefined,
        fullName: resolvedBeneficiary,
        relation: resolvedRelation.toLowerCase(),
        phone: beneficiaryPhone,
        rashi: beneficiaryRashi,
        nakshatra: beneficiaryNakshatra,
        gotra: beneficiaryGotra,
        notes: beneficiaryNotes,
      },
      annualMonth: parsedDate.getMonth() + 1,
      annualDay: parsedDate.getDate(),
      addressMode,
      customAddress: addressMode === "custom" ? {
        line1: resolvedAddress.line1,
        line2: resolvedAddress.line2,
        city: resolvedAddress.city,
        district: resolvedAddress.district,
        state: resolvedAddress.state,
        postalCode: resolvedAddress.pin,
      } : undefined,
      status: "active",
      feeMinor: Math.round(Number(fee || 0) * 100),
      currency: "INR",
      paymentReference,
      enrollmentDate,
      notes: beneficiaryNotes,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSave(result.pooja);
    });
  }

  return (
    <div className="pooja-editor-layer">
      <button className="pooja-editor-backdrop" aria-label="Close add pooja" onClick={onClose} type="button" />
      <aside className="pooja-editor pooja-editor-modal pooja-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-pooja-title">
        <header className="pooja-editor-header">
          <div>
            <span className="eyebrow">New enrollment</span>
            <h2 id="add-pooja-title">Add Shashwatha Pooja</h2>
            <p>Select an existing devotee or create their profile without leaving this screen.</p>
          </div>
          <button className="icon-button" aria-label="Close add pooja" onClick={onClose} type="button"><X size={21} /></button>
        </header>

        <form className="pooja-editor-form" onSubmit={submit}>
          {error && <Alert>{error}</Alert>}
          <div className="devotee-stepper pooja-wizard-stepper" aria-label={`Step ${poojaStep} of 5`}>
            {["Devotee", "Beneficiary", "Spiritual", "Address", "Review"].map((label, index) => (
              <button
                className={poojaStep === index + 1 ? "active" : poojaStep > index + 1 ? "complete" : ""}
                key={label}
                onClick={() => {
                  if (index === 0 || poojaStep > 1) {
                    setPoojaStep(index + 1);
                    setError(undefined);
                  }
                }}
                type="button"
                aria-current={poojaStep === index + 1 ? "step" : undefined}
              >
                <b>{poojaStep > index + 1 ? "✓" : index + 1}</b>
                <em>{label}</em>
              </button>
            ))}
          </div>

          {poojaStep === 1 && (
          <fieldset className="pooja-address-fields">
            <legend>1. Devotee</legend>
            <div className="modal-choice-row">
              <Button variant={devoteeMode === "existing" ? "primary" : "outline"} onClick={() => { setDevoteeMode("existing"); setNewDevoteeStep(1); setNewDevoteeAcknowledged(false); }}>Select existing</Button>
              <Button variant={devoteeMode === "new" ? "primary" : "outline"} onClick={() => { setDevoteeMode("new"); setNewDevoteeStep(1); setNewDevoteeAcknowledged(false); }}><Plus size={16} /> Add new devotee</Button>
            </div>
            {devoteeMode === "existing" ? (
              <>
                <FormField id="quick-devotee-id" label="Quick select by Devotee ID">
                  <div className="quick-id-control">
                    <input
                      className="form-control"
                      id="quick-devotee-id"
                      value={quickDevoteeNo}
                      onChange={(event) => setQuickDevoteeNo(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          selectByDevoteeNumber();
                        }
                      }}
                      placeholder="Enter a Devotee ID"
                    />
                    <Button onClick={selectByDevoteeNumber}>Select</Button>
                  </div>
                </FormField>
                <div className="search-divider"><span>or search</span></div>
                <FormField id="devotee-search" label="Search by name or phone number">
                  <span className="modal-search-control">
                    <Search size={17} aria-hidden="true" />
                    <input
                      className="form-control"
                      id="devotee-search"
                      value={devoteeSearch}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDevoteeSearch(value);
                        setIsDevoteeSearchOpen(Boolean(value.trim()));
                      }}
                      onFocus={() => setIsDevoteeSearchOpen(Boolean(devoteeSearch.trim()))}
                      placeholder="Start typing a devotee name or phone…"
                      autoComplete="off"
                    />
                  </span>
                </FormField>
                {devoteeSearch.trim() && isDevoteeSearchOpen && (
                  <div className="devotee-typeahead-results" role="listbox" aria-label="Matching devotees">
                    {matchingDevotees.length === 0 ? (
                      <span className="typeahead-empty">No devotees match “{devoteeSearch}”.</span>
                    ) : matchingDevotees.map((devotee) => (
                      <button
                        className={devotee.id === devoteeId ? "selected" : ""}
                        key={devotee.id}
                        onClick={() => {
                          setDevoteeId(devotee.id);
                          setIsDevoteeSearchOpen(false);
                          setError(undefined);
                        }}
                        type="button"
                        role="option"
                        aria-selected={devotee.id === devoteeId}
                      >
                        <span className="devotee-avatar" aria-hidden="true">{devotee.fullName.charAt(0)}</span>
                        <span><strong>{devotee.fullName}</strong><small>{devotee.devoteeNo} · {devotee.phone ?? "No phone"}</small></span>
                        {devotee.id === devoteeId && <CheckCircle2 size={19} aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}
                {selectedDevotee && (
                  <div className="selected-devotee-card">
                    <CheckCircle2 size={20} aria-hidden="true" />
                    <div><span>Selected devotee</span><strong>{selectedDevotee.fullName}</strong><small>{selectedDevotee.devoteeNo} · {selectedDevotee.phone ?? "No phone"}</small></div>
                  </div>
                )}
                <div className="modal-step-actions">
                  <Button onClick={continueWithExistingDevotee}>Continue to Pooja</Button>
                </div>
              </>
            ) : (
              <>
                <div className="devotee-stepper nested-devotee-stepper" aria-label={`New devotee step ${newDevoteeStep} of 5`}>
                  {["Personal", "Spiritual", "Address", "Notes", "Review"].map((label, index) => (
                    <button
                      className={newDevoteeStep === index + 1 ? "active" : newDevoteeStep > index + 1 ? "complete" : ""}
                      key={label}
                      onClick={() => { setNewDevoteeStep(index + 1); setError(undefined); }}
                      type="button"
                      aria-current={newDevoteeStep === index + 1 ? "step" : undefined}
                    >
                      <b>{newDevoteeStep > index + 1 ? "✓" : index + 1}</b>
                      <em>{label}</em>
                    </button>
                  ))}
                </div>
                {newDevoteeStep === 1 && (
                <section className="modal-form-section">
                  <header><span>01</span><div><h3>Personal details</h3><p>Name and contact information</p></div></header>
                <FormField id="new-devotee-name" label="Full name">
                  <input className="form-control" id="new-devotee-name" value={devoteeName} onChange={(event) => setDevoteeName(event.target.value)} />
                </FormField>
                <div className="dob-age-grid">
                  <FormField id="new-devotee-dob" label="Date of birth">
                    <input className="form-control" id="new-devotee-dob" type="date" max={todayInputValue()} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                  </FormField>
                  <div className="calculated-age" aria-live="polite">
                    <span>Current age</span>
                    <strong>{ageFromDateOfBirth(dateOfBirth) ?? "—"}</strong>
                    <small>{ageFromDateOfBirth(dateOfBirth) === null ? "Select DOB" : "years"}</small>
                  </div>
                </div>
                <div className="pooja-editor-grid">
                  <FormField id="new-devotee-phone" label="Primary phone">
                    <input className="form-control" id="new-devotee-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </FormField>
                  <FormField id="new-devotee-phone-alt" label="Alternate phone">
                    <input className="form-control" id="new-devotee-phone-alt" inputMode="tel" value={phoneAlternate} onChange={(event) => setPhoneAlternate(event.target.value)} />
                  </FormField>
                </div>
                <FormField id="new-devotee-email" label="Email">
                  <input className="form-control" id="new-devotee-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </FormField>
                </section>
                )}
                {newDevoteeStep === 2 && (
                <section className="modal-form-section">
                  <header><span>02</span><div><h3>Spiritual details</h3><p>Rashi, Nakshatra and Gotra</p></div></header>
                <div className="pooja-editor-grid">
                  <FormField id="new-devotee-rashi" label="Rashi">
                    <input className="form-control" id="new-devotee-rashi" value={rashi} onChange={(event) => setRashi(event.target.value)} />
                  </FormField>
                  <FormField id="new-devotee-nakshatra" label="Nakshatra">
                    <input className="form-control" id="new-devotee-nakshatra" value={nakshatra} onChange={(event) => setNakshatra(event.target.value)} />
                  </FormField>
                </div>
                <FormField id="new-devotee-gotra" label="Gotra">
                  <input className="form-control" id="new-devotee-gotra" value={gotra} onChange={(event) => setGotra(event.target.value)} />
                </FormField>
                </section>
                )}
                {newDevoteeStep === 3 && (
                <fieldset className="pooja-address-fields nested-address-fields modal-form-section">
                  <legend>03 · Primary address</legend>
                  <FormField id="new-devotee-address-line-1" label="Address line 1">
                    <input className="form-control" id="new-devotee-address-line-1" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
                  </FormField>
                  <FormField id="new-devotee-address-line-2" label="Address line 2">
                    <input className="form-control" id="new-devotee-address-line-2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
                  </FormField>
                  <div className="pooja-editor-grid">
                    <FormField id="new-devotee-city" label="City">
                      <input className="form-control" id="new-devotee-city" value={city} onChange={(event) => setCity(event.target.value)} />
                    </FormField>
                    <FormField id="new-devotee-district" label="District">
                      <input className="form-control" id="new-devotee-district" value={district} onChange={(event) => setDistrict(event.target.value)} />
                    </FormField>
                  </div>
                  <div className="pooja-editor-grid">
                    <FormField id="new-devotee-state" label="State">
                      <input className="form-control" id="new-devotee-state" value={state} onChange={(event) => setState(event.target.value)} />
                    </FormField>
                    <FormField id="new-devotee-pin" label="PIN code">
                      <input className="form-control" id="new-devotee-pin" inputMode="numeric" maxLength={6} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                    </FormField>
                  </div>
                </fieldset>
                )}
                {newDevoteeStep === 4 && (
                <section className="modal-form-section">
                  <header><span>04</span><div><h3>Internal notes</h3><p>Optional information for temple staff</p></div></header>
                  <FormField id="new-devotee-notes" label="Devotee notes">
                    <textarea className="form-control pooja-notes" id="new-devotee-notes" value={devoteeNotes} onChange={(event) => setDevoteeNotes(event.target.value)} />
                  </FormField>
                </section>
                )}
                {newDevoteeStep === 5 && (
                <section className="modal-form-section devotee-review-section">
                  <header><span><CheckCircle2 size={17} /></span><div><h3>Confirm new devotee</h3><p>Review before continuing to the pooja</p></div></header>
                  <div className="devotee-review-grid">
                    <div className="review-row review-row-two">
                      <div><span>Name</span><strong>{devoteeName || "Not provided"}</strong></div>
                      <div><span>Date of birth / Age</span><strong>{dateOfBirth ? `${dateOfBirth} · ${ageFromDateOfBirth(dateOfBirth) ?? "—"} years` : "Not provided"}</strong></div>
                    </div>
                    <div className="review-row review-row-two">
                      <div><span>Primary phone</span><strong>{phone || "Not provided"}</strong></div>
                      <div><span>Alternate phone</span><strong>{phoneAlternate || "Not provided"}</strong></div>
                    </div>
                    <div className="review-row"><div><span>Email</span><strong>{email || "Not provided"}</strong></div></div>
                    <div className="review-row review-row-three">
                      <div><span>Rashi</span><strong>{rashi || "Not provided"}</strong></div>
                      <div><span>Nakshatra</span><strong>{nakshatra || "Not provided"}</strong></div>
                      <div><span>Gotra</span><strong>{gotra || "Not provided"}</strong></div>
                    </div>
                    <div className="review-row review-address-box">
                      <div><span>Primary address</span><address><strong>{addressLine || "Address not provided"}</strong>{addressLine2 && <strong>{addressLine2}</strong>}<strong>{[city, district].filter(Boolean).join(", ") || "City not provided"}</strong><strong>{[state, postalCode].filter(Boolean).join(" — ") || "State and PIN not provided"}</strong></address></div>
                    </div>
                    <div className="review-row"><div><span>Notes</span><strong>{devoteeNotes || "Not provided"}</strong></div></div>
                  </div>
                  <label className="review-acknowledgement">
                    <input type="checkbox" checked={newDevoteeAcknowledged} onChange={(event) => { setNewDevoteeAcknowledged(event.target.checked); setError(undefined); }} />
                    <span>I reviewed the information and confirm this new devotee.</span>
                  </label>
                </section>
                )}
                <div className="modal-step-actions">
                  {newDevoteeStep > 1 && <Button variant="outline" onClick={() => setNewDevoteeStep((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /> Back</Button>}
                  {newDevoteeStep < 5 ? (
                    <Button onClick={() => {
                      if (newDevoteeStep === 1 && !devoteeName.trim()) {
                        setError("Devotee name is required.");
                        return;
                      }
                      setError(undefined);
                      setNewDevoteeStep((current) => Math.min(5, current + 1));
                    }}>Next <ChevronRight size={16} /></Button>
                  ) : (
                    <Button disabled={!newDevoteeAcknowledged} onClick={continueFromDevotee}><CheckCircle2 size={17} /> Confirm & Continue to Pooja</Button>
                  )}
                </div>
              </>
            )}
          </fieldset>
          )}
          {poojaStep === 2 && (
          <fieldset className="pooja-address-fields modal-form-section">
            <legend>Beneficiary details and annual date</legend>
            <FormField id="new-beneficiary-relation" label="Pooja for">
              <select
                className="form-control"
                id="new-beneficiary-relation"
                value={forSelf ? "Self" : relation}
                onChange={(event) => {
                  const value = event.target.value as PoojaRegisterRow["relation"];
                  const self = value === "Self";
                  setForSelf(self);
                  setRelation(value);
                  setSelectedBeneficiaryId("");
                  if (self) {
                    const source = devoteeMode === "existing" ? selectedDevotee : undefined;
                    setBeneficiaryName(source?.fullName ?? devoteeName);
                    setBeneficiaryRashi(source?.rashi ?? rashi);
                    setBeneficiaryNakshatra(source?.nakshatra ?? nakshatra);
                    setBeneficiaryGotra(source?.gotra ?? gotra);
                  } else {
                    setBeneficiaryName("");
                    setBeneficiaryPhone("");
                    setBeneficiaryRashi("");
                    setBeneficiaryNakshatra("");
                    setBeneficiaryGotra("");
                    setBeneficiaryNotes("");
                  }
                }}
              >
                {["Self", "Son", "Daughter", "Wife", "Husband", "Father", "Mother", "Other"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
            {forSelf && (
              <div className="modal-created-summary">
                <div><span>Beneficiary</span><strong>{selectedDevotee?.fullName ?? devoteeName}</strong></div>
              </div>
            )}
            {!forSelf && (
              <>
                {devoteeBeneficiaries.length > 0 && (
                  <div className="beneficiary-picker-field">
                    <span className="form-label">Use a saved beneficiary for {selectedDevotee?.fullName}</span>
                    <div className="devotee-typeahead-results" role="listbox" aria-label="Saved beneficiaries for this devotee">
                      {devoteeBeneficiaries.map((beneficiary) => (
                        <button
                          key={beneficiary.id}
                          type="button"
                          role="option"
                          aria-selected={selectedBeneficiaryId === beneficiary.id}
                          className={selectedBeneficiaryId === beneficiary.id ? "selected" : ""}
                          onClick={() => {
                            setSelectedBeneficiaryId(beneficiary.id);
                            setRelation(capitalizeRelation(beneficiary.relation));
                            setBeneficiaryName(beneficiary.fullName);
                            setBeneficiaryPhone(beneficiary.phone ?? "");
                            setBeneficiaryRashi(beneficiary.rashi ?? "");
                            setBeneficiaryNakshatra(beneficiary.nakshatra ?? "");
                            setBeneficiaryGotra(beneficiary.gotra ?? "");
                            setBeneficiaryNotes(beneficiary.notes ?? "");
                          }}
                        >
                          <span className="devotee-avatar" aria-hidden="true">{beneficiary.fullName.charAt(0)}</span>
                          <span>
                            <strong>{beneficiary.fullName}</strong>
                            <small>{capitalizeRelation(beneficiary.relation)}{beneficiary.phone ? ` · ${beneficiary.phone}` : ""}</small>
                          </span>
                          {selectedBeneficiaryId === beneficiary.id && <CheckCircle2 size={19} aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                    <div className="search-divider"><span>or add a new beneficiary below</span></div>
                  </div>
                )}
                <FormField id="new-beneficiary-name" label="Beneficiary name">
                  <input
                    className="form-control"
                    id="new-beneficiary-name"
                    value={beneficiaryName}
                    onChange={(event) => { setBeneficiaryName(event.target.value); setSelectedBeneficiaryId(""); }}
                  />
                </FormField>
                <FormField id="new-beneficiary-phone" label="Beneficiary phone">
                  <input className="form-control" id="new-beneficiary-phone" inputMode="tel" value={beneficiaryPhone} onChange={(event) => setBeneficiaryPhone(event.target.value)} />
                </FormField>
              </>
            )}
            <FormField id="new-annual-date" label="Pooja date every year" help="Only the month and day repeat.">
              <input className="form-control" id="new-annual-date" type="date" value={annualDate} onChange={(event) => setAnnualDate(event.target.value)} />
            </FormField>
          </fieldset>
          )}

          {poojaStep === 3 && (
          <fieldset className="pooja-address-fields modal-form-section">
            <legend>Spiritual details and remarks</legend>
            <div className="pooja-editor-grid">
              <FormField id="new-beneficiary-rashi" label="Rashi">
                <input className="form-control" id="new-beneficiary-rashi" value={beneficiaryRashi} onChange={(event) => setBeneficiaryRashi(event.target.value)} />
              </FormField>
              <FormField id="new-beneficiary-nakshatra" label="Nakshatra">
                <input className="form-control" id="new-beneficiary-nakshatra" value={beneficiaryNakshatra} onChange={(event) => setBeneficiaryNakshatra(event.target.value)} />
              </FormField>
            </div>
            <FormField id="new-beneficiary-gotra" label="Gotra">
              <input className="form-control" id="new-beneficiary-gotra" value={beneficiaryGotra} onChange={(event) => setBeneficiaryGotra(event.target.value)} />
            </FormField>
            <FormField id="new-beneficiary-notes" label="Pooja Remarks">
              <textarea className="form-control pooja-notes" id="new-beneficiary-notes" value={beneficiaryNotes} onChange={(event) => setBeneficiaryNotes(event.target.value)} />
            </FormField>
            <details className="optional-payment-details">
              <summary>Payment information (optional)</summary>
              <div className="pooja-editor-grid">
                <FormField id="new-pooja-fee" label="Fee (₹)">
                  <input className="form-control" id="new-pooja-fee" type="number" min="0" value={fee} onChange={(event) => setFee(event.target.value)} />
                </FormField>
                <FormField id="new-enrollment-date" label="Enrollment date">
                  <input className="form-control" id="new-enrollment-date" type="date" value={enrollmentDate} onChange={(event) => setEnrollmentDate(event.target.value)} />
                </FormField>
              </div>
              <FormField id="new-payment-reference" label="Payment reference">
                <input className="form-control" id="new-payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
              </FormField>
            </details>
          </fieldset>
          )}

          {poojaStep === 4 && (
          <fieldset className="pooja-address-fields modal-form-section">
            <legend>Dispatch address</legend>
            <FormField id="new-address-mode" label="Dispatch address">
              <select className="form-control" id="new-address-mode" value={addressMode} onChange={(event) => setAddressMode(event.target.value as PoojaRegisterRow["addressMode"])}>
                <option value="devotee_primary">Devotee primary address</option>
                <option value="custom">Custom address for this pooja</option>
              </select>
            </FormField>
            {addressMode === "devotee_primary" && (
              <div className="modal-created-summary">
                <div>
                  <span>Devotee primary address</span>
                  <strong>
                    {[selectedDevotee?.addressLine1 ?? addressLine, selectedDevotee?.addressLine2 ?? addressLine2, selectedDevotee?.city ?? city, selectedDevotee?.state ?? state, selectedDevotee?.postalCode ?? postalCode]
                      .filter(Boolean)
                      .join(", ") || "No primary address provided"}
                  </strong>
                </div>
              </div>
            )}
            {addressMode === "custom" && (
              <>
                <FormField id="new-address-line-1" label={addressMode === "custom" ? "Custom address line 1" : "Primary address line 1"}>
                  <input className="form-control" id="new-address-line-1" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
                </FormField>
                <FormField id="new-address-line-2" label="Address line 2">
                  <input className="form-control" id="new-address-line-2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
                </FormField>
                <div className="pooja-editor-grid">
                  <FormField id="new-address-city" label="City">
                    <input className="form-control" id="new-address-city" value={city} onChange={(event) => setCity(event.target.value)} />
                  </FormField>
                  <FormField id="new-address-district" label="District">
                    <input className="form-control" id="new-address-district" value={district} onChange={(event) => setDistrict(event.target.value)} />
                  </FormField>
                </div>
                <div className="pooja-editor-grid">
                  <FormField id="new-address-state" label="State">
                    <input className="form-control" id="new-address-state" value={state} onChange={(event) => setState(event.target.value)} />
                  </FormField>
                  <FormField id="new-address-pin" label="PIN code">
                    <input className="form-control" id="new-address-pin" inputMode="numeric" maxLength={6} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                  </FormField>
                </div>
              </>
            )}
          </fieldset>
          )}

          {poojaStep === 5 && (
            <section className="modal-form-section pooja-review-section">
              <header>
                <span><CheckCircle2 size={17} /></span>
                <div><h3>Confirm Shashwatha Pooja</h3><p>Review before adding the annual pooja</p></div>
              </header>
              <div className="pooja-review-grid">
                <div><span>Devotee</span><strong>{selectedDevotee?.fullName ?? devoteeName}</strong></div>
                <div><span>Beneficiary</span><strong>{forSelf ? selectedDevotee?.fullName ?? devoteeName : beneficiaryName || "Not provided"} · {forSelf ? "Self" : relation}</strong></div>
                <div><span>Every year</span><strong>{annualDate}</strong></div>
                <div><span>Rashi / Nakshatra / Gotra</span><strong>{[beneficiaryRashi, beneficiaryNakshatra, beneficiaryGotra].filter(Boolean).join(" · ") || "Not provided"}</strong></div>
                <div className="wide"><span>Address</span><strong>{addressMode === "devotee_primary" ? [selectedDevotee?.addressLine1 ?? addressLine, selectedDevotee?.addressLine2 ?? addressLine2, selectedDevotee?.city ?? city, selectedDevotee?.state ?? state, selectedDevotee?.postalCode ?? postalCode].filter(Boolean).join(", ") : [addressLine, addressLine2, city, district, state, postalCode].filter(Boolean).join(", ") || "Not provided"}</strong></div>
                <div className="wide"><span>Remarks</span><strong>{beneficiaryNotes || "Not provided"}</strong></div>
              </div>
              <label className="review-acknowledgement">
                <input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setError(undefined); }} />
                <span>I have reviewed the details and confirm this Shashwatha Pooja.</span>
              </label>
            </section>
          )}

          <div className="pooja-editor-actions">
            {poojaStep === 1 ? (
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            ) : (
              <Button variant="outline" onClick={() => { setPoojaStep((current) => Math.max(1, current - 1)); setError(undefined); }}><ChevronLeft size={16} /> Back</Button>
            )}
            {poojaStep > 1 && poojaStep < 5 ? (
              <Button onClick={() => {
                if (poojaStep === 2 && !forSelf && !beneficiaryName.trim()) {
                  setError("Beneficiary name is required.");
                  return;
                }
                setError(undefined);
                setPoojaStep((current) => Math.min(5, current + 1));
              }}>Next <ChevronRight size={16} /></Button>
            ) : poojaStep === 5 ? (
              <Button type="submit" disabled={!acknowledged || isSaving}>
                <CheckCircle2 size={17} /> {isSaving ? "Adding…" : "Add Pooja"}
              </Button>
            ) : null}
          </div>
        </form>
      </aside>
    </div>
  );
}
