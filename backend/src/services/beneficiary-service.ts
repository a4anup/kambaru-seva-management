import { TempleData } from "../repositories";
import type { Beneficiary } from "../types";

// Mirrors PLAN.md §10.5 `BeneficiaryService`, scoped to one devotee per PLAN.md §5
// (never globally shared). This mock implementation is replaced by Prisma in
// phase 1b while preserving the frontend call site.
export const BeneficiaryService = {
  async listAll(): Promise<Beneficiary[]> {
    const { beneficiaries } = await TempleData.loadSnapshot();
    return [...beneficiaries].sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async listByDevotee(devoteeId: string): Promise<Beneficiary[]> {
    const all = await this.listAll();
    return all.filter((beneficiary) => beneficiary.devoteeId === devoteeId);
  },
};
