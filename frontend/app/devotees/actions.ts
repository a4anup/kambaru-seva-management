"use server";

import type { DevoteeDirectoryPage, DevoteeDirectoryRow, DevoteePoojaDate } from "@kambaru/backend";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBackendServices } from "@/lib/server/backend";

const optionalText = z.string().trim().max(500).optional().transform((value) => value || undefined);
const devoteeInput = z.object({
  id: z.string().uuid().optional(),
  expectedModifiedAt: z.string().datetime({ offset: true }).optional(),
  fullName: z.string().trim().min(1, "Devotee name is required.").max(200),
  dateOfBirth: z.string().date().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: z.string().trim().max(30).optional().transform((value) => value || undefined),
  phoneAlternate: z.string().trim().max(30).optional().transform((value) => value || undefined),
  email: z.string().trim().email("Enter a valid email address.").max(254).optional().or(z.literal("")).transform((value) => value || undefined),
  rashi: z.string().trim().max(100).optional().transform((value) => value || undefined),
  nakshatra: z.string().trim().max(100).optional().transform((value) => value || undefined),
  gotra: z.string().trim().max(100).optional().transform((value) => value || undefined),
  notes: optionalText,
  addressLine1: z.string().trim().max(250).optional().transform((value) => value || undefined),
  addressLine2: z.string().trim().max(250).optional().transform((value) => value || undefined),
  city: z.string().trim().max(120).optional().transform((value) => value || undefined),
  district: z.string().trim().max(120).optional().transform((value) => value || undefined),
  state: z.string().trim().max(120).optional().transform((value) => value || undefined),
  postalCode: z.string().trim().max(12).optional().transform((value) => value || undefined),
}).superRefine((value, context) => {
  if (value.id && !value.expectedModifiedAt) {
    context.addIssue({
      code: "custom",
      path: ["expectedModifiedAt"],
      message: "This profile must be refreshed before it can be edited.",
    });
  }
});

export type SaveDevoteeResult =
  | { ok: true; devotee: DevoteeDirectoryRow }
  | { ok: false; message: string };

export async function loadDevoteeDirectory(input: {
  search?: string;
  letter?: string;
  page?: number;
}): Promise<DevoteeDirectoryPage> {
  const { devotees } = await getBackendServices();
  return devotees.listDirectoryPage({ ...input, pageSize: 10 });
}

export async function loadDevoteePoojaDates(devoteeId: string): Promise<DevoteePoojaDate[]> {
  const { devotees } = await getBackendServices();
  return devotees.listPoojaDates(devoteeId);
}

export async function saveDevotee(input: unknown): Promise<SaveDevoteeResult> {
  const parsed = devoteeInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the devotee information." };
  }

  try {
    const { devotees } = await getBackendServices();
    const devotee = parsed.data.id
      ? await devotees.update({
          ...parsed.data,
          id: parsed.data.id,
          expectedModifiedAt: parsed.data.expectedModifiedAt!,
        })
      : await devotees.create(parsed.data);
    revalidatePath("/devotees");
    revalidatePath("/dashboard");
    revalidatePath("/poojas");
    revalidatePath("/reports");
    revalidatePath("/labels");
    return { ok: true, devotee };
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return { ok: false, message: "This profile was changed by another staff member. Refresh and try again." };
    }
    return { ok: false, message: "The devotee profile could not be saved. Please try again." };
  }
}
