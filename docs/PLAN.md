# Kambaru Devi Seva — Project Plan
### (Shashwatha Pooja — Annual Recurring Seva & Prasada Dispatch Tracking System)

Status: **Planning — not yet implemented**
Initial users: ~5 temple staff
Last updated: 2026-07-30

> This single document is the combined requirements, architecture, and high-level
> design for the project. `AGENTS.md` (repo root) carries engineering conventions for
> whoever — human or AI agent — implements it, and defers to this document whenever
> the two disagree.

---

## 1. Background & Problem Statement

Shree Durgaparameshwari Temple Kambar runs a seva called **Shashwatha Pooja**: a
devotee pays ₹1000, and every year, on a fixed calendar date (typically a birthday),
the temple performs a pooja on their behalf and couriers prasada to an address.

Today this lives entirely in a paper diary — one page per date, with devotee details
handwritten under that day. Every morning, staff must find the right page, read
handwriting, and retype names/phones/addresses to prepare courier labels. It's slow,
error-prone, hard to audit, and address changes have to be found and corrected by hand
everywhere they appear.

## 2. Product Goal

Staff enter devotee and pooja information **once**. The application then reliably
surfaces, every day, exactly who is due — with correct contact/address details — and
produces print-ready courier labels, with no re-entry required in future years.

### Production reference numbers

- UUIDs remain the internal database identifiers.
- New devotees receive a stable staff-facing number in the form
  `KDP-DEV-000001` (six-digit sequence).
- New Shashwatha Poojas receive a date-scoped number in the form
  `KDP-SP-DDMM-0001` (four-digit sequence for that annual day/month), for example
  `KDP-SP-0102-0001` for the first pooja registered for 1 February.
- If an enrollment's annual date is corrected, its staff-facing pooja number is
  regenerated for the corrected date; audit history and relationships continue to
  use the immutable UUID.

### Success measures

- No eligible pooja is ever omitted from the daily list.
- Staff can prepare a day's dispatch list and labels without retyping any address.
- A devotee address update is reflected on every pooja that uses that address —
  unless that specific pooja was deliberately pinned to a different address.
- A staff member can find a devotee by name or phone in under 10 seconds.
- Every material record change is attributable to a staff user (audit trail).
- The daily list can be safely regenerated/rerun without creating duplicates.

## 3. Users & Roles

- ~5 named staff accounts to start, all provisioned manually (no public signup).
- All 5 accounts are equal **Staff/Admin** — full access to create/edit devotees,
  addresses, poojas, generate labels/exports, and view the audit log. No read-only
  role for MVP (confirmed: no current need for view-only access); can be added later
  without much rework if a trainee/volunteer/auditor situation comes up.
- Devotee self-service login is explicitly **out of scope** for MVP — planned for a
  later phase.

## 4. Scope

### MVP
1. Staff authentication (email + password) and access control.
2. Devotee management (contact info, rashi/nakshatra/gotra, primary address, notes) — the
   devotee is the "customer" record.
3. Annual pooja enrollment (the "order," per devotee) — recurring month+day, either
   "for self" or for a named beneficiary entered directly on the enrollment, an
   address choice (devotee's primary or a one-off custom address for this pooja
   only), payment info, status (active/paused/cancelled).
4. Day, week (Mon–Sun calendar week), month, and per-devotee views of who's due.
5. Print-ready A4 PDF with 15 courier address labels (3 cols × 5 rows), overflow to
   further pages.
6. CSV export of a day's/date-range's list.
7. Audit history for every create/edit/status change.
8. Basic import path for migrating existing diary data (even just a CSV template
   staff can fill in, validated before commit) — this project replaces years of
   paper records, so a migration path is part of MVP, not an afterthought.

### Later phases (design for, don't build yet)
- Devotee self-service portal (view/renew own enrollments).
- Daily summary notification to staff (email first; WhatsApp/SMS later).
- Online payment + renewal tracking, receipts.
- Multi-language (Kannada) interface and labels.
- Additional seva types / non-annual recurrence rules.
- Multi-temple support.

### Donations management enhancement

