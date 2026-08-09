"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DonationFilters } from "@kambaru/backend";
import { getBackendServices } from "@/lib/server/backend";

const optionalText = (max = 500) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const donationSchema = z.object({
  id: z.string().uuid().optional(), expectedModifiedAt: z.string().optional(), donorName: optionalText(200),
  phone: optionalText(30), addressLine1: optionalText(250), addressLine2: optionalText(250), city: optionalText(120),
  district: optionalText(120), state: optionalText(120), postalCode: optionalText(12), amountMinor: z.number().int().positive(),
  currency: z.literal("INR"), receiptNumber: optionalText(100), donationDate: z.string().date(), donationTypeId: z.string().uuid(),
  paymentMethod: z.enum(["Cash", "UPI", "Bank", "Bank Transfer", "Cheque", "Other"]).optional(), paymentReference: optionalText(200),
  donationGroupId: z.string().uuid().optional(), linkedDevoteeId: z.string().uuid().optional(), notes: optionalText(2000),
  allowDuplicate: z.boolean().optional(),
});
const groupSchema = z.object({
  id: z.string().uuid().optional(), expectedModifiedAt: z.string().optional(), title: z.string().trim().min(1).max(200),
  phone: optionalText(30), alternatePhone: optionalText(30), addressLine1: optionalText(250), addressLine2: optionalText(250),
  city: optionalText(120), district: optionalText(120), state: optionalText(120), postalCode: optionalText(12),
  linkedDevoteeId: z.string().uuid().optional(), notes: optionalText(2000),
});

