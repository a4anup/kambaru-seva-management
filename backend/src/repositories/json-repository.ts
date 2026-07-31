import devoteesJson from "../../../database/fixtures/devotees.json";
import beneficiariesJson from "../../../database/fixtures/beneficiaries.json";
import enrollmentsJson from "../../../database/fixtures/pooja_enrollments.json";
import type { DataSnapshot, TempleRepository } from "./contracts";
import {
  mapBeneficiary,
  mapDevotee,
  mapEnrollment,
  type BeneficiaryRow,
  type DevoteeRow,
  type EnrollmentRow,
} from "./row-mappers";

const snapshot: DataSnapshot = {
  devotees: (devoteesJson as DevoteeRow[]).map(mapDevotee),
  beneficiaries: (beneficiariesJson as BeneficiaryRow[]).map(mapBeneficiary),
  enrollments: (enrollmentsJson as EnrollmentRow[]).map(mapEnrollment),
};

export const JsonTempleRepository: TempleRepository = {
  async loadSnapshot() {
    return snapshot;
  },
};