The authenticated staff application also manages individual donation transactions
and optional management-defined Donation Groups. A Donation always remains a
separate financial record, even when the donor name, phone, date, or amount matches
another record. A Donation Group is not a transaction: it groups zero or more
Donations, and its total/count/date summary is derived from those Donations.
Receipt numbers are not unique identifiers and may be repeated across independent
Donation records without a warning or confirmation step. The only currently active
Donation Type is `Renovation`; the lookup model remains so staff can add types later.

One Donation belongs to zero or one Donation Group. Mapping, moving, and unmapping
must never alter financial fields. Donations and groups may optionally link to an
existing Devotee, without requiring or synchronizing a Devotee record. Archiving a
group atomically unassigns its Donations and never deletes them. All mutations are
audited. Canonical staff routes are `/donations/360` and `/donations/list`.

Donation and Donation Group “Delete” controls perform recoverable archives. A
group archive atomically unmaps its Donations and preserves their financial and
review records; each automatic unmap and archive is audited.

Every Donation starts with `review_required`. Authorized staff can mark it
`reviewed`, recording `reviewed_at`, `reviewed_by`, optional review notes, and an
audit event. Material financial/source edits automatically reset review; Donation
Group mapping and unmapping do not. Assignment status is derived exclusively from
the nullable `donation_group_id` foreign key.

### Explicitly not in MVP
Public registration, online payment processing, full temple accounting, courier
provider integration, biometric/government-ID storage.

## 5. Core Concepts & Business Rules

**Model this like a customer and their orders.** The **Devotee** is the customer
record — one profile, one saved primary address, edited in one place. Each **Pooja
Enrollment** is like an order placed by that customer: it can use the customer's
default (primary) details, or override just for itself (a different recipient, a
different address) without touching the customer's actual profile.

### Devotee
The person who registers/pays. Full name, date of birth (with age calculated for
display), primary + optional alternate phone, optional email, rashi, nakshatra,
gotra, notes, one saved primary address, active/archived status.
Phone numbers are a great search key but **not** the identity — households share
numbers and numbers change.

### Beneficiary — saved under the devotee, reusable across their poojas
Who the pooja is actually performed for is either the devotee themselves, or a
beneficiary saved **under that devotee** so it can be picked again next time:
- A **"for self" flag**: when true, the pooja is for the devotee themselves — no
  beneficiary needed, the devotee's own details are used.
- When false, staff either **pick an existing beneficiary** from that devotee's own
  list (e.g. "Son", "Wife" — added once, reused on every future pooja for them) or
  **add a new one** (name + relation: son, daughter, wife, husband, father, mother,
  other), which is then saved under this devotee for next time.
- Editing a beneficiary's details updates every one of that devotee's poojas that
  reference them — same "edit once, updates everywhere" behavior as the primary
  address (see below).

This is a deliberate simplification: a beneficiary is **not** itself a devotee
record, and it is scoped to one devotee only — there's no attempt to link it to that
same person's own devotee profile if they happen to have one elsewhere (e.g. a
father saves "Son" as a beneficiary, and separately the son later registers his own
pooja as a devotee — these stay two unconnected records, and details get typed in
twice). That duplication is an accepted tradeoff for keeping the model simple; it
can be revisited later if it becomes a real pain point (see the "Person model" idea
noted as a possible future change, not adopted for MVP).

### Address — one primary per devotee, plus a one-off override per pooja
A devotee has **one saved primary address**. Editing it updates every active
enrollment that uses "devotee's primary address" — but before saving, show staff how
many enrollments will be affected, so a well-meaning edit doesn't silently redirect
someone else's prasada.

Each enrollment independently chooses:
- **"Same as devotee's primary address"** (linked — follows future edits), or
- **"Custom address for this pooja only"** — a one-off address typed directly onto
  that enrollment, not saved anywhere else, not affecting (or affected by) the
  devotee's primary address.

This two-way choice is what satisfies both requirements at once: address changes
propagate at the devotee level by default, *and* any individual pooja can be pinned
to a different address without an address book, labels, or a "copy address" step.

