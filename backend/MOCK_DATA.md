# Mock database dataset

`src/mock-data.ts` is the phase-1a, in-memory equivalent of the future PostgreSQL
tables. It is deterministic except for `createdAt` and `modifiedAt`, which are set
to the current ISO timestamp when the application process loads.

## Volume

- 100 devotees
- 105 devotee-scoped beneficiaries
- 250 Shashwatha Pooja enrollments

The frontend never imports these arrays directly. `DevoteeService` and
`EnrollmentService` fetch and shape them, preserving the boundary that the
Prisma/Supabase implementation will replace later.

## Covered scenarios

- Today, tomorrow, week, month, all, and custom-date filters
- More than 15 active poojas today for multi-page A4 label testing
- Multiple poojas for one devotee on the same annual date
- One saved beneficiary reused by the same devotee on different dates
- Self, son, daughter, wife, husband, father, mother, and other relationships
- Devotee-primary and custom per-pooja addresses
- Repeated household addresses for invitation-label deduplication
- A long Kannada custom address for wrapping and print checks
- Complete profiles, missing phone, missing address, and incomplete PIN
- Active, paused, and cancelled enrollments
- February 29 recurrence
- Payment reference present and absent
- Every rashi, multiple nakshatras/gotras, Karnataka and Kerala addresses
- More than 100 devotees and enough poojas to exercise 10-row pagination

Stable example IDs are exported in `mockScenarioCatalog` for manual and automated
tests. All records are synthetic and safe for screenshots and exports.
