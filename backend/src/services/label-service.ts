import type { TempleRepository } from "../repositories";
import type { LabelDateMode, LabelInvitationScope } from "../types";

// Date-based and bulk-invitation label recipients are both resolved and
// deduplicated in Postgres (label_recipients / label_invitation_recipients),
// so this service never needs to page through the whole devotee/enrollment
// tables just to render the default (today's) label view.
export function createLabelService(templeData: TempleRepository) {
  return {
    async listForDate(input: { mode: LabelDateMode; date?: string; rangeFrom?: string; rangeTo?: string }) {
      return templeData.listLabelRecipients(input);
    },
    async listInvitation(scope: LabelInvitationScope) {
      return templeData.listInvitationRecipients(scope);
    },
  };
}
