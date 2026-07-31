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
  async listDirectory(): Promise<DevoteeDirectoryRow[]> {
    const { devotees, enrollments } = await templeData.loadSnapshot();
    return devotees
      .map((devotee) => {
        const poojaCount = enrollments.filter(
          (enrollment) => enrollment.devoteeId === devotee.id && enrollment.status === "active",
        ).length;
        return directoryRow(devotee, poojaCount);
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    async create(input: SaveDevoteeInput): Promise<DevoteeDirectoryRow> {
      return directoryRow(await templeData.createDevotee(input), 0);
    },
    async update(
      input: SaveDevoteeInput & { id: string; expectedModifiedAt: string },
    ): Promise<DevoteeDirectoryRow> {
      const saved = await templeData.updateDevotee(input);
      const { enrollments } = await templeData.loadSnapshot();
      return directoryRow(
        saved,
        enrollments.filter(
          (enrollment) => enrollment.devoteeId === saved.id && enrollment.status === "active",
        ).length,
      );
    },
  };
}
