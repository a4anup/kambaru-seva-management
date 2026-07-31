import { TempleData, type DataSnapshot } from "../repositories";
import type { DueRow, PoojaEnrollment, PoojaRegisterRow } from "../types";

// Mirrors PLAN.md §10.5 `EnrollmentService`. Backed by mock fixtures for now
// (PLAN.md §11, phase 1a); phase 1b swaps these bodies for Prisma queries while
// keeping every call site in the UI unchanged.

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** PLAN.md §10.2 "Day" query, plus the Feb-29 policy from §12 (observe Feb 28 in non-leap years). */
function matchesDate(e: PoojaEnrollment, date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (e.annualMonth === month && e.annualDay === day) return true;
  if (e.annualMonth === 2 && e.annualDay === 29 && month === 2 && day === 28 && !isLeapYear(date.getFullYear())) {
    return true;
  }
  return false;
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

function resolve(e: PoojaEnrollment & { exception?: string }, data: DataSnapshot): DueRow {
  const { beneficiaries, devotees } = data;
  const devotee = devotees.find((d) => d.id === e.devoteeId);
  if (!devotee) throw new Error(`Unknown devotee for enrollment ${e.id}`);
  const beneficiary = e.beneficiaryId ? beneficiaries.find((b) => b.id === e.beneficiaryId) : undefined;

  const beneficiaryName = e.forSelf ? devotee.fullName : beneficiary?.fullName ?? "Unknown beneficiary";
  const relation: DueRow["relation"] = e.forSelf ? "Self" : capitalize(beneficiary?.relation ?? "other");

  const usingCustom = e.addressMode === "custom" && e.customAddress;
  const phone = devotee.phonePrimary;
  const line1 = usingCustom ? e.customAddress!.line1 : devotee.addressLine1;
  const city = usingCustom ? e.customAddress!.city : devotee.addressCity;
  const postalCode = usingCustom ? e.customAddress!.postalCode : devotee.addressPostalCode;

  const missingPhone = !phone;
  const missingAddress = !line1 || !postalCode;
  const hasException = Boolean(e.exception) || missingPhone || missingAddress;
  const exceptionNote =
    e.exception ??
    (missingPhone && missingAddress
      ? "Missing phone and address"
      : missingPhone
        ? "Missing phone number"
        : missingAddress
          ? "Address on file is incomplete"
          : undefined);

  return {
    enrollmentId: e.id,
    beneficiaryName,
    relation,
    sponsorName: devotee.fullName,
    phone: phone ?? null,
    addressLine: line1 || "No address on file",
    addressSub: city && postalCode ? `${city} ${postalCode}` : city || "",
    isCustomAddress: Boolean(usingCustom),
    hasException,
    exceptionNote,
    notes: e.notes,
  };
}

function activeEnrollments(data: DataSnapshot) {
  return data.enrollments.filter((e) => e.status === "active");
}

function resolveRegisterRow(
  e: PoojaEnrollment & { exception?: string },
  data: DataSnapshot,
): PoojaRegisterRow {
  const { beneficiaries, devotees } = data;
  const due = resolve(e, data);
  const devotee = devotees.find((item) => item.id === e.devoteeId);
  if (!devotee) throw new Error(`Unknown devotee for enrollment ${e.id}`);
  const beneficiary = e.beneficiaryId ? beneficiaries.find((item) => item.id === e.beneficiaryId) : undefined;
  const custom = e.addressMode === "custom" ? e.customAddress : undefined;

  return {
    enrollmentId: e.id,
    sponsorName: due.sponsorName,
    beneficiaryName: due.beneficiaryName,
    relation: due.relation,
    beneficiaryPhone: beneficiary?.phone,
    beneficiaryRashi: beneficiary?.rashi,
    beneficiaryNakshatra: beneficiary?.nakshatra,
    beneficiaryGotra: beneficiary?.gotra,
    beneficiaryNotes: beneficiary?.notes,
    phone: due.phone,
    annualMonth: e.annualMonth,
    annualDay: e.annualDay,
    leapDayPolicy: e.leapDayPolicy,
    addressMode: e.addressMode,
    addressLine: custom?.line1 ?? devotee.addressLine1,
    addressLine2: custom?.line2 ?? devotee.addressLine2,
    addressCity: custom?.city ?? devotee.addressCity,
    addressDistrict: custom?.district ?? devotee.addressDistrict,
    addressState: custom?.state ?? devotee.addressState,
    postalCode: custom?.postalCode ?? devotee.addressPostalCode,
    status: e.status,
    feeMinor: e.feeMinor,
    currency: e.currency,
    paymentReference: e.paymentReference,
    enrollmentDate: e.enrollmentDate,
    notes: e.notes,
    hasException: due.hasException,
    exceptionNote: due.exceptionNote,
  };
}

export const EnrollmentService = {
  async listRegister(): Promise<PoojaRegisterRow[]> {
    const data = await TempleData.loadSnapshot();
    return data.enrollments
      .map((enrollment) => resolveRegisterRow(enrollment, data))
      .sort((a, b) =>
        a.annualMonth - b.annualMonth ||
        a.annualDay - b.annualDay ||
        a.beneficiaryName.localeCompare(b.beneficiaryName),
      );
  },

  async listByDate(date: Date): Promise<DueRow[]> {
    const data = await TempleData.loadSnapshot();
    return activeEnrollments(data)
      .filter((e) => matchesDate(e, date))
      .map((enrollment) => resolve(enrollment, data))
      .sort((a, b) => a.beneficiaryName.localeCompare(b.beneficiaryName));
  },

  async countByDate(date: Date): Promise<number> {
    const data = await TempleData.loadSnapshot();
    return activeEnrollments(data).filter((e) => matchesDate(e, date)).length;
  },

  /** PLAN.md §10.2 "Week": Monday of the week containing `anyDateInWeek`, 7 days forward. */
  mondayOfWeek(anyDateInWeek: Date): Date {
    const d = new Date(anyDateInWeek);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return d;
  },

  async countInRange(start: Date, days: number): Promise<number> {
    const data = await TempleData.loadSnapshot();
    let total = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      total += activeEnrollments(data).filter((enrollment) => matchesDate(enrollment, d)).length;
    }
    return total;
  },

  /** PLAN.md §10.2 "Month": filter by annual_month alone, no year dependency. */
  async countByMonth(month: number): Promise<number> {
    const data = await TempleData.loadSnapshot();
    return activeEnrollments(data).filter((e) => e.annualMonth === month).length;
  },
};