### Annual Pooja Enrollment
Connects: sponsoring devotee → beneficiary (self, or an existing/new saved
beneficiary under that devotee) → annual date → delivery address (primary or
custom) → payment metadata → status. Rules:

- A devotee may have multiple poojas, on different or even identical dates.
- The date is stored as **month + day only**, never a fixed year — it recurs forever.
- **February 29**: needs an explicit policy decision from the temple (options: observe
  Feb 28, observe Mar 1, only in leap years, or let staff choose manually per
  enrollment). Default to "Feb 28 in non-leap years" until the temple confirms
  otherwise — do not leave this unhandled, it will silently drop a pooja every 3 years.
- Status: `active`, `paused`, `cancelled`. Paused/cancelled enrollments never appear in
  the actionable daily list but are retained for history.
- Default fee ₹1000, stored per-enrollment (not hard-coded) in case it changes later.
- Prevent accidental exact duplicates; allow an explicit override for genuine
  duplicates (e.g. twins, or two separate poojas the family really did pay for twice).

### Historical snapshots
When a day's occurrence is generated, **snapshot** the recipient name, phone, and
address used at that moment onto the occurrence record itself. Later edits to the
devotee's or address's current details must not silently rewrite what was already
printed/dispatched/audited for a past date. This is the difference between "today's
live view" (always current) and "the historical record of what actually happened on
12 Aug 2025" (frozen at that time).

## 6. Functional Requirements

**Authentication** — Email/password login, admin-provisioned accounts (no public
signup), sessions expire, an admin can deactivate an account immediately.

**Devotee search & management** — Create/view/edit/archive a devotee; search by name
or phone; one detail screen shows the devotee's primary address and all of their
enrollments together, so staff never has to re-search mid-task.

**Primary address management** — Edit the devotee's one saved primary address; before
saving, show which active enrollments use it (i.e. those set to "same as primary")
so staff know the blast radius of the edit.

**Pooja enrollment** — Create/edit/pause/resume/cancel; pick devotee, then either
"for self" or pick an existing beneficiary under this devotee (or add a new one,
saved for reuse next time), choose address ("same as primary" or type a custom one
for this pooja), fee/payment reference, notes; review screen states it back in
plain language: *"Every year on 23 March, pooja for [beneficiary]; prasada to
[address]."*

**Daily / date view** — Defaults to today; shows count + full list (beneficiary,
sponsor, phone, address, notes); lets staff jump to any other date; a day can be
regenerated/reconciled without creating duplicate rows for the same enrollment+date.

