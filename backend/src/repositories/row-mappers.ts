import type { Beneficiary, Devotee, PoojaEnrollment } from "../types";

export interface DevoteeRow {
  id: string;
  devotee_no: string;
  full_name: string;
  date_of_birth?: string;
  phone_primary: string | null;
  phone_alternate?: string;
  email?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_district?: string;
  address_state: string;
  address_postal_code: string;
  created_at: string;
  modified_at: string;
}

export interface BeneficiaryRow {
  id: string;
  devotee_id: string;
  full_name: string;
  relation: Beneficiary["relation"];
  phone?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
  created_at: string;
  modified_at: string;
}

export interface EnrollmentRow {
  id: string;
  devotee_id: string;
  for_self: boolean;
  beneficiary_id: string | null;
  annual_month: number;
  annual_day: number;
  leap_day_policy: PoojaEnrollment["leapDayPolicy"];
  address_mode: PoojaEnrollment["addressMode"];
  custom_address_line1?: string;
  custom_address_line2?: string;
  custom_address_city?: string;
  custom_address_district?: string;
  custom_address_state?: string;
  custom_address_postal_code?: string;
  status: PoojaEnrollment["status"];
  fee_minor: number;
  currency: "INR";
  payment_reference?: string;
  enrollment_date: string;
  notes?: string;
  created_by: string | null;
  created_at: string;
  modified_at: string;
  exception?: string;
}

export function mapDevotee(row: DevoteeRow): Devotee {
  return {
    id: row.id,
    devoteeNo: row.devotee_no,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    phonePrimary: row.phone_primary,
    phoneAlternate: row.phone_alternate,
    email: row.email,
    rashi: row.rashi,
    nakshatra: row.nakshatra,
    gotra: row.gotra,
    notes: row.notes,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    addressCity: row.address_city,
    addressDistrict: row.address_district,
    addressState: row.address_state,
    addressPostalCode: row.address_postal_code,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

export function mapBeneficiary(row: BeneficiaryRow): Beneficiary {
  return {
    id: row.id,
    devoteeId: row.devotee_id,
    fullName: row.full_name,
    relation: row.relation,
    phone: row.phone,
    rashi: row.rashi,
    nakshatra: row.nakshatra,
    gotra: row.gotra,
    notes: row.notes,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

export function mapEnrollment(row: EnrollmentRow): PoojaEnrollment & { exception?: string } {
  const hasCustomAddress = row.address_mode === "custom";
  return {
    id: row.id,
    devoteeId: row.devotee_id,
    forSelf: row.for_self,
    beneficiaryId: row.beneficiary_id,
    annualMonth: row.annual_month,
    annualDay: row.annual_day,
    leapDayPolicy: row.leap_day_policy,
    addressMode: row.address_mode,
    customAddress: hasCustomAddress
      ? {
          line1: row.custom_address_line1 ?? "",
          line2: row.custom_address_line2,
          city: row.custom_address_city ?? "",
          district: row.custom_address_district,
          state: row.custom_address_state ?? "",
          postalCode: row.custom_address_postal_code ?? "",
        }
      : undefined,
    status: row.status,
    feeMinor: row.fee_minor,
    currency: row.currency,
    paymentReference: row.payment_reference,
    enrollmentDate: row.enrollment_date,
    createdBy: row.created_by ?? "system",
    notes: row.notes,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
    exception: row.exception,
  };
}
