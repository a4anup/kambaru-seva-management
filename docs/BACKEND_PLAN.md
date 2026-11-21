# Backend, Supabase, Database, and Frontend Integration Plan

Status: In progress — Supabase-only runtime, authentication, RLS, actor-scoped
reads, and persistent devotee/enrollment writes are implemented.
Goal: A development-ready application using a dedicated Supabase development
project, real authentication, persistent CRUD, authorization, audit events, and
backend-driven queries.

`PLAN.md` remains the product/architecture source of truth. `AGENTS.md` contains
mandatory engineering rules. This document is the executable delivery plan.

## 1. Final runtime architecture

```text
Staff browser
  -> Next.js React components
  -> Next.js server loaders / Server Actions
  -> @kambaru/backend domain services
  -> actor-scoped Supabase repository
  -> Supabase Postgres tables / PostgreSQL RPC functions
```

This is one Next.js deployment, not a separately hosted backend server.

- React owns presentation, form interaction, and non-authoritative validation.
- `backend/` owns trusted temple rules and safe view models.
- Supabase owns Auth, Postgres, constraints, RLS, triggers, and transactional RPC.
- Supabase Edge Functions are reserved for schedules, notifications, webhooks, and
  external integrations—not ordinary reads or CRUD.

## 2. Current state and gaps

Implemented:

- Initial Supabase schema migration.
- Devotee, beneficiary, enrollment, occurrence, and audit tables.
- Active-staff RLS, normalized phone indexes, timestamp triggers, and constraints.
- Supabase-only actor-scoped repository and backend read services.
- Supabase SSR authentication, protected routes, staff session header, and logout.
- Transactional devotee and enrollment RPC mutations with audit events.
- Persistent Server Actions for devotee and pooja create/edit flows.
- Production build, frontend lint, and strict frontend/backend type-checks.

Not development-ready yet:

- Repository reads fetch entire tables instead of applying search/filter/pagination
  in Postgres.
- Occurrence reconciliation/snapshots are missing.
- Audit, settings, staff management, week/month views, and secure exports are not
  connected.
- Automated database integration and RLS tests are not yet implemented.

## 3. Target repository layout

```text
frontend/
  app/
    actions/
      auth.ts
      devotees.ts
      beneficiaries.ts
      enrollments.ts
      occurrences.ts
      reports.ts
      labels.ts
    auth/callback/route.ts
  lib/supabase/
    browser.ts
    server.ts
    middleware.ts
  middleware.ts

backend/src/
  domain/
    recurrence.ts
    address-resolution.ts
    validation.ts
  repositories/
    contracts.ts
    supabase/
      devotees.ts
      beneficiaries.ts
      enrollments.ts
      occurrences.ts
      audit.ts
  services/
    auth-service.ts
    devotee-service.ts
    beneficiary-service.ts
    enrollment-service.ts
    occurrence-service.ts
    report-service.ts
    label-service.ts
    audit-service.ts
  types/
    commands.ts
    results.ts
    view-models.ts

supabase/
  migrations/
  seed.sql                    # optional local-only structural seed
  functions/                  # only when a scheduled/external workflow needs one

## 4. Phase 0 — development environment

### Work

1. Create a dedicated Supabase development project.
2. Keep production as a separate, empty future project.
3. Link the local CLI to development.
4. Add local-only environment variables:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   TEMPLE_TIMEZONE=Asia/Kolkata
   ```

5. Configure Auth:
   - email/password only;
   - public signup disabled;
   - localhost and preview callback URLs;
   - manually provision development staff users.
6. Ensure `.env*` secrets remain ignored.

### Acceptance

- `supabase db push` succeeds against development.
- A clean local database can be reset from migrations.
- No production credentials or real devotee data are committed.

## 5. Phase 1 — schema and authorization hardening

### Migration changes

Add `staff_profiles`:

- `user_id → auth.users`
- `display_name`
- `role` (`admin` initially)
- `is_active`
- `created_at`, `modified_at`, `deactivated_at`

Add/confirm:

- normalized phone lookup columns;
- optimistic-concurrency support using `modified_at`;
- archived fields instead of destructive deletion;
- temple configuration table only when the Settings screen needs it;
- database checks for valid recurrence dates and beneficiary ownership;
- unique `(enrollment_id, service_date)`;
- indexes for date, name, devotee number, normalized phone, PIN, state, rashi,
  nakshatra, gotra, status, and foreign keys.

Create a stable RLS helper such as `is_active_staff()` and update every policy:

