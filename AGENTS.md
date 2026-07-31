# AGENTS.md

## Mission

Build and maintain **Kambaru Devi Seva**, the administration application for Shree Durgaparameshwari Temple Kambar. Its initial annual seva workflow is **Shashwatha Pooja**. Optimize for correctness of annual scheduling, protection of devotee data, simple daily temple operations, and future expansion without premature complexity.

## Source of truth

Read `docs/PLAN.md` before implementation — it is the single combined
requirements, architecture, and high-level design document for this project:
product rules and acceptance criteria, system boundaries and data model, screens,
services, and delivery phasing all live there.

Record any product ambiguity rather than silently embedding a guess. The open
temple decisions in `PLAN.md` §12 are blockers only for the affected behavior; build
configurable placeholders where safe (e.g. the Feb 29 policy).

## Engineering principles

- Use a modular monolith and PostgreSQL. Do not introduce microservices without a measured need.
- Keep domain rules in server-side modules, independent from UI and vendor SDKs.
- Treat the temple timezone as explicit configuration. Never use the server's implicit local date for recurrence.
- Beneficiary is its own table, but `devotee_id`-scoped only — never globally shared or linked to another devotee's record, even if the same real person exists elsewhere. Saving a beneficiary once lets staff pick it again for that same devotee's future poojas instead of retyping. See `PLAN.md` §5 for the reasoning and its accepted tradeoff (no cross-devotee linking / no unified "Person" model).
- A devotee has one primary address (on the devotee row). Each enrollment has `address_mode`: `devotee_primary` (dynamically follows the devotee's current address — this is intentional, not a bug) or `custom` (its own inline address fields on that enrollment, independent of the devotee).
- Occurrences are the one place addresses get frozen: snapshot the resolved address (whichever mode) into the occurrence row so historical dispatch records don't change after later profile edits.
- Snapshot operational data in occurrences so history does not change after profile edits.
- Make scheduled jobs, imports, notifications, and webhook handlers idempotent.
- Prefer archive/status transitions to destructive deletes.
- Use database constraints in addition to application validation.
- Put schema changes in version-controlled migrations; never make undocumented production-only changes.
- Keep user-facing terminology externalized for local-language support.

## Repo layout

An npm workspaces monorepo — still **one deployed app** (frontend build depends on
backend at build time), so this doesn't contradict the modular-monolith decision in
`PLAN.md` §9.1; it just makes the "domain logic independent from UI" engineering
principle above a real package boundary instead of a folder convention.

```
Kambaru/
  package.json        # workspace root — "workspaces": ["frontend", "backend"]
  AGENTS.md
  docs/
    PLAN.md            # product/architecture source of truth
    BACKEND_PLAN.md    # executable backend delivery plan
  frontend/           # @kambaru/frontend — Next.js app: routes, components,
                       # Server Actions. Imports @kambaru/backend as a dependency.
  backend/            # @kambaru/backend — domain services + types, no UI code.
                       # Calls Supabase Postgres/RPC through repository interfaces.
                       # Exports everything through
                       # backend/src/index.ts — import from "@kambaru/backend",
                       # never reach into individual files across the package
                       # boundary.
  supabase/           # Supabase config, SQL migrations, RLS policies, and the
                       # small number of Edge Functions justified by external or
                       # scheduled workflows.
  infra/              # deployment notes, backup scripts, env templates (see
                       # infra/README.md). GitHub Actions workflows themselves
                       # must live at .github/workflows/ (a GitHub requirement).
```

Root-level commands (`npm run dev` / `build` / `start` / `lint`) delegate into the
`@kambaru/frontend` workspace. To pass extra CLI flags (e.g. a custom dev port),
run from inside `frontend/` directly (`cd frontend && npm run dev -- -p 3000`) —
npm's workspace flag forwarding for extra args is unreliable from the root.

## Build order

The frontend shell is complete; backend integration is now active:

1. Keep React interaction and presentation logic in `frontend/`.
2. Keep trusted temple/domain rules in `backend/`, independent of React and the
   Supabase SDK.
3. Backend services call Supabase tables for ordinary reads and PostgreSQL RPC
   functions for transactional multi-table mutations.
4. Use Supabase Edge Functions only for scheduled jobs, webhooks, notifications,
   or integrations that genuinely require their own server runtime.
5. Supabase tables are the only runtime application data source.

Do not move authorization or authoritative domain validation into browser code.

## Visual design direction

`PLAN.md` §10.8 holds the current palette (temple saffron/gold/kumkum/tulsi
tokens), typography pairing, layout, and motion conventions. Treat it as the
approved-but-not-final starting point — implement against it rather than inventing
a new theme, and update that section (not just the code) when it changes.

- Motion must degrade cleanly under `prefers-reduced-motion` — no animation is ever
  load-bearing for understanding or completing a task.
- Kumkum (warning/red) and tulsi (success/green) are semantic-only — never reuse
  them decoratively; the saffron accent is the only decorative brand color.

## UI Design System — Source of Truth

The application uses a saffron-orange, warm cream, temple-gold, and sandstone
visual identity. Kumkum red is reserved for errors and critical warnings; tulsi
green is reserved for success and active states. White surfaces keep operational
content readable.

The overall treatment is a restrained professional SaaS interface: neutral warm
backgrounds, white operational surfaces, subtle borders/shadows, and saffron used
as an accent rather than as a large field outside the navigation/branding areas.

Canonical machine-readable design tokens and shared primitive styles:
`frontend/app/globals.css`. Dashboard composition styles:
`frontend/app/dashboard.css`.

1. Global CSS variables are the source of truth for colours, spacing, shadows,
   radii, layout dimensions, and motion.
2. Hard-coded brand colours inside individual components or page-level CSS are not
   allowed unless explicitly justified in a nearby code comment.
3. All interface icons must use `lucide-react`; do not introduce another icon
   library.
4. Reuse shared components before creating page-specific alternatives. The core
   primitives are `Button`, `Card`, `StatusBadge`, `FormField`, `MetricCard`,
   `EmptyState`, `SectionHeader`, `Sidebar` (the application sidebar), and `Header`
   (the application header).
5. All reusable components accept `className` for controlled extension. Do not use
   `className` to bypass tokens or duplicate an existing component variant.
6. Tables and forms prioritize operational readability over decorative styling:
   readable row heights, clear labels, visible validation text, non-wrapping phone
   numbers, and safely wrapping addresses.
7. The approved dashboard structure must retain:
   - Five metric cards
   - Today's Pooja List
   - Upcoming Poojas
   - Quick Actions
8. Do not add a daily trend chart.
9. Do not add a separate Today's Pooja Summary panel.
10. New screens must support desktop, tablet, and mobile layouts. Mobile navigation
    uses an accessible drawer and critical pooja/address information must remain
    available.
11. New UI must meet keyboard, contrast, visible-focus, minimum touch-target, and
    reduced-motion accessibility requirements. Colour alone must never communicate
    status or validation.
12. Future UI implementations must review this section before introducing new
    styles.
13. Any intentional deviation from this design system must be documented in the
    pull request or a nearby code comment with a clear reason.

### Authentication Screens

Canonical login implementation: `frontend/app/login/page.tsx`.
Canonical authentication styling: `frontend/app/login/login.module.css`.

1. Login and future authentication screens use the same saffron, cream, gold, and
   kumkum design tokens as the main application.
2. Desktop authentication pages use a two-panel structure: temple branding and
   authentication form.
3. Mobile authentication pages use a compact temple banner above the form.
4. Authentication pages must not use generic blue SaaS styling.
5. Public signup and social login are out of scope unless explicitly approved.
6. Login forms use the shared `Button`, `Input`, `FormField`, and `Alert`
   components.
7. Password fields support an accessible, keyboard-operable visibility toggle.
8. Authentication errors are generic and never reveal whether a specific account
   exists.
9. Passwords, credentials, and authentication tokens are never logged or stored in
   local storage.
10. Successful authentication redirects staff to `/dashboard`.
11. Decorative temple imagery uses local optimized assets and is never required
    for form usability.
12. All authentication pages are responsive, keyboard accessible, compatible with
    password managers, and respect reduced-motion preferences.

## Default technology direction

Unless the project records a superseding architecture decision:

- TypeScript with strict mode
- Next.js using the App Router
- PostgreSQL and version-controlled Supabase SQL migrations
- Supabase Auth with Row Level Security
- A schema-aware validation library at all input boundaries
- Server-side PDF rendering with deterministic dimensions
- A test runner suitable for unit/integration tests plus Playwright for critical flows

Pin major dependencies and review generated lockfile changes.

## Security and privacy requirements

- Enforce authorization on the server and in database policies; hiding UI controls is insufficient.
- Never expose service-role credentials to browser code.
- Never commit secrets, production exports, diary photos, addresses, phone numbers, or other real devotee data.
- Never use real devotee data in tests or screenshots.
- Redact personal data from logs, telemetry, errors, and analytics.
- Validate and authorize every CSV/PDF export.
- Audit creates, edits, archives, imports, and status changes in the same transaction where practical.
- Treat audit events and finalized occurrence snapshots as append-only.
- Use parameterized queries and framework-safe output escaping.
- Add rate limits to authentication, exports, imports, and privileged endpoints.

## Data and date conventions

- UUIDs are internal identifiers; devotee numbers are stable human-readable references.
- Database timestamps are UTC.
- Annual recurrence is `annual_month` + `annual_day`; business service dates are SQL `date`.
- Display dates as unambiguous localized values such as `23 Mar 2027`.
- Store money in integer minor units with an ISO currency code.
- Normalize phones for lookup while preserving the entered display form.
- Use optimistic concurrency for editable master records.
- Add a unique constraint on `(enrollment_id, service_date)`.
- Interactive production pages must use bounded database-side pagination and
  filtering. `loadSnapshot()` is a compatibility/bulk-processing path only and
  must not be introduced into dashboard, directory, register, or typeahead reads.

## Change workflow

1. Identify the relevant requirement and acceptance criterion.
2. Update or add an architecture decision when changing a core technology or data rule.
3. Implement the smallest complete vertical slice.
4. Add or update migrations, policies, and tests together.
5. Run formatting, lint, type-check, unit/integration tests, and relevant end-to-end tests.
6. Verify migration behavior against a clean database and an upgraded database.
7. Update documentation when behavior or operations change.

Do not make deployment, billing, production data, domain, messaging, or irreversible migration changes without explicit authorization.

## Testing expectations

Every change to recurrence, enrollment, address selection, occurrence snapshots, labels, or authorization requires automated regression coverage.

Mandatory edge cases include:

- Month/day boundaries and Asia/Kolkata timezone behavior
- February 29 policy
- Multiple poojas for the same devotee/date
- Primary address edit (affects `devotee_primary` enrollments) versus a `custom` per-enrollment address (unaffected by it)
- Paused/cancelled exclusion
- Concurrent/repeated daily reconciliation
- Historical snapshot preservation
- More than 12 labels and partial-sheet starting positions
- Long/local-language address wrapping
- Deactivated-user denial

## UI conventions

- Today's operations are the default home screen.
- Search before create to reduce duplicates.
- Show impact counts before editing a shared address.
- Confirm destructive or broad changes in plain language.
- Preserve form values after validation errors.
- Provide keyboard navigation, accessible labels, and readable contrast.
- Do not display full personal data where a summary is sufficient.
- On printing, default to 100% scale and suppress browser headers/footers.

## Operational requirements

- Scheduled generation has a manual, authorized reconciliation path.
- Every job records date, duration, counts, exceptions, and result.
- Alert administrators when the daily job or notification fails.
- Backups are not considered complete until restore is periodically tested.
- Migration/import runs must be reviewable, traceable, and recoverable.
- Maintain a production runbook for failed jobs, user deactivation, restore, and label-printer setup.

## Pull request checklist

- Requirement/issue linked
- Authorization and privacy reviewed
- Migration and rollback/forward-fix plan reviewed
- Idempotency considered
- Timezone/date behavior tested
- Audit behavior tested
- PII-free logs and tests
- Automated checks pass
- Documentation/runbook updated
- Physical print test completed when label geometry changes