**Week view** — Standard Monday–Sunday calendar week; shows the same list grouped
by day across those 7 dates, with next/previous week navigation, so staff can plan
or catch up across several days at once. Printing labels still happens per single
day (clicking into a day from the week view opens that day's Date Report) — a
physical label sheet is never mixed across two different dispatch days.

**Month view** — Pick a month; shows every active enrollment whose annual date
falls in it, grouped and sorted by day, with a total count — useful for spotting
busy days ahead of time and planning prasada/packaging supply needs.

**Per-devotee view** — From a devotee's detail page: every enrollment tied to that
devotee (active, paused, and cancelled), each with its own recurring date,
beneficiary, address, and status — effectively that devotee's personal seva
calendar in one place.

**Courier label PDF** — A4, exactly 15 label positions (3×5) per page, recipient name +
full address + phone per label, additional pages beyond 15; staff can choose a starting
position to reuse a partially-used physical sheet; preview before printing; labels
default to 100% scale with no browser header/footer. Labels
can also be generated for temple-wide invitations. The invitation list includes every
devotee primary address and every custom beneficiary/enrollment delivery address, with
identical normalized full addresses emitted only once so a household does not receive
duplicate invitations.

**Import/export** — CSV export of a date/date-range's list; a documented CSV template
+ validation-before-commit flow for migrating existing diary records, so staff can
review and roll back a bad batch rather than commit garbage straight to production.

**Audit** — Every create/edit/status-change records actor, timestamp, entity,
before/after values. Append-only.

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Cost | Hosting should run at **$0/month** on free tiers given the current scale (2–3 active users). Revisit the tradeoffs in §9.4 if reliability needs grow. |
| Reliability | Automated backups matter — the diary being replaced is itself the backup today, so once staff stop keeping it in parallel, data loss risk shifts entirely onto this app. |
| Performance | Operational lists use database-side filtering, stable ordering, aggregation, and bounded pagination. Dashboard and calendar counts use aggregate read models. Whole-table snapshots are prohibited on interactive production paths; bulk reports and labels must use authorized server-side batches. Load-test the release dataset at 10,000+ devotees/enrollments before launch. |
| Security & privacy | HTTPS only; every route except login requires an authenticated session; personal data (phone, address) never appears in logs/analytics; secrets stay server-side. |
| Accessibility | Responsive on desktop/tablet/mobile browser; clear validation messages; unambiguous date display (e.g. `23 Mar`). |
| Maintainability | Version-controlled DB migrations; business rules (recurrence, address rules) testable independent of the UI. |
| Localization | Not needed at launch, but keep user-facing strings out of deep component logic so Kannada support later isn't a rewrite. |

## 8. Key Workflows

**Register a new annual pooja — one integrated, two-step flow.**
"Add Pooja" always uses two visible steps in the same modal; the admin never has
to create the devotee as a disconnected earlier task:

1. **Select devotee:** search by name, devotee number, or phone and confirm the
   selected record. If no match exists, create the full devotee profile inline and
   continue — no navigating away. Pooja fields stay hidden until this step completes.
2. **Add pooja:** choose "for self" or pick/add a beneficiary, choose the dispatch
   address, enter annual date and payment information, review, and save.

The modal presents this as five clickable sections: **Devotee**, **Beneficiary &
Annual Date**, **Spiritual Details & Remarks**, **Address**, and **Review**. Choosing
Self reuses the devotee name, spiritual details, and primary address. Review requires
an explicit staff acknowledgement before Add Pooja is enabled.

The pooja appears immediately on the devotee's timeline; any newly-added
beneficiary is now available to pick for their next pooja too. (A devotee can still
be created standalone, with no pooja yet, from the Devotees screen — useful for
pre-loading the directory from the old diary — but that is not the primary daily-use
path.)

**Change the devotee's primary address:** open the devotee → edit the primary
address → see how many active enrollments are set to "same as primary" and will be
affected → confirm and save → any enrollment using a custom address for itself is
untouched → past occurrence snapshots stay unchanged regardless.

**Daily operation:** open Today → see count + full list → resolve any exceptions
(e.g. missing phone/address) → generate & print the label sheet → done.

---

## 9. Architecture

### 9.1 Approach

A **modular monolith**, not microservices — five staff users and a few hundred
devotees do not justify that complexity. One Next.js app, one Postgres database,
clear internal module boundaries (devotees / beneficiaries / enrollments /
occurrences / documents / audit) so it stays easy to extend later without becoming
a tangle.

In code, that boundary is a real npm-workspaces package split — `frontend/`
(Next.js UI) depends on `backend/` (trusted domain services/types) as a workspace
dependency. The backend calls Supabase Postgres directly for ordinary reads and
uses PostgreSQL RPC functions for transactional workflows. `supabase/` contains
versioned SQL migrations, RLS policies, and exceptional Edge Functions. Still one
deployed Next.js app; see
`AGENTS.md` "Repo layout" for the full tree and build commands.

### 9.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js (App Router, TypeScript)** | One framework, one repo, one deploy; Server Actions remove the need for a separate API service at this scale. |
| UI | **Tailwind CSS + shadcn/ui** | Fast, clean admin forms/tables without building a component library from scratch. |
| Database | **PostgreSQL** | Real relational integrity for the devotee/address/enrollment/occurrence graph — this data model genuinely needs foreign keys and constraints. |
| DB + Auth host | **Supabase (free tier)** | Free Postgres + email/password auth out of the box; see §9.4 for the tradeoff this implies. |
| Data access | **Backend repository + Supabase PostgREST/RPC** | Keeps domain rules vendor-independent while using Supabase tables directly; versioned SQL migrations remain the database source of truth. |
| Hosting | **Vercel (free/hobby tier)** | Native Next.js host, auto-deploys on every push to `main` — this is the "automation" piece for deployment. |
| PDF generation | **`@react-pdf/renderer`** (server-side) | Deterministic label geometry regardless of the admin's browser/printer, needed for a physical 15-per-A4 cut sheet. |
| Source control / CI | **GitHub + GitHub Actions** (lint/typecheck) | Free for a small private repo; Vercel's GitHub integration handles deploy automation. |

### 9.3 System diagram

```
                    ┌─────────────────────────┐
                    │      Staff Browser        │
                    │   (~5 named accounts)     │
                    └───────────┬───────────────┘
                                │ HTTPS
                                ▼
                    ┌─────────────────────────┐
                    │   Next.js App (Vercel)    │
                    │  - Pages / Server Actions │
                    │  - Auth middleware        │
                    │  - Label PDF generation   │
                    └───────────┬───────────────┘
                                │ Supabase client / SQL RPC
                                ▼
                    ┌─────────────────────────┐
                    │   Supabase Postgres       │
                    │  devotees, beneficiaries, │
                    │  enrollments, occurrences,│
                    │  audit_log                │
                    └─────────────────────────┘

  GitHub (main branch) ──push──▶ Vercel (build + deploy, automatic)
```

### 9.4 Hosting tradeoff — be explicit about this

Supabase's **free tier** has two real limits worth knowing going in:
- Free projects can pause after a week of inactivity (a visit wakes it back up, with a
  short cold-start delay — a minor annoyance, not a data-loss risk).
- Free tier does **not** include automated daily backups the way the paid tier does.

Given the stated scale (2–3 people, low budget), start on the free tier. But because
this app will become the *only* record of the diary once migration happens, treat
backups as non-negotiable some other way:
- Minimum: a scheduled `pg_dump` (e.g. free GitHub Actions cron) exporting to a
  private storage location weekly, so there's at least one restorable copy outside
  Supabase itself.
- If/when the temple is comfortable with a small recurring cost, Supabase's paid tier
  (~$25/month) adds real automated backups and removes the pause behavior — worth
  revisiting once the app is the sole source of truth, but not required to start.

### 9.5 Security

- Every route but `/login` requires an authenticated session (enforced server-side,
  not just hidden in the UI).
- Row Level Security on Supabase tables denies anonymous access by default.
- Service-role credentials never reach browser code.
- Personal data (name/phone/address) excluded from logs, error tracking, analytics.
- CSV/PDF export endpoints check authorization on every call.

---

## 10. High-Level Design

### 10.1 Data model

```
Devotee                                              (the "customer")
  id, devotee_no (human-readable), full_name, date_of_birth, phone_primary, phone_alternate,
  email, rashi, nakshatra, gotra, notes,
  address_line1, address_line2, address_city, address_district, address_state,
  address_postal_code                  (one saved primary address, inline),
  archived_at, created_at, modified_at

Beneficiary                        (saved under one devotee, reusable across their poojas)
  id, devotee_id → Devotee, full_name,
  relation (son|daughter|wife|husband|father|mother|other),
  phone, rashi, nakshatra, gotra, notes (all optional), archived_at,
  created_at, modified_at

PoojaEnrollment                                      (the "order")
  id, devotee_id → Devotee,
  for_self (boolean),
  beneficiary_id → Beneficiary      (required only when for_self = false;
                                     must belong to the same devotee_id)
  annual_month, annual_day, leap_day_policy,
  address_mode              enum: devotee_primary | custom
  custom_address_line1, custom_address_line2, custom_address_city,
  custom_address_district, custom_address_state, custom_address_postal_code
  status (active|paused|cancelled),
  fee_minor, currency, payment_reference, enrollment_date, notes, created_by,
  created_at, modified_at

PoojaOccurrence            (generated/reconciled per enrollment per calendar date)
  id, enrollment_id → PoojaEnrollment, service_date,
  recipient_name_snapshot, address_snapshot_json,
  operational_status (pending|prepared|packed|dispatched|exception),
  generated_at

AuditEvent
  id, actor_id, action, entity_type, entity_id, before_json, after_json, occurred_at
```

Key modeling decisions, and why:
- **`annual_month` + `annual_day`, never a full date** — the recurrence is the whole
  point; storing a year would require yearly upkeep and risks silently "expiring."
- **Beneficiary is its own table, but scoped to one devotee** (`devotee_id` FK, not
  globally shared) — lets staff pick a previously-added beneficiary (e.g. "Son") for
  a second/third pooja instead of retyping their details every time, while keeping
  the model simple (see §5). The tradeoff: if that same real person is later
  registered as their own devotee, the two records still won't be linked — accepted
  for now in favor of simplicity.
- **Address lives on the Devotee row directly (one primary), with a per-enrollment
  override** — `address_mode` on the enrollment picks "devotee_primary" (dynamic,
  follows edits to the devotee row) or "custom" (its own inline fields on that
  enrollment, untouched by devotee edits and touching nothing else). No address
  book, no "copy address" step needed to get both behaviors.
- **PoojaOccurrence snapshots** — the daily/historical view is generated from live
  enrollment data but frozen into its own row once generated, so later edits to a
  devotee's address don't rewrite what was already dispatched last year.
- **`UNIQUE(enrollment_id, service_date)`** on occurrences makes "regenerate today's
  list" idempotent — safe to rerun without duplicating anyone.

### 10.2 Determining who's due — day / week / month / devotee

**Day** (the base case — week and month are just this applied repeatedly):
```
input: serviceDate (a real calendar date, e.g. today)
eligible = active enrollments where
  annual_month = serviceDate.month AND annual_day = serviceDate.day
  (apply leap_day_policy when serviceDate is Feb 28/29 or Mar 1, per enrollment)
ordered by beneficiary name (stable, predictable printing order)
```

**Week** (Monday–Sunday calendar week):
```
input: any date within the target week
week_start = that date rolled back to its Monday
days = [week_start, week_start+1, ..., week_start+6]
for each day in days: run the Day query above
group results by date, in Monday→Sunday order
```

**Month:**
```
input: a month (calendar year only matters for leap-day display context)
eligible = active enrollments where annual_month = the chosen month
  (Feb 29 entries included per leap_day_policy)
group by annual_day, ordered ascending, with a running total count
```

**Per devotee** (no date logic at all):
```
eligible = all enrollments where devotee_id = the chosen devotee
  (active, paused, and cancelled all included — this view is a history, not a
  dispatch list, so nothing is filtered out by status)
ordered by annual_month, annual_day
```

Occurrences can either be generated by a lightweight scheduled job (nice-to-have) or
computed live, on-demand, when staff open a view (sufficient for MVP — at this scale
there's no need for a background job just to answer a query that's cheap to run
live). If a scheduled reconciliation job is added later, it must be idempotent —
safe to rerun without creating duplicate occurrence rows — and the live query
should remain as a fallback so a missed/broken job can never silently hide a pooja.

### 10.3 Screens

1. **Login**
2. **Today** (default landing page) — date picker, count, full list, "Print labels",
   "Export CSV"; toggle to **Week** (Mon–Sun, grouped by day) or **Month** (grouped
   by day, running total) views from the same screen.
3. **Devotees** — search list → **Devotee Detail**: sections for Summary (incl.
   primary address) / Beneficiaries (this devotee's saved list) / Poojas (the
   per-devotee view — every enrollment, any status, in one place) / History, so
   nothing requires re-searching.
4. **Add/Edit Enrollment** — guided single-page form (devotee → for-self, or
   pick/add a beneficiary → date → address choice → payment → plain-language
   review) as in §8.
5. **Date Report** — any single chosen date's list + label-sheet generation (the
   destination when drilling into one day from the Week/Month view).