- anonymous users: no access;
- active staff: authorized table actions;
- deactivated staff: immediate denial;
- audit events: select/insert only;
- finalized occurrence snapshots: immutable;
- service role: reserved for seed/admin automation, not ordinary app requests.

### Acceptance

- Anonymous and deactivated-user tests fail closed.
- Active staff can perform approved operations.
- Invalid beneficiary ownership and recurrence dates fail at database level.
- Clean and upgraded migration paths both pass.

## 6. Phase 2 — authentication and server clients

### Work

1. Add pinned `@supabase/supabase-js` and `@supabase/ssr`.
2. Create browser and cookie-aware server clients.
3. Use Supabase password authentication.
4. Add callback/session refresh handling.
5. Protect every route except `/login`.
6. Load the current active staff profile server-side.
7. Restore Header identity, notification count, and Logout only from authenticated
   backend data—never static values.
8. Implement logout and redirect to `/login`.
9. Use generic authentication errors without account enumeration.

### Acceptance

- Valid staff login reaches `/dashboard`.
- Invalid credentials show a generic error.
- Refresh preserves a valid session.
- Direct unauthenticated route access redirects to `/login`.
- Deactivated staff lose access.
- Tokens are never stored in local storage or logged.

## 7. Phase 3 — repository and query redesign

Replace `loadSnapshot()` with operation-specific contracts:

### Devotees

- `search(query, letter, page, pageSize)`
- `findById`
- `findByDevoteeNo`
- `count`
- `countLinkedPrimaryAddressEnrollments`

### Beneficiaries

- `listByDevotee`
- `findByIdForDevotee`

### Enrollments

- `search(filters, page, pageSize)`
- `listByDate`
- `listByRange`
- `listByMonth`
- `listByDevotee`
- `countByDate/range/month/status`

### Other

- occurrence reconciliation/query;
- audit query with filters/pagination;
- report aggregation;
- invitation-address query with normalized deduplication.

Requirements:

- Repository calls receive an actor-scoped Supabase client.
- Search/filter/pagination happens in Postgres.
- Domain services do not import the Supabase SDK.
- View models expose only fields each screen needs.
- No PII is logged on query failure.

### Acceptance

- The browser never receives all records merely to display one page.
- Existing filters return equivalent results using Postgres.
- Supabase query errors map to stable service errors.

## 8. Phase 4 — transactional mutations and audit

Create command schemas and PostgreSQL RPC functions for:

1. `create_devotee`
2. `update_devotee`
3. `archive_devotee`
4. `create_beneficiary`
5. `update_beneficiary`
6. `archive_beneficiary`
7. `create_shashwatha_pooja`
8. `update_shashwatha_pooja`
9. `change_enrollment_status`
10. Integrated new-devotee + beneficiary + pooja creation

Every RPC must:

- derive actor from `auth.uid()`;
- verify active staff;
- validate ownership and allowed transitions;
- use optimistic concurrency for edits;
- mutate records and append the audit event in one transaction;
- return a safe result;
- avoid accepting actor IDs from the browser.

Only applicable names are mandatory. Missing contact/address fields return warnings
and remain visible as incomplete profiles.

### Acceptance

- Devotee and pooja changes survive refresh.
- Concurrent stale edits return a conflict, not silent overwrite.
- Shared primary-address edits affect linked enrollments only.
- Custom enrollment addresses remain unchanged.
- Every successful mutation has one corresponding audit event.
- Failed mutations create neither partial records nor audit entries.

## 9. Phase 5 — frontend Server Action integration

### Devotees

- Replace local-only `saveRow`.
- Backend search and 10-row pagination.
- Create/edit/archive Server Actions.
- Revalidate relevant routes after mutation.
- Display backend field errors, warnings, and concurrency conflicts.

### Poojas

- Replace preview enrollment IDs.
- Backend devotee search and quick ID lookup.
- Load beneficiaries only for the selected devotee.
- Persist integrated multi-step create flow.
- Persist edit and status changes.
- Preserve form values after errors.

### Authentication/header

- Remove preview authentication notice.
- Populate staff identity from the session.
- Add working logout.

### Audit/settings/staff

- Replace placeholders only after their backend queries exist.

### Acceptance

- No local-only record IDs or session-only saves remain.
- All displayed operational records originate from backend view models.
- Mutations are authorized server-side and persist after refresh.

## 10. Phase 6 — occurrences and daily operations

Implement idempotent reconciliation:

```text
service date
  -> find eligible active annual enrollments in Asia/Kolkata
  -> resolve current beneficiary/phone/address
  -> upsert one occurrence per enrollment/date
  -> freeze recipient, phone, and address snapshot
  -> record job result and exceptions
```

