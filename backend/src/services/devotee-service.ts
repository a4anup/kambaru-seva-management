import type { TempleRepository } from "../repositories";
import type { Devotee, DevoteeDirectoryRow, SaveDevoteeInput } from "../types";

function directoryRow(devotee: Devotee, poojaCount: number): DevoteeDirectoryRow {
  const hasException =
    !devotee.phonePrimary ||
    !devotee.addressLine1 ||
    !devotee.addressCity ||
    !/^\d{6}$/.test(devotee.addressPostalCode);
  return {
    id: devotee.id,
    devoteeNo: devotee.devoteeNo,
    fullName: devotee.fullName,
    dateOfBirth: devotee.dateOfBirth,
    phone: devotee.phonePrimary,
    phoneAlternate: devotee.phoneAlternate,
    email: devotee.email,
    rashi: devotee.rashi,
    nakshatra: devotee.nakshatra,
    gotra: devotee.gotra,
    notes: devotee.notes,
    addressLine1: devotee.addressLine1,
    addressLine2: devotee.addressLine2,
    city: devotee.addressCity || "City missing",
    district: devotee.addressDistrict,
    state: devotee.addressState,
    postalCode: devotee.addressPostalCode || "PIN missing",
    poojaCount,
    hasException,
    createdAt: devotee.createdAt,
    modifiedAt: devotee.modifiedAt,
  };
}

// Mirrors PLAN.md §10.5 `DevoteeService` and keeps domain mapping independent
// from the Supabase transport used by the repository.
export function createDevoteeService(templeData: TempleRepository) {
  return {
  async listDirectoryPage(input: { search?: string; letter?: string; page?: number; pageSize?: number } = {}) {
    return templeData.listDevoteesPage({
      search: input.search,
      letter: input.letter,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 10,
    });
  },
    async create(input: SaveDevoteeInput): Promise<DevoteeDirectoryRow> {
      return directoryRow(await templeData.createDevotee(input), 0);
    },
    async update(
      input: SaveDevoteeInput & { id: string; expectedModifiedAt: string },
    ): Promise<DevoteeDirectoryRow> {
      const saved = await templeData.updateDevotee(input);
      const page = await templeData.listDevoteesPage({ search: saved.devoteeNo, page: 1, pageSize: 1 });
      return page.items[0] ?? directoryRow(saved, 0);
    },
  };
}
