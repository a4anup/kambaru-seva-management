// Barrel export for the domain layer. Frontend imports everything through this
// module (`@kambaru/backend`) rather than reaching into individual files, so the
// package boundary is the actual seam where mock data gets swapped for Prisma/DB
// calls later (PLAN.md §11, phase 1b) — nothing on the frontend side has to change.

export * from "./types";
export { EnrollmentService } from "./services/enrollment-service";
export { DevoteeService } from "./services/devotee-service";
export { BeneficiaryService } from "./services/beneficiary-service";
export { configuredDataSource } from "./repositories";