Provide:

- authorized manual reconciliation;
- daily list from occurrences with a safe live-query fallback;
- operational status updates;
- job run counts/duration/result;
- paused/cancelled exclusion;
- immutable historical snapshots.

An Edge Function may run the schedule after manual reconciliation is proven.

### Acceptance

- Repeated/concurrent reconciliation creates no duplicates.
- Historical dispatch data does not change after profile edits.
- Missed scheduled execution can be recovered manually.

## 11. Phase 7 — reports, CSV, and labels

### Reports

- Apply date, devotee, PIN, state, rashi, gotra, nakshatra, relation, address mode,
  and status filters server-side.
- Backend pagination and aggregate counts.
- Authorized CSV generation with safe escaping.

### Labels

- Backend determines eligible recipients.
- Invitation mode includes devotee primary and custom beneficiary/enrollment
  addresses.
- Deduplicate normalized full addresses server-side.
- Keep label removal/preview client-side.
- Generate final PDF server-side with deterministic A4 dimensions.

### Acceptance

- More than 15 labels paginate correctly.
- Long Kannada addresses wrap safely.
- Exports do not expose unauthorized rows.
- Print defaults to 100% scale without browser headers/footers.

## 12. Phase 8 — enforce the Supabase-only runtime

- Make missing Supabase configuration fail fast with a safe error.
- Keep all application records in Supabase.
- Do not introduce file-backed or in-memory runtime repositories.

### Acceptance

- Repository scans find no file-backed application data source.
- Application boots and tests exclusively against Supabase/local Supabase.
- Development and production project separation is documented.

## 13. Automated testing

### Unit

- recurrence and month/day boundaries;
- Asia/Kolkata behavior;
- February 29 policy;
- address resolution;
- status transitions;
- invitation-address normalization.

### Database/integration

- clean migration and upgraded migration;
- RLS for anonymous, active, and deactivated users;
- beneficiary ownership;
- optimistic concurrency;
- transactional mutation + audit;
- idempotent occurrence reconciliation;
- snapshot immutability.

### End-to-end

- login/logout/route protection;
- create/edit devotee;
- create pooja for self;
- create/reuse beneficiary;
- primary versus custom address update;
- pause/resume;
- date filters and pagination;
- reports/CSV;
- daily labels and all-devotee invitation labels.

## 14. Developer commands and CI

Target root scripts:

```text
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run supabase:types
npm run seed:development
```

CI order:

1. install locked dependencies;
2. formatting/lint;
3. frontend and backend type-check;
4. unit tests;
5. start/reset local Supabase;
6. integration tests;
7. production build;
8. selected Playwright critical flows.

## 15. Definition of development-ready

The system is development-ready when:

- a new developer can clone, configure environment variables, apply migrations,
  and sign in using documented commands;
- all protected pages require a valid active-staff session;
- dashboard, devotees, poojas, reports, and labels read from Supabase;
- devotee and pooja create/edit/status workflows persist and audit correctly;
- backend queries own filtering and pagination;
- occurrences reconcile idempotently and preserve snapshots;
- there are no file-backed application records or local-only saves;
- lint, type-check, unit/integration tests, build, and critical E2E flows pass;
- backup and restore commands are documented and tested before production use.

## 16. Recommended implementation order

1. Development Supabase environment and migration validation.
2. Staff schema, hardened RLS, Auth, middleware, logout.
3. Operation-specific Supabase repositories.
4. Devotee mutations + audit; connect Devotees screen.
5. Beneficiary/enrollment mutations + audit; connect Poojas screen.
6. Backend date/range queries; connect dashboard/reports/labels.
7. Occurrence reconciliation and snapshots.
8. Secure CSV/PDF generation.
9. Verify the Supabase-only runtime.
10. Full automated checks and developer onboarding verification.


## Address verification (21 Nov 2026)

`20261121090000_address_verification.sql` adds constrained verification fields to
primary/custom addresses, audited actor/time triggers, RPC payload support, bounded
directory/register reads, resolved label statuses, and an immutable status snapshot
for new occurrences. Existing addresses default to Verified; historical occurrence
snapshots are untouched. See `PLAN.md` §5 for product semantics.

Regression command: `npm test` (Node test runner, PGlite PostgreSQL integration tests,
and Playwright component interaction tests). Install the test browser once with
`npx playwright install chromium`. Browser tests mount the real components with
synthetic Server Action responses; database tests exercise actual migrations, RPCs,
RLS, and audit behavior under a minimal Supabase Auth scaffold. They do not replace
an authenticated staging smoke test against Supabase.
