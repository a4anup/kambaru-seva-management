import type { TempleRepository } from "../repositories";
import type { Beneficiary } from "../types";

// Mirrors PLAN.md §10.5 `BeneficiaryService`, scoped to one devotee per PLAN.md §5
// and never globally shared.
export function createBeneficiaryService(templeData: TempleRepository) {
  const service = {
  async listAll(): Promise<Beneficiary[]> {
    const { beneficiaries } = await templeData.loadSnapshot();
    return [...beneficiaries].sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async listByDevotee(devoteeId: string): Promise<Beneficiary[]> {
    const all = await service.listAll();
    return all.filter((beneficiary) => beneficiary.devoteeId === devoteeId);
    },
  };
  return service;
}