6. **Import** — CSV template download, validate-before-commit for diary migration.
7. **Audit log** — simple filterable list (who changed what, when).
8. **Staff accounts** (can land in phase 1.5) — add/deactivate the ~5 logins.

### 10.4 Label sheet

- A4, 3 columns × 5 rows = 15 rectangular address slots per page. Each slot: recipient name, full
  address, phone — printed on plain A4, then cut with scissors and pasted onto
  courier packets (not adhesive labels).
- Rendered server-side (`@react-pdf/renderer`) for consistent geometry across
  browsers/printers, rather than relying on a browser print dialog.

**Pagination — pack tight, never spread thin:**

```
pages_needed = ceil(devotees_due / 15)
fill slots sequentially, page by page, in a stable order (e.g. name or PIN code)
  → page 1 fills completely before page 2 starts, etc.
```

Every page except possibly the last is always full (15/15). Blank slots can only
ever occur on the last page, and only when the day's count isn't an exact multiple
of 15 — e.g. 7 due → one page (7 filled, 8 blank); 15 due → one full page; 30 due
→ two full pages (15 and 15). This is what
"not wasting paper" means in practice: the app never starts a second page while the
first still has room, and never leaves an earlier page sparse.

Each print run always starts fresh at slot 1 (no cross-day carryover of a
partially-cut physical sheet) — simpler, and avoids depending on real-world paper
state the app can't actually see.

