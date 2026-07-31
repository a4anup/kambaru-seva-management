# Backend Implementation Plan

Status: Proposed  
Scope: Replace direct fixture usage with a real backend boundary, initially backed
by JSON files and later by PostgreSQL without changing frontend call sites.

This plan extends `PLAN.md` §9–§11. The application remains one modular monolith:
the Next.js frontend and backend package are deployed together; this is not a
separate microservice.

## 1. Target dependency flow

```text
Browser components
       |
       | Server Actions / server-rendered page loaders
       v
frontend/lib/server (server-only bridge)
       |
       v
backend application services
       |
       v
repository interfaces
       |
       +--> Json repositories (now)
       |
       `--> Prisma/PostgreSQL repositories (later)
```

Rules:

- Frontend components never import JSON files, fixture generators, repository
  implementations, or database clients.
- Only server-side frontend modules may call backend services.
- Type-only imports may come from `@kambaru/backend` until a separate contracts
  package is justified.
- Domain services depend on repository interfaces, never on JSON or Prisma.
- Switching databases happens in one composition/factory module.
- Authorization, validation, audit creation, and transactions belong on the server.

## 2. Transitional JSON database

Create versioned, database-shaped files:

```text
database/
  fixtures/
    metadata.json
    devotees.json
    beneficiaries.json
    pooja_enrollments.json
    pooja_occurrences.json
    audit_events.json
```

`metadata.json` contains `schema_version`, generation time, synthetic-data marker,
record counts, and temple timezone. Table files use database-style snake_case keys,
including:

- `id`
- foreign keys such as `devotee_id`
- `created_at`
- `modified_at`
- `archived_at` where applicable

The current 100 devotees, 105 beneficiaries, and 250 enrollments will be exported
to these files. The generator remains a development utility, not an application
runtime dependency. Runtime code reads the checked-in JSON rows.

Timestamp rules:

- On create: set `created_at` and `modified_at` to the same current UTC timestamp.
- On update/status change/archive: preserve `created_at`; replace `modified_at`.
- Audit records use their own immutable `occurred_at`.
- All timestamps are ISO-8601 UTC strings.
- Business service dates remain `YYYY-MM-DD`; annual recurrence remains month/day.

### JSON limitations

JSON is a transitional development adapter, not production persistence. Local
development can support writes using an atomic temporary-file-and-rename operation
plus a process-local write lock. It cannot guarantee safe concurrent writes across
multiple server processes, and Vercel's deployed filesystem cannot be treated as
durable storage. Production data entry starts only after the PostgreSQL adapter is
enabled.

## 3. Backend package structure

```text
backend/src/
  domain/
    devotees/
    beneficiaries/
    enrollments/
    occurrences/
    audit/
    shared/
  application/
    devotee-service.ts
    beneficiary-service.ts
    enrollment-service.ts
    occurrence-service.ts
    report-service.ts
    label-service.ts
    audit-service.ts
  repositories/
    contracts.ts
    json/
      json-store.ts
      devotee-repository.ts
      beneficiary-repository.ts
      enrollment-repository.ts
      occurrence-repository.ts
      audit-repository.ts
    prisma/                    # added during PostgreSQL phase
  validation/
    devotee-schemas.ts
    beneficiary-schemas.ts
    enrollment-schemas.ts
    query-schemas.ts
  composition/
    create-services.ts
  index.ts
