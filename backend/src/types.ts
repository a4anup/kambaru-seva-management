// Shapes mirror PLAN.md §10.1 (Devotee / Beneficiary / PoojaEnrollment), with
// explicit display models returned by the domain services.

export type BeneficiaryRelation =
  | "son"
  | "daughter"
  | "wife"
  | "husband"
  | "father"
  | "mother"
  | "other";

export type EnrollmentStatus = "active" | "paused" | "cancelled";

export interface Devotee {
  id: string;
  devoteeNo: string;
  fullName: string;
  dateOfBirth?: string;
  phonePrimary: string | null;
  phoneAlternate?: string;
  email?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
  addressLine1: string;
  addressLine2?: string;
  addressCity: string;
  addressDistrict?: string;
  addressState: string;
  addressPostalCode: string;
  createdAt: string;
  modifiedAt: string;
}

export interface Beneficiary {
  id: string;
  devoteeId: string;
  fullName: string;
  relation: BeneficiaryRelation;
  phone?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
  createdAt: string;
  modifiedAt: string;
}

export interface PoojaEnrollment {
  id: string;
  poojaNo: string;
  devoteeId: string;
  forSelf: boolean;
  beneficiaryId: string | null;
  annualMonth: number; // 1-12
  annualDay: number; // 1-31
  addressMode: "devotee_primary" | "custom";
  customAddress?: {
    line1: string;
    line2?: string;
    city: string;
    district?: string;
    state: string;
    postalCode: string;
  };
  status: EnrollmentStatus;
  leapDayPolicy: "feb_28" | "mar_1" | "leap_year_only";
  feeMinor: number;
  currency: "INR";
  paymentReference?: string;
  enrollmentDate: string;
  createdBy: string;
  notes?: string;
  createdAt: string;
  modifiedAt: string;
}

/** A single row on a date's dispatch list — the resolved, display-ready shape. */
export interface DueRow {
  enrollmentId: string;
  beneficiaryName: string;
  relation: "Self" | Capitalize<BeneficiaryRelation>;
  sponsorName: string;
  phone: string | null;
  addressLine: string;
  addressSub: string;
  isCustomAddress: boolean;
  hasException: boolean;
  exceptionNote?: string;
  notes?: string;
}

export interface DaySummary {
  date: Date;
  rows: DueRow[];
}

/** Display/edit shape for the date-filtered Shashwatha Pooja register. */
export interface PoojaRegisterRow {
  enrollmentId: string;
  poojaNo: string;
  devoteeId: string;
  beneficiaryId: string | null;
  sponsorName: string;
  beneficiaryName: string;
  relation: "Self" | Capitalize<BeneficiaryRelation>;
  beneficiaryPhone?: string;
  beneficiaryRashi?: string;
  beneficiaryNakshatra?: string;
  beneficiaryGotra?: string;
  beneficiaryNotes?: string;
  phone: string | null;
  annualMonth: number;
  annualDay: number;
  leapDayPolicy: "feb_28" | "mar_1" | "leap_year_only";
  addressMode: "devotee_primary" | "custom";
  addressLine: string;
  addressLine2?: string;
  addressCity: string;
  addressDistrict?: string;
  addressState: string;
  postalCode: string;
  status: EnrollmentStatus;
  feeMinor: number;
  currency: "INR";
  paymentReference?: string;
  enrollmentDate: string;
  notes?: string;
  hasException: boolean;
  exceptionNote?: string;
  createdAt: string;
  modifiedAt: string;
}

/** Summary row for the alphabet-filtered devotee directory. */
export interface DevoteeDirectoryRow {
  id: string;
  devoteeNo: string;
  fullName: string;
  dateOfBirth?: string;
  phone: string | null;
  phoneAlternate?: string;
  email?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district?: string;
  state: string;
  postalCode: string;
  poojaCount: number;
  hasException: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface SaveDevoteeInput {
  id?: string;
  expectedModifiedAt?: string;
  fullName: string;
  dateOfBirth?: string;
  phone?: string;
  phoneAlternate?: string;
  email?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
}

export interface SaveBeneficiaryInput {
  id?: string;
  fullName: string;
  relation: BeneficiaryRelation;
  phone?: string;
  rashi?: string;
  nakshatra?: string;
  gotra?: string;
  notes?: string;
}

export interface SaveEnrollmentInput {
  id?: string;
  expectedModifiedAt?: string;
  devoteeId?: string;
  newDevotee?: SaveDevoteeInput;
  forSelf: boolean;
  beneficiary?: SaveBeneficiaryInput;
  annualMonth: number;
  annualDay: number;
  addressMode: "devotee_primary" | "custom";
  customAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
  };
  status?: EnrollmentStatus;
  feeMinor?: number;
  currency?: "INR";
  paymentReference?: string;
  enrollmentDate?: string;
  notes?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

export interface DevoteeDirectoryPage extends PageResult<DevoteeDirectoryRow> {
  allTotal: number;
  letterCounts: Record<string, number>;
}

export type PoojaRegisterFilterMode = "today" | "tomorrow" | "week" | "month" | "all" | "custom";

export interface DashboardSummary {
  todayCount: number;
  weekCount: number;
  activeCount: number;
  devoteeCount: number;
  dailyCounts: Array<{ date: string; count: number }>;
  missingPhoneCount: number;
  missingPincodeCount: number;
  missingAddressCount: number;
}

/** A single deduplicated courier-label recipient (used by both date-based and bulk invitation label modes). */
export interface LabelRecipient {
  id: string;
  name: string;
  phone: string | null;
  addressLine: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export type LabelDateMode = "today" | "tomorrow" | "custom" | "range";
export type LabelInvitationScope = "all" | "devotees" | "beneficiaries";

export type ReportGroupBy = "date" | "pincode" | "devotee" | "rashi" | "gotra" | "nakshatra" | "state";

export interface ReportFilters {
  fromDate?: string;
  toDate?: string;
  search?: string;
  pincode?: string;
  state?: string;
  rashi?: string;
  gotra?: string;
  nakshatra?: string;
  relation?: string;
  addressMode?: string;
  status?: string;
}

export interface ReportRow {
  enrollmentId: string;
  devoteeNo: string;
  sponsorName: string;
  beneficiaryName: string;
  relation: string;
  phone: string | null;
  rashi: string;
  nakshatra: string;
  gotra: string;
  addressCity: string;
  state: string;
  postalCode: string;
  addressMode: "devotee_primary" | "custom";
  status: EnrollmentStatus;
  annualMonth: number;
  annualDay: number;
}

export interface ReportGroupCount {
  label: string;
  count: number;
}

export interface ReportFilterOptions {
  states: string[];
  rashis: string[];
  gotras: string[];
  nakshatras: string[];
  pincodes: string[];
}

export interface ReportPage extends PageResult<ReportRow> {
  activeCount: number;
  uniqueDevotees: number;
  incompleteCount: number;
  groups: ReportGroupCount[];
  filterOptions: ReportFilterOptions;
}

export interface DevoteePoojaDate {
  enrollmentId: string;
  poojaNo: string;
  beneficiaryName: string;
  relation: "Self" | Capitalize<BeneficiaryRelation>;
  annualMonth: number;
  annualDay: number;
  status: EnrollmentStatus;
}