### 10.5 Service boundaries

The browser does not own authoritative temple rules. React components handle form
interaction and presentation; Next.js Server Actions/loaders call the `backend/`
domain services. Those services query Supabase tables for normal reads and invoke
PostgreSQL RPC functions for transactional multi-table writes. Supabase Edge
Functions are reserved for scheduled jobs, webhooks, notifications, and external
integrations—not used as an unnecessary hop for every CRUD operation.

- `DevoteeService.create/update/search/archive` (includes updating the primary address)
- `BeneficiaryService.create/update/archive/listByDevotee` (scoped to one devotee)
- `EnrollmentService.create/update/changeStatus/listByDate`
- `DocumentService.renderLabelSheet`
- `ImportService.validate/commit`
- `AuditService.query`

All mutations run server-side inside a single DB transaction, including the audit
write — never split "save the record" and "log the audit entry" across two calls.

### 10.6 Validation rules

- For the current staff-entry phase, only applicable person names are mandatory
  (devotee name, and beneficiary name when not for self). All other fields may be
  saved incomplete and surfaced as profile/dispatch warnings for later correction.
- Postal code: when complete, use 6 digits for Indian addresses; an incomplete
  value is a warning rather than a save blocker in the current phase.
- Valid month/day combination; Feb 29 handled per the configured policy.
- Fee: non-negative integer (store as integer minor units, e.g. paise, to avoid
  floating-point money bugs).
