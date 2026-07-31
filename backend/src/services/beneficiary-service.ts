import type { TempleRepository } from "../repositories";
import type { Beneficiary } from "../types";

// Mirrors PLAN.md §10.5 `BeneficiaryService`, scoped to one devotee per PLAN.md §5
// and never globally shared.
export function createBeneficiaryService(templeData: TempleRepository) {
  return {
    async listByDevotee(devoteeId: string): Promise<Beneficiary[]> {
      return templeData.listBeneficiariesByDevotee(devoteeId);
    },
  };
}
