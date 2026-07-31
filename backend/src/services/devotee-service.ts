import { TempleData } from "../repositories";
import type { DevoteeDirectoryRow } from "../types";

// Mirrors PLAN.md §10.5 `DevoteeService`. This mock implementation is replaced
// by Prisma in phase 1b while preserving the frontend call site.
export const DevoteeService = {
  async listDirectory(): Promise<DevoteeDirectoryRow[]> {
    const { devotees, enrollments } = await TempleData.loadSnapshot();
    return devotees
      .map((devotee) => {
        const poojaCount = enrollments.filter(
          (enrollment) => enrollment.devoteeId === devotee.id && enrollment.status === "active",
        ).length;
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
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
};
