// Barrel export for the domain layer. Frontend imports everything through this
// module (`@kambaru/backend`) rather than reaching into individual files, so the
// package boundary is the seam between UI code and Supabase-backed domain services.

export * from "./types";
export { createEnrollmentService } from "./services/enrollment-service";
export { createDevoteeService } from "./services/devotee-service";
export { createBeneficiaryService } from "./services/beneficiary-service";
export { createAuditService } from "./services/audit-service";
export { createLabelService } from "./services/label-service";
export { createReportService } from "./services/report-service";
export {
  createSupabaseTempleRepository,
  type SupabaseRepositoryConfig,
  type TempleRepository,
} from "./repositories";

import { createBeneficiaryService } from "./services/beneficiary-service";
import { createDevoteeService } from "./services/devotee-service";
import { createEnrollmentService } from "./services/enrollment-service";
import { createAuditService } from "./services/audit-service";
import { createLabelService } from "./services/label-service";
import { createReportService } from "./services/report-service";
import type { TempleRepository } from "./repositories";

export function createTempleServices(repository: TempleRepository) {
  return {
    devotees: createDevoteeService(repository),
    beneficiaries: createBeneficiaryService(repository),
    enrollments: createEnrollmentService(repository),
    audit: createAuditService(repository),
    labels: createLabelService(repository),
    reports: createReportService(repository),
  };
}
