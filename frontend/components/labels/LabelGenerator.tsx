"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import type { LabelRecipient } from "@kambaru/backend";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  RotateCcw,
  Ruler,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageFooter } from "@/components/PageFooter";
import { getInvitationLabels, getLabelsForDate } from "@/app/labels/actions";
import { formatDisplayDate } from "@/lib/date-format";
import { FormattedDateInput } from "@/components/ui/FormattedDateInput";

type DateChoice = "today" | "tomorrow" | "custom" | "range" | "all" | "devotees" | "beneficiaries";

const LABEL_LAYOUTS = {
  compact: { label: "Compact", width: 58, height: 50 },
  standard: { label: "Standard", width: 58, height: 63 },
  large: { label: "Large", width: 90, height: 63 },
} as const;

type LabelLayoutKey = keyof typeof LABEL_LAYOUTS;

const TEMPLE_TIME_ZONE = "Asia/Kolkata";

const LABEL_SETTINGS_STORAGE_KEY = "kambaru:label-settings";

interface LabelAppearanceSettings {
  labelLayoutKey: LabelLayoutKey | "custom";
  labelWidthMm: number;
  labelHeightMm: number;
  nameFontSize: number;
  addressFontSize: number;
  phoneFontSize: number;
  nameColor: string;
  addressColor: string;
  phoneColor: string;
}

const DEFAULT_LABEL_SETTINGS: LabelAppearanceSettings = {
  labelLayoutKey: "compact",
  labelWidthMm: 58,
  labelHeightMm: 50,
  nameFontSize: 13,
  addressFontSize: 10,
  phoneFontSize: 9.5,
  nameColor: "#292521",
  addressColor: "#292521",
  phoneColor: "#4f4944",
};

const RESET_LABEL_SETTINGS: LabelAppearanceSettings = {
  labelLayoutKey: "custom",
  labelWidthMm: 90,
  labelHeightMm: 50,
  nameFontSize: 15.5,
  addressFontSize: 15,
  phoneFontSize: 11.5,
  nameColor: "#292521",
  addressColor: "#292521",
  phoneColor: "#4f4944",
};

