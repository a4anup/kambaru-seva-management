"use server";

import type { PageResult, PoojaRegisterFilterMode, PoojaRegisterRow } from "@kambaru/backend";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBackendServices } from "@/lib/server/backend";

const optionalText = (maximum = 500) =>
  z.string().trim().max(maximum).optional().transform((value) => value || undefined);
const beneficiary = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(1).max(200),
  relation: z.enum(["son", "daughter", "wife", "husband", "father", "mother", "other"]),
  phone: optionalText(30),
  rashi: optionalText(100),
  nakshatra: optionalText(100),
  gotra: optionalText(100),
  notes: optionalText(1000),
});
const newDevotee = z.object({
  fullName: z.string().trim().min(1).max(200),
  dateOfBirth: z.string().date().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalText(30),
  phoneAlternate: optionalText(30),
  email: z.string().trim().email().max(254).optional().or(z.literal("")).transform((value) => value || undefined),
  rashi: optionalText(100),
  nakshatra: optionalText(100),
  gotra: optionalText(100),
  notes: optionalText(1000),
  addressLine1: optionalText(250),
  addressLine2: optionalText(250),
  city: optionalText(120),
  district: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(12),
});
const enrollment = z.object({
  id: z.string().uuid().optional(),
  expectedModifiedAt: z.string().datetime({ offset: true }).optional(),
  devoteeId: z.string().uuid().optional(),
  newDevotee: newDevotee.optional(),
  forSelf: z.boolean(),
  beneficiary: beneficiary.optional(),
  annualMonth: z.number().int().min(1).max(12),
  annualDay: z.number().int().min(1).max(31),
  addressMode: z.enum(["devotee_primary", "custom"]),
  customAddress: z.object({
    line1: optionalText(250),
    line2: optionalText(250),
    city: optionalText(120),
    district: optionalText(120),
    state: optionalText(120),
    postalCode: optionalText(12),
  }).optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  feeMinor: z.number().int().nonnegative().optional(),
  currency: z.literal("INR").optional(),
  paymentReference: optionalText(200),
  receiptNumber: optionalText(100),
  enrollmentDate: z.string().date().optional(),
  notes: optionalText(2000),
}).superRefine((value, context) => {
  if (!value.devoteeId && !value.newDevotee) {
    context.addIssue({ code: "custom", path: ["devoteeId"], message: "Select or create a devotee." });
  }
  if (!value.forSelf && !value.beneficiary) {
    context.addIssue({ code: "custom", path: ["beneficiary"], message: "Beneficiary details are required." });
  }
  if (value.id && !value.expectedModifiedAt) {
    context.addIssue({ code: "custom", path: ["expectedModifiedAt"], message: "Refresh this pooja before editing." });
  }
  const lastDay = new Date(2024, value.annualMonth, 0).getDate();
  if (value.annualDay > lastDay) {
    context.addIssue({ code: "custom", path: ["annualDay"], message: "Choose a valid annual pooja date." });
  }
});

export type SavePoojaResult =
  | { ok: true; pooja: PoojaRegisterRow }
  | { ok: false; message: string };

export async function loadPoojaRegister(input: {
  mode: PoojaRegisterFilterMode;
  date: string;
  search?: string;
  page?: number;
}): Promise<PageResult<PoojaRegisterRow>> {
  const { enrollments } = await getBackendServices();
  return enrollments.listRegisterPage({ ...input, pageSize: 10 });
}

export async function loadPoojaCalendar(year: number, month: number) {
  const { enrollments } = await getBackendServices();
  return enrollments.getCalendarCounts(year, month);
}

export async function searchDevotees(search: string) {
  const { devotees } = await getBackendServices();
  return (await devotees.listDirectoryPage({ search, page: 1, pageSize: 10 })).items;
}

export async function loadBeneficiaries(devoteeId: string) {
  const { beneficiaries } = await getBackendServices();
  return beneficiaries.listByDevotee(devoteeId);
}

export async function savePooja(input: unknown): Promise<SavePoojaResult> {
  const parsed = enrollment.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the pooja information." };
  }
  try {
    const { enrollments } = await getBackendServices();
    const pooja = parsed.data.id
      ? await enrollments.update({
          ...parsed.data,
          id: parsed.data.id,
          expectedModifiedAt: parsed.data.expectedModifiedAt!,
        })
      : await enrollments.create(parsed.data);
    revalidatePath("/poojas");
    revalidatePath("/dashboard");
    revalidatePath("/devotees");
    revalidatePath("/reports");
    revalidatePath("/labels");
    return { ok: true, pooja };
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return { ok: false, message: "This pooja was changed by another staff member. Refresh and try again." };
    }
    return { ok: false, message: "The pooja could not be saved. Please try again." };
  }
}