```

The current display-specific row types can remain temporarily, but database rows,
domain entities, commands, and view models should be distinct types. Repository
mappers handle snake_case JSON/database rows ↔ camelCase domain entities.

## 4. Repository contracts

Repositories expose persistence operations only. They contain no UI formatting.

### DevoteeRepository

- `findById(id)`
- `findByDevoteeNo(devoteeNo)`
- `search({ query, page, pageSize, includeArchived })`
- `list({ filters, page, pageSize })`
- `create(devotee)`
- `update(devotee, expectedModifiedAt)`
- `archive(id, actorId)`
- `countPrimaryAddressEnrollments(id)`

### BeneficiaryRepository

- `findById(id)`
- `listByDevotee(devoteeId)`
- `create(beneficiary)`
- `update(beneficiary, expectedModifiedAt)`
- `archive(id, actorId)`
- Always verify that a beneficiary belongs to the selected devotee.

### EnrollmentRepository

- `findById(id)`
- `listByDate(serviceDate)`
- `listByRange(from, to)`
- `listByMonth(month)`
- `listByDevotee(devoteeId, includeInactive)`
- `search(filters, pagination)`
- `findPotentialDuplicate(command)`
- `create(enrollment)`
- `update(enrollment, expectedModifiedAt)`
- `changeStatus(id, status, expectedModifiedAt)`

### OccurrenceRepository

- `findByEnrollmentAndDate(enrollmentId, serviceDate)`
- `listByDate(serviceDate)`
- `upsertSnapshot(occurrence)`
- Enforce one occurrence per `(enrollment_id, service_date)`.

### AuditRepository

- `append(event)`
- `query(filters, pagination)`
- No update or delete method.

## 5. Application services

Services own business behavior and return frontend-ready results:

- `DevoteeService`: create, update, archive, search, directory pagination, profile.
- `BeneficiaryService`: create/update/archive and list within one devotee.
- `EnrollmentService`: create/update/status change, duplicate warning, day/week/
  month/devotee queries, address resolution.
- `OccurrenceService`: idempotent daily reconciliation and immutable snapshots.
- `ReportService`: combined filters for date, devotee, PIN, state, rashi,
  nakshatra, gotra, status, relation, and address mode.
- `LabelService`: daily labels and deduplicated all-devotee invitation labels.
- `AuditService`: authorized, paginated history.

Mutation flow:

```text
validate input
  -> authorize actor
  -> load referenced records
  -> enforce domain rules
  -> persist master record
  -> append audit event
  -> return safe view model
```

The JSON adapter emulates this unit of work locally. PostgreSQL performs it in one
real transaction.

## 6. Validation and error contract

Add a schema-aware validator such as Zod at every input boundary.

Only applicable names are mandatory for the current staff-entry phase. Missing
phone/address/PIN values produce warnings, not rejected saves. Validate:

- trimmed names
- normalized phone lookup value while preserving display value
- valid annual month/day
- beneficiary ownership
- `forSelf`/`beneficiaryId` consistency
- custom-address mode
- non-negative integer fee
- allowed statuses and transitions
- pagination bounds
- date and report filters
- optimistic concurrency using `modifiedAt`

Use a stable result/error shape:

```ts
type ServiceResult<T> =
  | { ok: true; data: T; warnings?: FieldWarning[] }
  | {
      ok: false;
      code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "INTERNAL";
      message: string;
      fieldErrors?: Record<string, string>;
    };