function loadStoredLabelSettings(): LabelAppearanceSettings | null {
  try {
    const raw = window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LabelAppearanceSettings>;
    return { ...DEFAULT_LABEL_SETTINGS, ...parsed };
  } catch {
    return null;
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function displayDate(value: string) {
  return formatDisplayDate(value);
}

function inputDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEMPLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

export function LabelGenerator({
  initialRecipients,
  initialDate,
  initialChoice = "today",
  initialCustomDate,
  initialRangeFrom,
  initialRangeTo,
}: {
  initialRecipients: LabelRecipient[];
  initialDate: string;
  initialChoice?: DateChoice;
  initialCustomDate?: string;
  initialRangeFrom?: string;
  initialRangeTo?: string;
}) {
  const now = useMemo(() => new Date(`${initialDate}T00:00:00`), [initialDate]);
  const today = initialDate;
  const tomorrow = useMemo(() => inputDate(addDays(now, 1)), [now]);
  const [choice, setChoice] = useState<DateChoice>(initialChoice);
  const [customDate, setCustomDate] = useState(initialCustomDate ?? today);
  const [rangeFrom, setRangeFrom] = useState(initialRangeFrom ?? today);
  const [rangeTo, setRangeTo] = useState(initialRangeTo ?? inputDate(addDays(now, 7)));
  const [labelLayoutKey, setLabelLayoutKey] = useState<LabelLayoutKey | "custom">(DEFAULT_LABEL_SETTINGS.labelLayoutKey);
  const [labelWidthMm, setLabelWidthMm] = useState(DEFAULT_LABEL_SETTINGS.labelWidthMm);
  const [labelHeightMm, setLabelHeightMm] = useState(DEFAULT_LABEL_SETTINGS.labelHeightMm);
  const [nameFontSize, setNameFontSize] = useState(DEFAULT_LABEL_SETTINGS.nameFontSize);
  const [addressFontSize, setAddressFontSize] = useState(DEFAULT_LABEL_SETTINGS.addressFontSize);
  const [phoneFontSize, setPhoneFontSize] = useState(DEFAULT_LABEL_SETTINGS.phoneFontSize);
  const [nameColor, setNameColor] = useState(DEFAULT_LABEL_SETTINGS.nameColor);
  const [addressColor, setAddressColor] = useState(DEFAULT_LABEL_SETTINGS.addressColor);
  const [phoneColor, setPhoneColor] = useState(DEFAULT_LABEL_SETTINGS.phoneColor);
  const hasLoadedStoredSettings = useRef(false);

  // Appearance settings are a per-device preference, not application data — persist
  // them to localStorage so they survive navigating away from and back to Labels.
  // Deliberately deferred to an effect (not lazy useState init) so the client's
  // first render still matches the server-rendered HTML, avoiding a hydration
  // mismatch; the one-time extra render this causes is expected and harmless.
  useEffect(() => {
    const stored = loadStoredLabelSettings();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setLabelLayoutKey(stored.labelLayoutKey);
      setLabelWidthMm(stored.labelWidthMm);
      setLabelHeightMm(stored.labelHeightMm);
      setNameFontSize(stored.nameFontSize);
      setAddressFontSize(stored.addressFontSize);
      setPhoneFontSize(stored.phoneFontSize);
      setNameColor(stored.nameColor);
      setAddressColor(stored.addressColor);
      setPhoneColor(stored.phoneColor);
    }
    hasLoadedStoredSettings.current = true;
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredSettings.current) return;
    const settings: LabelAppearanceSettings = {
      labelLayoutKey, labelWidthMm, labelHeightMm, nameFontSize, addressFontSize, phoneFontSize, nameColor, addressColor, phoneColor,
    };
    try {
      window.localStorage.setItem(LABEL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage failures (private browsing, quota, etc.) — settings just won't persist.
    }
  }, [labelLayoutKey, labelWidthMm, labelHeightMm, nameFontSize, addressFontSize, phoneFontSize, nameColor, addressColor, phoneColor]);

  const labelLayout = {
    columns: Math.max(1, Math.min(4, Math.floor((186 + 3) / (labelWidthMm + 3)))),
    rows: Math.max(1, Math.min(8, Math.floor((263 + 3) / (labelHeightMm + 3)))),
  };
  const labelsPerPage = labelLayout.columns * labelLayout.rows;
  const rangeLabel = rangeFrom && rangeTo
    ? `${displayDate(rangeFrom)} – ${displayDate(rangeTo)}`
    : "Select from and to dates";
  const [previewPage, setPreviewPage] = useState(1);
  const selectedDate = choice === "today" ? today : choice === "tomorrow" ? tomorrow : customDate;
  const isInvitationChoice = choice === "all" || choice === "devotees" || choice === "beneficiaries";

  // Each selection fetches only the rows it needs (server-side filtered and, for
  // invitation modes, deduplicated) — never the whole devotee/enrollment tables.
  const [matchingRows, setMatchingRows] = useState<LabelRecipient[]>(initialRecipients);
  const [isPending, startTransition] = useTransition();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    let cancelled = false;
    startTransition(() => {
      const load = async () => {
        const rows = isInvitationChoice
          ? await getInvitationLabels(choice as "all" | "devotees" | "beneficiaries")
          : choice === "range"
            ? await getLabelsForDate({ mode: "range", rangeFrom, rangeTo })
            : await getLabelsForDate({ mode: choice, date: selectedDate });
        if (!cancelled) setMatchingRows(rows);
      };
      void load();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, selectedDate, rangeFrom, rangeTo]);

  const selectionKey = isInvitationChoice ? `all-${choice}` : choice === "range" ? `range-${rangeFrom}-${rangeTo}` : selectedDate;
  const [removedByDate, setRemovedByDate] = useState<Record<string, string[]>>({});
  const previewRef = useRef<HTMLDivElement>(null);
  const invitationMenuRef = useRef<HTMLDetailsElement>(null);
  const removedIds = removedByDate[selectionKey] ?? [];
  const labels = matchingRows.filter((row) => !removedIds.includes(row.id));
  const pages = chunk(labels, labelsPerPage);
  const visiblePage = Math.min(previewPage, Math.max(1, pages.length));

  function removeLabel(id: string) {
    setRemovedByDate((current) => ({
      ...current,
      [selectionKey]: [...(current[selectionKey] ?? []), id],
    }));
  }

  function restoreLabels() {
    setRemovedByDate((current) => ({ ...current, [selectionKey]: [] }));
    setPreviewPage(1);
  }

  function resetLabelSettings() {
    setLabelLayoutKey(RESET_LABEL_SETTINGS.labelLayoutKey);
    setLabelWidthMm(RESET_LABEL_SETTINGS.labelWidthMm);
    setLabelHeightMm(RESET_LABEL_SETTINGS.labelHeightMm);
    setNameFontSize(RESET_LABEL_SETTINGS.nameFontSize);
    setAddressFontSize(RESET_LABEL_SETTINGS.addressFontSize);
    setPhoneFontSize(RESET_LABEL_SETTINGS.phoneFontSize);
    setNameColor(RESET_LABEL_SETTINGS.nameColor);
    setAddressColor(RESET_LABEL_SETTINGS.addressColor);
    setPhoneColor(RESET_LABEL_SETTINGS.phoneColor);
    setPreviewPage(1);
  }

  function showInvitationLabels(nextChoice: Extract<DateChoice, "all" | "devotees" | "beneficiaries">) {
    invitationMenuRef.current?.removeAttribute("open");
    setChoice(nextChoice);
    setPreviewPage(1);
    setRemovedByDate((current) => ({ ...current, [`all-${nextChoice}`]: [] }));
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

      <div className="label-workspace">
        <aside className="panel label-filter-column" aria-label="Label date filter">
          <header><span className="eyebrow">Date filter</span><strong>Choose pooja dates</strong></header>
        <div className="label-date-tabs" role="group" aria-label="Choose label date">
          <Button variant={choice === "today" ? "primary" : "outline"} onClick={() => { setChoice("today"); setPreviewPage(1); }}>
            Today
          </Button>
          <Button variant={choice === "tomorrow" ? "primary" : "outline"} onClick={() => { setChoice("tomorrow"); setPreviewPage(1); }}>
            Tomorrow
          </Button>
          <Button variant={choice === "custom" ? "primary" : "outline"} onClick={() => { setChoice("custom"); setPreviewPage(1); }}>
            <CalendarDays size={17} /> Single date
          </Button>
          <Button variant={choice === "range" ? "primary" : "outline"} onClick={() => { setChoice("range"); setPreviewPage(1); }}>
            <CalendarDays size={17} /> Date range
          </Button>
        </div>

        {choice === "range" ? (
          <div className="label-date-range">
            <label className="label-custom-date">
              <span>From date</span>
              <FormattedDateInput value={rangeFrom} max={rangeTo || undefined} onChange={(event) => { setRangeFrom(event.target.value); setPreviewPage(1); }} />
            </label>
            <label className="label-custom-date">
              <span>To date</span>
              <FormattedDateInput value={rangeTo} min={rangeFrom || undefined} onChange={(event) => { setRangeTo(event.target.value); setPreviewPage(1); }} />
            </label>
          </div>
        ) : (
          <label className={`label-custom-date ${choice !== "custom" ? "is-muted" : ""}`}>
            <span>Date</span>
            <FormattedDateInput
              value={customDate}
              onChange={(event) => {
                setCustomDate(event.target.value);
                setChoice("custom");
                setPreviewPage(1);
              }}
            />
          </label>
        )}

          <div className="label-filter-summary">
            <strong>{choice === "all" ? "All devotee and beneficiary addresses" : choice === "devotees" ? "All devotee addresses" : choice === "beneficiaries" ? "All beneficiary addresses" : choice === "range" ? rangeLabel : displayDate(selectedDate)}</strong>
            <span>
              {isPending ? "Loading…" : `${labels.length} of ${matchingRows.length} ${isInvitationChoice ? "unique address labels" : "labels"} selected`}
            </span>
          </div>
        </aside>

        <aside className="panel label-settings-column" aria-label="Label settings">
          <header><span className="eyebrow">Label settings</span><strong>Layout and recipients</strong></header>
        <details className="label-size-designer">
          <summary className="ui-button ui-button-outline">
            <Ruler size={17} /> Label size: {labelWidthMm} × {labelHeightMm} mm <ChevronDown size={16} />
          </summary>
          <div className="label-size-designer-panel">
            <label className="label-custom-date">
              <span>Size preset</span>
              <select
                value={labelLayoutKey}
                onChange={(event) => {
                  const key = event.target.value as LabelLayoutKey | "custom";
                  setLabelLayoutKey(key);
                  if (key !== "custom") {
                    setLabelWidthMm(LABEL_LAYOUTS[key].width);
                    setLabelHeightMm(LABEL_LAYOUTS[key].height);
                  }
                  setPreviewPage(1);
                }}
              >
                {Object.entries(LABEL_LAYOUTS).map(([key, layout]) => (
                  <option value={key} key={key}>{layout.label} — {layout.width} × {layout.height} mm</option>
                ))}
                <option value="custom">Custom size</option>
              </select>
            </label>
            <label className="label-dimension-slider">
              <span><b>Width</b><output>{labelWidthMm} mm</output></span>
              <input type="range" min="40" max="90" step="1" value={labelWidthMm} onChange={(event) => { setLabelWidthMm(Number(event.target.value)); setLabelLayoutKey("custom"); setPreviewPage(1); }} />
            </label>
            <label className="label-dimension-slider">
              <span><b>Height</b><output>{labelHeightMm} mm</output></span>
              <input type="range" min="30" max="80" step="1" value={labelHeightMm} onChange={(event) => { setLabelHeightMm(Number(event.target.value)); setLabelLayoutKey("custom"); setPreviewPage(1); }} />
            </label>
            <div className="label-typography-heading"><strong>Text appearance</strong><span>Live preview and print</span></div>
            <LabelTextControl label="Name" size={nameFontSize} min={8} max={20} color={nameColor} onSize={setNameFontSize} onColor={setNameColor} />
            <LabelTextControl label="Address" size={addressFontSize} min={7} max={16} color={addressColor} onSize={setAddressFontSize} onColor={setAddressColor} />
            <LabelTextControl label="Phone number" size={phoneFontSize} min={7} max={16} color={phoneColor} onSize={setPhoneFontSize} onColor={setPhoneColor} />
            <small>{labelLayout.columns} columns × {labelLayout.rows} rows · {labelsPerPage} labels fit on each A4 sheet</small>
            <Button className="label-settings-reset" variant="ghost" onClick={resetLabelSettings}>
              <RotateCcw size={16} /> Reset label settings
            </Button>
          </div>
        </details>

        {removedIds.length > 0 && (
          <Button variant="ghost" onClick={restoreLabels}>
            <RotateCcw size={16} /> Restore removed
          </Button>
        )}

        <details className="invitation-label-menu" ref={invitationMenuRef}>
          <summary className="ui-button ui-button-outline">
            <Printer size={17} /> Generate All Labels <ChevronDown size={16} />
          </summary>
          <div className="invitation-label-menu-options" aria-label="Generate all label options">
            <button className={choice === "all" ? "active" : ""} type="button" onClick={() => showInvitationLabels("all")}>
              <strong>Devotees + Beneficiaries</strong><span>All unique addresses</span>
            </button>
            <button className={choice === "devotees" ? "active" : ""} type="button" onClick={() => showInvitationLabels("devotees")}>
              <strong>Devotees only</strong><span>Primary devotee addresses</span>
            </button>
            <button className={choice === "beneficiaries" ? "active" : ""} type="button" onClick={() => showInvitationLabels("beneficiaries")}>
              <strong>Beneficiaries only</strong><span>Beneficiary dispatch addresses</span>
            </button>
          </div>
        </details>
        </aside>

      <main className="panel label-preview-column">
      <div className="label-preview-heading" ref={previewRef}>
        <div>
          <span className="eyebrow">A4 print preview</span>
          <h2>{isInvitationChoice ? "Annual Festival Invitations" : choice === "range" ? rangeLabel : displayDate(selectedDate)}</h2>
        </div>
        <span>{labelLayout.columns} columns × {labelLayout.rows} rows · {labelsPerPage} labels per A4 · Print at 100% scale</span>
      </div>

      {labels.length === 0 ? (
        <section className="panel label-empty-state">
          <Printer size={32} />
          <strong>{isPending ? "Loading labels…" : "No labels to print"}</strong>
          {!isPending && (
            <span>
              {matchingRows.length > 0
                ? `All labels for this ${isInvitationChoice ? "invitation list" : "date"} were removed. Restore them to continue.`
                : isInvitationChoice
                  ? "There are no devotee or beneficiary addresses available."
                  : "There are no active Shashwatha Poojas scheduled for this date."}
            </span>
          )}
          {!isPending && matchingRows.length > 0 && <Button variant="secondary" onClick={restoreLabels}>Restore labels</Button>}
        </section>
      ) : (
        <div className="label-pages">
          {pages.map((page, pageIndex) => (
            <section
              className={`a4-label-sheet ${pageIndex + 1 === visiblePage ? "is-visible" : ""}`}
              key={`page-${pageIndex}`}
              aria-label={`A4 label sheet ${pageIndex + 1}`}
              style={{
                "--label-columns": labelLayout.columns,
                "--label-rows": labelLayout.rows,
                "--label-width-mm": `${labelWidthMm}mm`,
                "--label-height-mm": `${labelHeightMm}mm`,
                "--label-width-percent": `${(labelWidthMm / 186) * 100}%`,
                "--label-height-percent": `${(labelHeightMm / 263) * 100}%`,
                "--label-name-size": `${nameFontSize}pt`,
                "--label-address-size": `${addressFontSize}pt`,
                "--label-phone-size": `${phoneFontSize}pt`,
                "--label-name-color": nameColor,
                "--label-address-color": addressColor,
                "--label-phone-color": phoneColor,
              } as CSSProperties}
            >
              {Array.from({ length: labelsPerPage }, (_, slotIndex) => {
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
                    <address>
                      <span>
                        {[row.addressLine, row.addressLine2, row.city, row.state].filter(Boolean).join(", ") || "Address unavailable"}
                        {row.postalCode && <> — <b>{row.postalCode}</b></>}
                      </span>
                    </address>
                    <span className="courier-label-phone">{row.phone || "Phone unavailable"}</span>
                  </article>
                );
              })}
              <span className="label-sheet-page-number">Page {pageIndex + 1} of {pages.length}</span>
            </section>
          ))}
          {pages.length > 1 && (
            <nav className="list-pagination label-preview-pagination" aria-label="Label preview pages">
              <Button variant="outline" disabled={visiblePage === 1} onClick={() => setPreviewPage(visiblePage - 1)}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <div>
                {pages.map((_, index) => (
                  <Button
                    aria-label={`Show label page ${index + 1}`}
                    aria-current={visiblePage === index + 1 ? "page" : undefined}
                    key={index}
                    variant={visiblePage === index + 1 ? "primary" : "ghost"}
                    onClick={() => setPreviewPage(index + 1)}
                  >
                    {index + 1}
                  </Button>
                ))}
              </div>
              <Button variant="outline" disabled={visiblePage === pages.length} onClick={() => setPreviewPage(visiblePage + 1)}>
                Next <ChevronRight size={16} />
              </Button>
            </nav>
          )}
        </div>
      )}
      </main>
      </div>

      <PageFooter />
    </section>
  );
}

function LabelTextControl({
  label,
  size,
  min,
  max,
  color,
  onSize,
  onColor,
}: {
  label: string;
  size: number;
  min: number;
  max: number;
  color: string;
  onSize: (value: number) => void;
  onColor: (value: string) => void;
}) {
  return (
    <div className="label-text-control">
      <label className="label-dimension-slider">
        <span><b>{label}</b><output>{size} pt</output></span>
        <input type="range" min={min} max={max} step="0.5" value={size} onChange={(event) => onSize(Number(event.target.value))} />
      </label>
      <label className="label-color-control" title={`${label} color`}>
        <span>Color</span>
        <input type="color" value={color} onChange={(event) => onColor(event.target.value)} aria-label={`${label} color`} />
      </label>
    </div>
  );
}