- `beneficiary_id` required when `for_self = false`; ignored/cleared when
  `for_self = true`.
- A selected beneficiary must belong to the same `devotee_id` as the enrollment —
  never allow picking another devotee's beneficiary.
- Custom address fields are optional for now and flagged when incomplete; ignored
  when `address_mode` is not `custom`.

### 10.7 Testing strategy

- **Unit:** annual date matching + leap-day policy; enrollment status transitions;
  primary-vs-custom address resolution; `for_self` field enable/disable logic;
  beneficiary-belongs-to-devotee check; label grid pagination/start-offset math;
  week rolled to the correct Monday across month/year boundaries (e.g. a week
  spanning 29 Jan–4 Feb, or 28 Dec–3 Jan); month view grouping/day-ordering.
- **Integration:** auth checks; transactional enrollment creation; duplicate
  detection; occurrence snapshot immutability; audit event creation; CSV import
  validation.
- **End-to-end:** sign in → register a devotee + pooja for a new beneficiary; add a
  second pooja for the same devotee, reusing that beneficiary from the picker; edit
  the beneficiary's details and confirm both poojas reflect it; edit the devotee's
  primary address and confirm only "same as primary" enrollments are affected, not
  ones with a custom address; open Today, resolve an exception, print labels.
- **Physical:** print the actual 15-label PDF at 100% scale on the temple's printer
  and check alignment against the real cut sheet before relying on it operationally.

### 10.8 Visual design direction (first pass — expected to evolve)

Validated as an interactive frontend; approved to build against, not locked in.

