"use server";

import type { LabelDateMode, LabelInvitationScope, LabelRecipient } from "@kambaru/backend";
import { getBackendServices } from "@/lib/server/backend";

export async function getLabelsForDate(input: {
  mode: LabelDateMode;
  date?: string;
  rangeFrom?: string;
  rangeTo?: string;
}): Promise<LabelRecipient[]> {
  const { labels } = await getBackendServices();
  return labels.listForDate(input);
}

export async function getInvitationLabels(scope: LabelInvitationScope): Promise<LabelRecipient[]> {
  const { labels } = await getBackendServices();
  return labels.listInvitation(scope);
}