```

Never return stack traces, secrets, or personal data in error logs.

## 7. Frontend-to-backend boundary

Add:

```text
frontend/lib/server/backend.ts
frontend/app/actions/devotees.ts
frontend/app/actions/beneficiaries.ts
frontend/app/actions/enrollments.ts
frontend/app/actions/reports.ts
frontend/app/actions/labels.ts
```

- Mark the bridge and action files `server-only` / `"use server"`.
- Server-rendered pages call the bridge for initial reads.
- Client forms call Server Actions for search, pagination, create, edit, archive,
  and status changes.
- Pages receive serializable view models, not repository entities.
- Remove all runtime frontend imports of fixture/mock modules.
- Keep current service names where possible to minimize component changes.

No standalone REST API is required for MVP. Add route handlers only for downloadable
CSV/PDF responses or if an external client is introduced later.

## 8. Delivery slices

### Slice 1 — JSON database and repository foundation

- Export current synthetic data into the five JSON table files.
- Add row schemas and startup validation.
- Implement atomic JSON reads/writes and the repository contracts.
- Add repository factory with `DATA_ADAPTER=json`.
- Remove `backend/src/mock-data.ts` from runtime imports.

Acceptance:

- Invalid foreign keys or malformed fixture rows fail startup with a useful,
  PII-safe error.
- Counts remain 100 devotees, 105 beneficiaries, and 250 enrollments.
- `created_at` and `modified_at` exist on every mutable row.

### Slice 2 — read paths

- Implement devotee search/directory/detail.
- Implement enrollment day/week/month/all/custom-date queries.
- Implement report filters and pagination.
- Implement daily and invitation-label recipient queries.
- Rewire every page through the server-only frontend bridge.

Acceptance:

- No frontend runtime module imports mock/fixture data.
- Existing screens render from JSON through backend services.
- Search and pagination operate in the backend, not on an entire browser dataset.

### Slice 3 — write paths

- Implement create/edit/archive devotee.
- Implement beneficiary create/edit/archive.
- Implement enrollment create/edit/status transitions.
- Preserve form values and return field errors/warnings.
- Update `modified_at` on every mutation.
- Add optimistic-concurrency conflict responses.

Acceptance:

- Refreshing local development retains JSON-backed edits.
- Shared primary-address changes affect linked enrollments only.
- Custom enrollment addresses remain unchanged.

### Slice 4 — occurrences and audit

- Add idempotent daily reconciliation.
- Snapshot recipient, phone, and resolved address.
- Create audit events for every mutation/status change.
- Make audit events and finalized occurrence snapshots append-only.

Acceptance:

- Repeated reconciliation creates no duplicate occurrence.
- Later profile edits do not alter historical snapshots.
- Every successful mutation has a matching actor/timestamp audit event.

### Slice 5 — exports and tests

- Backend-filtered CSV export.
- Server-rendered deterministic label PDF.
- Unit, repository-contract, integration, and critical Playwright tests.
- Add fixture reset/generation commands for development.

Acceptance:

- More than 15 labels paginate correctly.
- Invitation labels deduplicate normalized full addresses.
- CSV/PDF endpoints validate authorization and filters.
- All required edge cases in `AGENTS.md` pass.

### Slice 6 — PostgreSQL adapter

- Add Prisma schema and migrations under `database/`.
- Implement repository contracts with Prisma.
- Import JSON fixtures through a validated seed/import command.
- Set `DATA_ADAPTER=prisma`.
- Run the same repository contract tests against JSON and PostgreSQL.

Acceptance:

- No frontend or application-service changes are required for the adapter switch.
- Database foreign keys, checks, unique constraints, and RLS enforce the same rules.
- Clean install and upgrade migrations both pass.

## 9. Testing matrix

- Unit: recurrence, leap day, address resolution, status transitions, duplicate
  detection, normalized address deduplication, date ranges.
- JSON repository contract: CRUD, search, pagination, foreign keys, timestamps,
  optimistic concurrency, atomic-write recovery.
- Service integration: beneficiary ownership, audit pairing, occurrence idempotency,
  historical snapshots.
- Adapter parity: run identical contract tests against JSON and Prisma.
- End-to-end: create devotee + beneficiary + pooja, edit shared address, edit custom
  address, pause/resume, date filter, report export, daily labels, invitation labels.
- Security: unauthenticated/disabled-user denial and PII-free errors/logs.

## 10. Recommended implementation order

1. Slice 1: JSON files, validation, repository interfaces and adapter.
2. Slice 2: convert all reads screen by screen.
3. Slice 3: connect current UI forms to real backend mutations.
4. Slice 4: occurrences and audit.
5. Slice 5: exports and automated coverage.
6. Slice 6: Prisma/PostgreSQL and Supabase Auth before production use.

Do not delete the existing mock implementation until all screens pass against the
JSON adapter. Move the generator to a development-only seed command, compare record
counts and representative scenarios, then remove runtime imports in the same change.