**Palette** — a restrained professional SaaS surface system with temple warmth.
Saffron remains the brand accent, but large operational surfaces stay neutral and
low-saturation so long daily sessions remain comfortable:

| Token | Light | Dark | Use |
|---|---|---|---|
| Background | `#F7F6F4` | — | Page ground |
| Surface | `#FFFFFF` | — | Cards, tables, panels |
| Ink | `#292521` | — | Primary text |
| Accent — saffron | `#D65B18` | — | Primary actions and brand emphasis |
| Accent-deep | `#9F3F0E` | — | Pressed/hover states |
| Gold | `#AD7F2C` | — | Restrained trim and brand details |
| Warning — kumkum | `#963B24` | — | Exceptions only — never used decoratively |
| Success — tulsi | `#39704A` | — | "Ready"/active status only |

**Typography:** serif display face (system stack) for the temple name and large
stat numerals; a plain humanist sans for all operational labels/buttons/tables
(legibility first — daily users are non-technical staff); a monospace/tabular-nums
face for phone numbers, dates, and counts — a small nod to the paper ledger this
app replaces.

**Layout:** persistent left rail (temple brand mark + 5 nav destinations: Today,
Devotees, Import, Audit log, Staff accounts) beside the main content area. Home
screen stacks: stat tiles (Today / Tomorrow / This Week / This Month) → exceptions
banner → 7-day forward strip → today's actionable table with Print Labels / Export
CSV / Add Pooja actions.

**Motion** (everything must degrade cleanly under `prefers-reduced-motion`):
staggered fade-up entrance on load (header → tiles → banner → strip → table); stat
tile numbers count up from 0; tiles/rows/buttons lift gently on hover; today's tile
and today's day-chip carry a slow ambient glow. No motion is load-bearing.

## 11. Delivery Plan

**Build order: frontend first, then Supabase-backed services.** The UI-first phase
established the screens and service contracts. Backend integration is now active:
preserve those frontend call sites while moving reads and writes to Supabase
through the backend repository/service boundary.

**Phase 0 — discovery:** confirm open decisions in §12 with the temple; collect a
real diary page (redacted) and the actual A4 label sample/printer details.

**Phase 1 — foundation:**
- **1a — frontend shell:** Next.js app in `frontend/`, Tailwind theme from §10.8
  and routes from §10.3. **Done.**
- **1b — backend wiring:** repo CI (lint/typecheck), versioned Supabase SQL
  migrations/RLS under `supabase/`, and Supabase Auth/Postgres wired into
  `backend/` behind the existing service signatures, plus audit scaffolding.

The staged implementation details for the backend boundary, frontend Server
Actions, and Supabase repository are maintained in
[`BACKEND_PLAN.md`](BACKEND_PLAN.md).

**Phase 2 — core records:** devotees (with primary address), beneficiaries (per
devotee), enrollment lifecycle (beneficiary/address choice, payment), search — now
against the real database.

**Phase 3 — daily operations:** Today/Week/Month/per-devotee views, label PDF, CSV
export — real data end to end.

**Phase 4 — migration:** CSV import/validation, physical print calibration, parallel
run alongside the paper diary for 2–4 weeks before treating the app as the sole
source of truth.

**Phase 5 (later):** devotee self-service, notifications, payments, localization.

## 12. Decisions Needed From the Temple

### Resolved
- **₹1000 fee:** confirmed one-time, not a renewing annual charge.
- **Read-only/auditor accounts:** not needed — all 5 accounts are equal Staff/Admin
  (see §3).
- **February 29:** no current enrollments fall on this date, so it isn't an active
  concern today. Still build it as a configurable policy (default: observe Feb 28 in
  non-leap years) rather than leaving it unhandled — cheap to build in now, and it
  will matter the day someone's birthday happens to be Feb 29.

### Still open
1. Exact physical label sample: dimensions, margins, font — to calibrate the PDF
   before the first real print run.
2. How long should cancelled enrollments and audit history be retained?
3. Any additional fields the diary currently records that aren't listed here (e.g.
   gotra, sankalpa name)?

---

*Engineering conventions, folder structure, and setup commands for implementation
live in `AGENTS.md` at the repo root.*
