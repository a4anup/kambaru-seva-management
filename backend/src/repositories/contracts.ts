import type { Beneficiary, Devotee, PoojaEnrollment, SaveDevoteeInput, SaveEnrollmentInput } from "../types";

export interface DataSnapshot {
  devotees: Devotee[];
  beneficiaries: Beneficiary[];
  enrollments: (PoojaEnrollment & { exception?: string })[];
}

/**
 * Application services depend on this contract rather than the Supabase SDK or
 * REST transport, keeping domain rules portable and independently testable.
 */
export interface TempleRepository {
  loadSnapshot(): Promise<DataSnapshot>;
  createDevotee(input: SaveDevoteeInput): Promise<Devotee>;
  updateDevotee(input: SaveDevoteeInput & { id: string; expectedModifiedAt: string }): Promise<Devotee>;
  createEnrollment(input: SaveEnrollmentInput): Promise<PoojaEnrollment>;
  updateEnrollment(input: SaveEnrollmentInput & { id: string; expectedModifiedAt: string }): Promise<PoojaEnrollment>;
}
