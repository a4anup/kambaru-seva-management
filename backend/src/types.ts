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

/** Verified means approved for dispatch, not confirmed courier delivery. */
export type AddressVerificationStatus = "verified" | "unverified";

export interface AddressVerification {
  addressVerificationStatus: AddressVerificationStatus;
  addressVerificationReason?: string;
  addressVerificationChangedAt?: string;
  addressVerificationChangedBy?: string;
}

export type EnrollmentStatus = "active" | "paused" | "cancelled";

export interface Devotee extends AddressVerification {
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
  customAddressVerificationStatus?: AddressVerificationStatus;
  customAddressVerificationReason?: string;
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
  receiptNumber?: string;
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
export interface PoojaRegisterRow extends AddressVerification {
  enrollmentId: string;
  poojaNo: string;
  devoteeId: string;
  devoteeNo: string;
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
  receiptNumber?: string;
  enrollmentDate: string;
  notes?: string;
  hasException: boolean;
  exceptionNote?: string;
  createdAt: string;
  modifiedAt: string;
}

/** Summary row for the alphabet-filtered devotee directory. */
export interface DevoteeDirectoryRow extends AddressVerification {
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
  primaryAddressPoojaCount: number;
  hasException: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface SaveDevoteeInput {
  addressVerificationStatus?: AddressVerificationStatus;
  addressVerificationReason?: string;
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
  customAddressVerificationStatus?: AddressVerificationStatus;
  customAddressVerificationReason?: string;
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
  receiptNumber?: string;
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

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  referenceNo: string;
  occurredAt: string;
  changedFields: string[];
}

/** A single deduplicated courier-label recipient (used by both date-based and bulk invitation label modes). */
export interface LabelRecipient extends AddressVerification {
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

export interface DonationType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  displayOrder: number;
}

export interface Donation {
  id: string;
  donorName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  amountMinor: number;
  currency: "INR";
  receiptNumber?: string;
  donationDate: string;
  donationTypeId: string;
  donationTypeName: string;
  paymentMethod?: "Cash" | "UPI" | "Bank" | "Cheque" | "Other";
  paymentReference?: string;
  donationGroupId?: string;
  donationGroupTitle?: string;
  linkedDevoteeId?: string;
  linkedDevoteeName?: string;
  linkedDevoteeNo?: string;
  notes?: string;
  reviewStatus: "review_required" | "reviewed";
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNotes?: string;
  createdAt: string;
  modifiedAt: string;
}

export interface DonationFilters {
  search?: string;
  donorInitial?: string;
  fromDate?: string;
  toDate?: string;
  donationTypeId?: string;
  paymentMethod?: Donation["paymentMethod"];
  donationGroupId?: string;
  mappingStatus?: "all" | "mapped" | "unmapped";
  reviewStatus?: "all" | "review_required" | "reviewed";
  minimumAmountMinor?: number;
  maximumAmountMinor?: number;
  sortBy?: "name_asc";
}

export interface DonationPage extends PageResult<Donation> {
  totalAmountMinor: number;
  mappedCount: number;
  unmappedCount: number;
  reviewRequiredCount: number;
  reviewedCount: number;
}

export interface DonationGroup {
  id: string;
  title: string;
  phone?: string;
  alternatePhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  linkedDevoteeId?: string;
  linkedDevoteeName?: string;
  notes?: string;
  totalAmountMinor: number;
  donationCount: number;
  firstDonationDate?: string;
  latestDonationDate?: string;
  createdAt: string;
  modifiedAt: string;
}

export interface DonationGroupPage {
  items: DonationGroup[];
  totalGroups: number;
  totalDonations: number;
  totalAmountMinor: number;
  unmappedDonations: number;
}

export interface DonationGroupDetail {
  group: DonationGroup;
  donations: Donation[];
}

export type SaveDonationInput = Omit<Donation, "id" | "donationTypeName" | "donationGroupTitle" | "linkedDevoteeName" | "linkedDevoteeNo" | "reviewStatus" | "reviewedAt" | "reviewedBy" | "reviewedByName" | "reviewNotes" | "createdAt" | "modifiedAt"> & {
  id?: string;
  expectedModifiedAt?: string;
};

export type SaveDonationGroupInput = Omit<DonationGroup, "id" | "linkedDevoteeName" | "totalAmountMinor" | "donationCount" | "firstDonationDate" | "latestDonationDate" | "createdAt" | "modifiedAt"> & {
  id?: string;
  expectedModifiedAt?: string;
};
