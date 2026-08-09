"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, MapPin, Pencil, Phone, Plus, Search, TriangleAlert, Users, X } from "lucide-react";
import type { DevoteeDirectoryPage, DevoteeDirectoryRow, DevoteePoojaDate } from "@kambaru/backend";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { loadDevoteeDirectory, loadDevoteePoojaDates, saveDevotee } from "@/app/devotees/actions";
import { PageFooter } from "@/components/PageFooter";
import { formatAnnualDisplayDate, formatDisplayDate } from "@/lib/date-format";
import { FormattedDateInput } from "@/components/ui/FormattedDateInput";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PAGE_SIZE = 10;

function todayInputForDevotee() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function ageFromDateOfBirth(value: string) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function DevoteeDirectory({
  initialPage,
  initialEditRow,
  className = "",
}: {
  initialPage: DevoteeDirectoryPage;
  initialEditRow?: DevoteeDirectoryRow;
  className?: string;
}) {
  const [rows, setRows] = useState(initialPage.items);
  const [total, setTotal] = useState(initialPage.total);
  const [allTotal, setAllTotal] = useState(initialPage.allTotal);
  const [letterCounts, setLetterCounts] = useState(initialPage.letterCounts);
  const [letter, setLetter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DevoteeDirectoryRow | undefined>(initialEditRow);
  const [adding, setAdding] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string>();
  const [isLoading, startLoading] = useTransition();
  const [poojaDatesRow, setPoojaDatesRow] = useState<DevoteeDirectoryRow>();
  const [poojaDates, setPoojaDates] = useState<DevoteePoojaDate[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);

  async function showPoojaDates(row: DevoteeDirectoryRow) {
    setPoojaDatesRow(row);
    setDatesLoading(true);
    setPoojaDates(await loadDevoteePoojaDates(row.id));
    setDatesLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startLoading(async () => {
        const result = await loadDevoteeDirectory({ search: query, letter, page });
        setRows(result.items);
        setTotal(result.total);
        setAllTotal(result.allTotal);
        setLetterCounts(result.letterCounts);
      });
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [letter, page, query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const paginatedRows = rows;

  function saveRow(updated: DevoteeDirectoryRow) {
    setRows((current) => current.map((row) => row.id === updated.id ? updated : row));
    setSelected(undefined);
    setSavedMessage(`${updated.fullName}'s profile was updated.`);
  }

  return (
    <section className={`dashboard-body devotee-directory-page ${className}`.trim()}>
      <div className="page-intro">
        <div>
          <span className="eyebrow">Devotee directory</span>
          <h1>Devotees</h1>
          <p>Select a letter to browse devotees by name, or search by name, ID, phone number, or city.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus size={18} /> Add Devotee</Button>
      </div>

      <section className="panel alphabet-panel" aria-label="Filter devotees by first letter">
        <div className="alphabet-heading">
          <div>
            <h2>Browse by name</h2>
            <span>{allTotal} registered devotees</span>
          </div>
          <label className="resource-search devotee-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              aria-label="Search devotees"
              placeholder="Search devotees…"
            />
          </label>
        </div>

        <div className="alphabet-grid">
          <button
            className={`alphabet-tile alphabet-all ${letter === "ALL" ? "active" : ""}`}
            onClick={() => { setLetter("ALL"); setPage(1); }}
            type="button"
            aria-pressed={letter === "ALL"}
          >
            <strong>All</strong>
            <small>{allTotal}</small>
          </button>
          {LETTERS.map((item) => {
            const count = letterCounts[item] ?? 0;
            return (
              <button
                className={`alphabet-tile ${letter === item ? "active" : ""}`}
                key={item}
                onClick={() => { setLetter(item); setPage(1); }}
                type="button"
                disabled={count === 0}
                aria-pressed={letter === item}
                aria-label={`${item}, ${count} ${count === 1 ? "devotee" : "devotees"}`}
              >
                <strong>{item}</strong>
                <small>{count}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel devotee-results">
        <header className="devotee-results-header">
          <div>
            <h2>{letter === "ALL" ? "All devotees" : `${letter} devotees`}</h2>
            <span>{total} {total === 1 ? "record" : "records"}</span>
          </div>
        </header>

        <div className={`list-loading-wrap ${isLoading ? "is-loading" : ""}`}>
        <div className="devotee-table-head" aria-hidden="true">
          <span>Name</span>
          <span>Devotee ID</span>
          <span>Phone number</span>
          <span>City</span>
          <span>PIN code</span>
          <span>Poojas</span>
          <span>Edit</span>
        </div>

        <div className="devotee-list" aria-live="polite">
          {total === 0 ? (
            <div className="empty-state">
              <Users size={30} aria-hidden="true" />
              <strong>No devotees found</strong>
              <span>Choose another letter or change the search text.</span>
            </div>
          ) : paginatedRows.map((row) => (
            <article className={`devotee-directory-row ${row.hasException ? "profile-incomplete" : "profile-complete"}`} key={row.id}>
              <span className="devotee-avatar" aria-hidden="true">{row.fullName.charAt(0)}</span>
              <span className="devotee-name">
                {row.hasException ? <TriangleAlert size={17} aria-label="Profile information missing" /> : <CheckCircle2 size={17} aria-label="Profile complete" />}
                <strong>{row.fullName}</strong>
              </span>
              <span className="devotee-id mono">{row.devoteeNo}</span>
              <span className={`devotee-phone mono ${row.phone ? "" : "missing"}`}>
                <Phone size={15} aria-hidden="true" /> {row.phone ?? "Phone missing"}
              </span>
              <span className={`devotee-city ${row.city === "City missing" ? "missing" : ""}`}>
                <MapPin size={15} aria-hidden="true" /> {row.city}
              </span>
              <span className={`devotee-pin mono ${row.postalCode === "PIN missing" || !/^\d{6}$/.test(row.postalCode) ? "missing" : ""}`}>
                {row.postalCode}
              </span>
              <span className="pooja-count">
                <strong>{row.poojaCount}</strong>
                {row.poojaCount > 0 && (
                  <button
                    className="pooja-count-view"
                    type="button"
                    onClick={() => showPoojaDates(row)}
                    aria-label={`View ${row.fullName}'s pooja dates`}
                  >
                    <Eye size={15} />
                  </button>
                )}
              </span>
              <Button className="devotee-edit-button" variant="outline" onClick={() => setSelected(row)}>
                <Pencil size={16} /> Edit
              </Button>
            </article>
          ))}
        </div>
        <div className={`list-loading-overlay ${isLoading ? "is-active" : ""}`} aria-hidden="true">
          <span className="list-loading-spinner" />
        </div>
        </div>
        {total > 0 && (
          <nav className="list-pagination" aria-label="Devotee pages">
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
      </section>

      {savedMessage && (
        <Alert icon={CheckCircle2} tone="info" role="status" className="devotee-save-notice">
          {savedMessage}
        </Alert>
      )}

      <PageFooter />

      {selected && (
        <DevoteeEditor
          key={`${selected.id}-${selected.fullName}`}
          row={selected}
          onClose={() => setSelected(undefined)}
          onSave={saveRow}
        />
      )}
      {adding && (
        <DevoteeEditor
          row={{
            id: "",
            devoteeNo: "",
            fullName: "",
            phone: null,
            addressLine1: "",
            city: "City missing",
            state: "",
            postalCode: "PIN missing",
            poojaCount: 0,
            hasException: true,
            createdAt: "",
            modifiedAt: "",
          }}
          isNew
          onClose={() => setAdding(false)}
          onSave={(created) => {
            setRows((current) => [created, ...current].slice(0, PAGE_SIZE));
            setTotal((current) => current + 1);
            setAllTotal((current) => current + 1);
            setLetterCounts((current) => ({ ...current, [created.fullName.charAt(0).toUpperCase()]: (current[created.fullName.charAt(0).toUpperCase()] ?? 0) + 1 }));
            setAdding(false);
            setSavedMessage(`${created.fullName}'s profile was added.`);
          }}
        />
      )}
      {poojaDatesRow && (
        <PoojaDatesPopup
          row={poojaDatesRow}
          dates={poojaDates}
          loading={datesLoading}
          onClose={() => setPoojaDatesRow(undefined)}
        />
      )}
    </section>
  );
}

function PoojaDatesPopup({
  row,
  dates,
  loading,
  onClose,
}: {
  row: DevoteeDirectoryRow;
  dates: DevoteePoojaDate[];
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="pooja-editor-layer">
      <button className="pooja-editor-backdrop" aria-label="Close pooja dates" onClick={onClose} type="button" />
      <aside className="pooja-dates-popup" role="dialog" aria-modal="true" aria-labelledby="pooja-dates-title">
        <header className="pooja-dates-popup-header">
          <div>
            <span className="eyebrow">Pooja dates</span>
            <h2 id="pooja-dates-title">{row.fullName}</h2>
          </div>
          <button className="icon-button" aria-label="Close pooja dates" onClick={onClose} type="button"><X size={19} /></button>
        </header>
        <div className="pooja-dates-popup-body">
          {loading ? (
            <p className="pooja-dates-loading">Loading…</p>
          ) : dates.length === 0 ? (
            <p className="pooja-dates-empty">No poojas on file for this devotee.</p>
          ) : (
            <ul className="pooja-dates-list">
              {dates.map((date) => (
                <li key={date.enrollmentId} className={date.status !== "active" ? "is-inactive" : ""}>
                  <span className="pooja-dates-date">
                    <CalendarDays size={15} aria-hidden="true" />
                    {formatAnnualDisplayDate(date.annualMonth, date.annualDay)}
                  </span>
                  <span className="pooja-dates-who">
                    {date.relation === "Self" ? "Self" : `${date.beneficiaryName} (${date.relation})`}
                  </span>
                  <span className="pooja-dates-status">{date.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export function DevoteeEditor({
  row,
  isNew = false,
  onClose,
  onSave,
}: {
  row: DevoteeDirectoryRow;
  isNew?: boolean;
  onClose: () => void;
  onSave: (row: DevoteeDirectoryRow) => void;
}) {
  const [name, setName] = useState(row.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(row.dateOfBirth ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [phoneAlternate, setPhoneAlternate] = useState(row.phoneAlternate ?? "");
  const [email, setEmail] = useState(row.email ?? "");
  const [rashi, setRashi] = useState(row.rashi ?? "");
  const [nakshatra, setNakshatra] = useState(row.nakshatra ?? "");
  const [gotra, setGotra] = useState(row.gotra ?? "");
  const [addressLine1, setAddressLine1] = useState(row.addressLine1);
  const [addressLine2, setAddressLine2] = useState(row.addressLine2 ?? "");
  const [city, setCity] = useState(row.city === "City missing" ? "" : row.city);
  const [district, setDistrict] = useState(row.district ?? "");
  const [state, setState] = useState(row.state);
  const [postalCode, setPostalCode] = useState(/^\d{6}$/.test(row.postalCode) ? row.postalCode : "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [error, setError] = useState<string>();
  const [step, setStep] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
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
    if (!name.trim()) {
      setError("Devotee name is required.");
      return;
    }
    if (!acknowledged) {
      setError("Please confirm that you reviewed the devotee information.");
      return;
    }

    setError(undefined);
    startSaving(async () => {
      const result = await saveDevotee({
        id: isNew ? undefined : row.id,
        expectedModifiedAt: isNew ? undefined : row.modifiedAt,
        fullName: name,
        dateOfBirth,
        phone,
        phoneAlternate,
        email,
        rashi,
        nakshatra,
        gotra,
        notes,
        addressLine1,
        addressLine2,
        city,
        district,
        state,
        postalCode,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSave(result.devotee);
    });
  }

  function nextStep() {
    if (step === 1 && !name.trim()) {
      setError("Devotee name is required.");
      return;
    }
    setError(undefined);
    setStep((current) => Math.min(5, current + 1));
  }

  return (
    <div className="pooja-editor-layer">
      <button className="pooja-editor-backdrop" aria-label="Close devotee editor" onClick={onClose} type="button" />
      <aside className={`pooja-editor pooja-editor-modal ${step === 5 ? "devotee-review-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="devotee-editor-title">
        <header className="pooja-editor-header">
          <div>
            <span className="eyebrow">{isNew ? "New devotee" : "Devotee profile"}</span>
            <h2 id="devotee-editor-title">{isNew ? "Add Devotee" : row.fullName}</h2>
            <p>{isNew ? "Create a complete devotee profile." : `${row.devoteeNo} · ${row.poojaCount} active ${row.poojaCount === 1 ? "pooja" : "poojas"}`}</p>
          </div>
          <button className="icon-button" aria-label="Close devotee editor" onClick={onClose} type="button"><X size={21} /></button>
        </header>

        <form className={`pooja-editor-form ${step === 5 ? "devotee-review-form" : ""}`} onSubmit={submit}>
          {error && <Alert>{error}</Alert>}
          <div className="devotee-stepper" aria-label={`Step ${step} of 5`}>
            {["Personal", "Spiritual", "Address", "Notes", "Review"].map((label, index) => (
              <button
                className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""}
                key={label}
                onClick={() => { setStep(index + 1); setError(undefined); }}
                type="button"
                aria-current={step === index + 1 ? "step" : undefined}
              >
                <b>{step > index + 1 ? "✓" : index + 1}</b>
                <em>{label}</em>
              </button>
            ))}
          </div>
          {step === 1 && <section className="modal-form-section">
            <header>
              <span>01</span>
              <div><h3>Personal details</h3><p>Identity and contact information</p></div>
            </header>
            <FormField id="devotee-name" label="Full name">
              <input className="form-control" id="devotee-name" value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            <div className="dob-age-grid">
              <FormField id="devotee-dob" label="Date of birth">
                <FormattedDateInput className="form-control" id="devotee-dob" max={todayInputForDevotee()} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
              </FormField>
              <div className="calculated-age" aria-live="polite">
                <span>Current age</span>
                <strong>{ageFromDateOfBirth(dateOfBirth) ?? "—"}</strong>
                <small>{ageFromDateOfBirth(dateOfBirth) === null ? "Select DOB" : "years"}</small>
              </div>
            </div>
            <div className="pooja-editor-grid">
              <FormField id="devotee-phone" label="Primary phone">
                <input className="form-control" id="devotee-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </FormField>
              <FormField id="devotee-phone-alt" label="Alternate phone">
                <input className="form-control" id="devotee-phone-alt" inputMode="tel" value={phoneAlternate} onChange={(event) => setPhoneAlternate(event.target.value)} />
              </FormField>
            </div>
            <FormField id="devotee-email" label="Email address">
              <input className="form-control" id="devotee-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
          </section>}
          {step === 2 && <section className="modal-form-section">
            <header>
              <span>02</span>
              <div><h3>Spiritual details</h3><p>Details used while performing the pooja</p></div>
            </header>
            <div className="pooja-editor-grid">
              <FormField id="devotee-rashi" label="Rashi">
                <input className="form-control" id="devotee-rashi" value={rashi} onChange={(event) => setRashi(event.target.value)} />
              </FormField>
              <FormField id="devotee-nakshatra" label="Nakshatra">
                <input className="form-control" id="devotee-nakshatra" value={nakshatra} onChange={(event) => setNakshatra(event.target.value)} />
              </FormField>
            </div>
            <FormField id="devotee-gotra" label="Gotra">
              <input className="form-control" id="devotee-gotra" value={gotra} onChange={(event) => setGotra(event.target.value)} />
            </FormField>
          </section>}
          {step === 3 && <fieldset className="pooja-address-fields modal-form-section">
            <legend>03 · Primary address</legend>
            <FormField id="devotee-address-1" label="Address line 1">
              <input className="form-control" id="devotee-address-1" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
            </FormField>
            <FormField id="devotee-address-2" label="Address line 2">
              <input className="form-control" id="devotee-address-2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
            </FormField>
            <div className="pooja-editor-grid">
              <FormField id="devotee-city" label="City">
                <input className="form-control" id="devotee-city" value={city} onChange={(event) => setCity(event.target.value)} />
              </FormField>
              <FormField id="devotee-district" label="District">
                <input className="form-control" id="devotee-district" value={district} onChange={(event) => setDistrict(event.target.value)} />
              </FormField>
            </div>
            <div className="pooja-editor-grid">
              <FormField id="devotee-state" label="State">
                <input className="form-control" id="devotee-state" value={state} onChange={(event) => setState(event.target.value)} />
              </FormField>
              <FormField id="devotee-pin" label="PIN code">
                <input className="form-control" id="devotee-pin" inputMode="numeric" maxLength={6} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
              </FormField>
            </div>
          </fieldset>}
          {step === 4 && <section className="modal-form-section">
            <header>
              <span>04</span>
              <div><h3>Internal notes</h3><p>Visible only to temple staff</p></div>
            </header>
            <FormField id="devotee-notes" label="Notes">
              <textarea className="form-control pooja-notes" id="devotee-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </FormField>
          </section>}
          {step === 5 && (
            <section className="modal-form-section devotee-review-section">
              <header>
                <span><CheckCircle2 size={17} /></span>
                <div><h3>Review devotee profile</h3><p>Confirm the information before saving</p></div>
              </header>
              <div className="devotee-review-grid">
                <div className="review-row review-row-two">
                  <div><span>Name</span><strong>{name || "Not provided"}</strong></div>
                  <div><span>Date of birth / Age</span><strong>{dateOfBirth ? `${formatDisplayDate(dateOfBirth)} · ${ageFromDateOfBirth(dateOfBirth) ?? "—"} years` : "Not provided"}</strong></div>
                </div>
                <div className="review-row review-row-two">
                  <div><span>Primary phone</span><strong>{phone || "Not provided"}</strong></div>
                  <div><span>Alternate phone</span><strong>{phoneAlternate || "Not provided"}</strong></div>
                </div>
                <div className="review-row">
                  <div><span>Email</span><strong>{email || "Not provided"}</strong></div>
                </div>
                <div className="review-row review-row-three">
                  <div><span>Rashi</span><strong>{rashi || "Not provided"}</strong></div>
                  <div><span>Nakshatra</span><strong>{nakshatra || "Not provided"}</strong></div>
                  <div><span>Gotra</span><strong>{gotra || "Not provided"}</strong></div>
                </div>
                <div className="review-row review-address-box">
                  <div>
                    <span>Primary address</span>
                    <address>
                      <strong>{addressLine1 || "Address not provided"}</strong>
                      {addressLine2 && <strong>{addressLine2}</strong>}
                      <strong>{[city, district].filter(Boolean).join(", ") || "City not provided"}</strong>
                      <strong>{[state, postalCode].filter(Boolean).join(" — ") || "State and PIN not provided"}</strong>
                    </address>
                  </div>
                </div>
                <div className="review-row">
                  <div><span>Notes</span><strong>{notes || "Not provided"}</strong></div>
                </div>
              </div>
              <label className="review-acknowledgement">
                <input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); setError(undefined); }} />
                <span>I have reviewed the information and confirm it is correct.</span>
              </label>
            </section>
          )}
          <div className="pooja-editor-actions">
            {step === 1 ? (
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            ) : (
              <Button variant="outline" onClick={() => { setStep((current) => Math.max(1, current - 1)); setError(undefined); }}>
                <ChevronLeft size={16} /> Back
              </Button>
            )}
            {step < 5 ? (
              <Button onClick={nextStep}>Next <ChevronRight size={16} /></Button>
            ) : (
              <Button type="submit" disabled={!acknowledged || isSaving}>
                <CheckCircle2 size={17} /> {isSaving ? "Saving…" : isNew ? "Add Devotee" : "Save Profile"}
              </Button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}
