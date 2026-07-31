import type { Beneficiary, Devotee, PoojaEnrollment } from "../types";

export interface DataSnapshot {
  devotees: Devotee[];
  beneficiaries: Beneficiary[];
  enrollments: (PoojaEnrollment & { exception?: string })[];
}

/**
 * Transitional repository seam. Application services depend on this contract;
 * JSON and Supabase implementations can be exchanged without changing callers.
 */
export interface TempleRepository {
  loadSnapshot(): Promise<DataSnapshot>;
}
