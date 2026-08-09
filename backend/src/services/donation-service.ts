import type { DonationFilters, SaveDonationGroupInput, SaveDonationInput } from "../types";
import type { TempleRepository } from "../repositories";

export function createDonationService(repository: TempleRepository) {
  return {
    listTypes: () => repository.listDonationTypes(),
    list: (input: DonationFilters & { page?: number; pageSize?: number } = {}) =>
      repository.listDonationsPage({ ...input, page: input.page ?? 1, pageSize: input.pageSize ?? 25 }),
    save: (input: SaveDonationInput) => repository.saveDonation(input),
    markReviewed: (donationId: string, reviewNotes?: string) => repository.markDonationReviewed(donationId, reviewNotes),
    returnToReview: (donationId: string) => repository.returnDonationToReview(donationId),
    archive: (donationId: string) => repository.archiveDonation(donationId),
    listUnassigned: (search?: string) => repository.listUnassignedDonations(search),
  };
}

export function createDonationGroupService(repository: TempleRepository) {
  return {
    list360: (input: { search?: string; sortBy?: string; page?: number; pageSize?: number } = {}) =>
      repository.listDonationGroupsPage({ ...input, page: input.page ?? 1, pageSize: input.pageSize ?? 18 }),
    getById: (groupId: string) => repository.getDonationGroupDetail(groupId),
    save: (input: SaveDonationGroupInput) => repository.saveDonationGroup(input),
    mapDonations: (groupId: string, donationIds: string[]) => repository.mapDonations(groupId, donationIds),
    unmapDonation: (donationId: string) => repository.unmapDonation(donationId),
    archive: (groupId: string) => repository.archiveDonationGroup(groupId),
  };
}