export async function loadDonations(input: DonationFilters & { page: number }) {
  return (await getBackendServices()).donations.list({ ...input, page: input.page, pageSize: 25 });
}
export async function exportDonationsAction(input: DonationFilters) {
  const services = await getBackendServices();
  const first = await services.donations.list({ ...input, page: 1, pageSize: 100 });
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / 100); page += 1) {
    items.push(...(await services.donations.list({ ...input, page, pageSize: 100 })).items);
  }
  return items;
}
export async function loadDonationPaymentSummaryAction() {
  const donations = await exportDonationsAction({});
  const summary = new Map<string, { paymentMethod: string; amountMinor: number; count: number }>();
  for (const donation of donations) {
    const paymentMethod = donation.paymentMethod ?? "Not provided";
    const current = summary.get(paymentMethod) ?? { paymentMethod, amountMinor: 0, count: 0 };
    current.amountMinor += donation.amountMinor;
    current.count += 1;
    summary.set(paymentMethod, current);
  }
  return [...summary.values()].sort((left, right) => right.amountMinor - left.amountMinor);
}
export async function loadDonationGroups(input: { search?: string; sortBy?: string; page: number }) {
  return (await getBackendServices()).donationGroups.list360({ ...input, pageSize: 18 });
}
export async function exportDonationGroupsAction(input: { search?: string; sortBy?: string }) {
  const service = (await getBackendServices()).donationGroups;
  const first = await service.list360({ ...input, page: 1, pageSize: 100 });
  const groups = [...first.items];
  for (let page = 2; page <= Math.ceil(first.totalGroups / 100); page += 1) {
    groups.push(...(await service.list360({ ...input, page, pageSize: 100 })).items);
  }
  const detailedGroups = await Promise.all(groups.map(async (group) => (await service.getById(group.id))?.group ?? group));
  return detailedGroups;
}
export async function loadDonationGroupDetail(groupId: string) {
  if (!z.string().uuid().safeParse(groupId).success) return null;
  return (await getBackendServices()).donationGroups.getById(groupId);
}
export async function loadUnassignedDonations(search?: string) {
  return (await getBackendServices()).donations.listUnassigned(search);
}
export async function saveDonationAction(input: unknown) {
  const parsed = donationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Check the donation information." };
  try {
    const services = await getBackendServices();
    const { allowDuplicate, ...payload } = parsed.data;
    if (!allowDuplicate && payload.receiptNumber) {
      const matches = await services.donations.list({ search: payload.receiptNumber, page: 1, pageSize: 25 });
      const duplicate = matches.items.find((item) => item.id !== payload.id && item.receiptNumber?.toLowerCase() === payload.receiptNumber?.toLowerCase());
      if (duplicate) return { ok: false as const, duplicate: true as const, message: `Receipt ${payload.receiptNumber} already exists for ${duplicate.donorName}. Save this donation anyway?` };
    }
    const donation = await services.donations.save(payload);
    revalidatePath("/donations"); revalidatePath("/donations/list"); revalidatePath("/donations/360"); revalidatePath("/audit");
    return { ok: true as const, donation };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error && error.message === "CONFLICT" ? "This donation changed in another session. Refresh and try again." : "The donation could not be saved." };
  }
}
export async function markDonationReviewedAction(donationId: string, reviewNotes?: string) {
  const parsed = z.object({ donationId: z.string().uuid(), reviewNotes: optionalText(2000) }).safeParse({ donationId, reviewNotes });
  if (!parsed.success) return { ok: false as const, message: "Check the review information." };
  try {
    const donation = await (await getBackendServices()).donations.markReviewed(parsed.data.donationId, parsed.data.reviewNotes);
    revalidatePath("/donations/list"); revalidatePath("/donations/360"); revalidatePath("/audit");
    return { ok: true as const, donation };
  } catch { return { ok: false as const, message: "The donation could not be marked as reviewed." }; }
}
export async function returnDonationToReviewAction(donationId: string) {
  if (!z.string().uuid().safeParse(donationId).success) return { ok: false as const, message: "Invalid donation." };
  try {
    const donation = await (await getBackendServices()).donations.returnToReview(donationId);
    revalidatePath("/donations/list"); revalidatePath("/donations/360"); revalidatePath("/audit");
    return { ok: true as const, donation };
  } catch { return { ok: false as const, message: "The donation could not be returned to review." }; }
}
export async function saveDonationGroupAction(input: unknown) {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Check the group information." };
  try {
    const group = await (await getBackendServices()).donationGroups.save(parsed.data);
    revalidatePath("/donations/360"); revalidatePath(`/donations/360/${group.id}`); revalidatePath("/audit");
    return { ok: true as const, group };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error && error.message === "DUPLICATE_GROUP" ? `A Donation Group named “${parsed.data.title}” already exists.` : error instanceof Error && error.message === "CONFLICT" ? "This group changed in another session. Refresh and try again." : "The Donation Group could not be saved." };
  }
}
export async function mapDonationsAction(groupId: string, donationIds: string[]) {
  if (!z.string().uuid().safeParse(groupId).success || !z.array(z.string().uuid()).min(1).safeParse(donationIds).success) return { ok: false as const, message: "Select at least one donation." };
  try { const count = await (await getBackendServices()).donationGroups.mapDonations(groupId, donationIds); revalidatePath("/donations"); revalidatePath(`/donations/360/${groupId}`); revalidatePath("/audit"); return { ok: true as const, count }; }
  catch { return { ok: false as const, message: "The selected donations could not be mapped." }; }
}
export async function unmapDonationAction(groupId: string, donationId: string) {
  try { await (await getBackendServices()).donationGroups.unmapDonation(donationId); revalidatePath("/donations"); revalidatePath(`/donations/360/${groupId}`); revalidatePath("/audit"); return { ok: true as const }; }
  catch { return { ok: false as const, message: "The donation could not be unmapped." }; }
}
export async function archiveDonationGroupAction(groupId: string) {
  if (!z.string().uuid().safeParse(groupId).success) return { ok: false as const, message: "Invalid Donation Group." };
  try {
    await (await getBackendServices()).donationGroups.archive(groupId);
    revalidatePath("/donations"); revalidatePath("/donations/list"); revalidatePath("/donations/360"); revalidatePath("/audit");
    return { ok: true as const };
  } catch { return { ok: false as const, message: "The Donation Group could not be archived." }; }
}
export async function archiveDonationAction(donationId: string) {
  if (!z.string().uuid().safeParse(donationId).success) return { ok: false as const, message: "Invalid donation." };
  try {
    await (await getBackendServices()).donations.archive(donationId);
    revalidatePath("/donations"); revalidatePath("/donations/list"); revalidatePath("/donations/360"); revalidatePath("/audit");
    return { ok: true as const };
  } catch { return { ok: false as const, message: "The donation could not be deleted." }; }
}
