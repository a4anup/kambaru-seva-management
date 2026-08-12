import type { TempleRepository } from "./contracts";
import type { Donation, DonationGroup, SaveDevoteeInput, SaveEnrollmentInput } from "../types";
import type {
  DashboardSummary,
  AuditLogRow,
  DevoteeDirectoryPage,
  DevoteePoojaDate,
  LabelRecipient,
  PageResult,
  PoojaRegisterRow,
  ReportPage,
} from "../types";
import {
  mapBeneficiary,
  mapDevotee,
  mapEnrollment,
  type BeneficiaryRow,
  type DevoteeRow,
  type EnrollmentRow,
} from "./row-mappers";

export interface SupabaseRepositoryConfig {
  url: string;
  anonKey: string;
  accessToken: string;
}

async function callRpc<T>(
  config: SupabaseRepositoryConfig,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text();
    if (response.status === 409 || details.includes("STALE_RECORD")) {
      throw new Error("CONFLICT");
    }
    if (details.includes("DUPLICATE_GROUP")) {
      throw new Error("DUPLICATE_GROUP");
    }
    throw new Error(`Supabase mutation failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

type DonationResponse = {
  id: string; donor_name?: string; phone?: string; address_line1?: string; address_line2?: string;
  city?: string; district?: string; state?: string; postal_code?: string; amount_minor: number;
  currency: "INR"; receipt_number?: string; donation_date: string; donation_type_id: string;
  donation_type_name: string; payment_method?: Donation["paymentMethod"]; payment_reference?: string;
  donation_group_id?: string; donation_group_title?: string; linked_devotee_id?: string;
  linked_devotee_name?: string; linked_devotee_no?: string; notes?: string;
  review_status: Donation["reviewStatus"]; reviewed_at?: string; reviewed_by?: string;
  reviewed_by_name?: string; review_notes?: string;
  created_at: string; modified_at: string;
};

type DonationGroupResponse = {
  group_id: string; title: string; phone?: string; alternate_phone?: string; address_line1?: string;
  address_line2?: string; city?: string; district?: string; state?: string; postal_code?: string;
  linked_devotee_id?: string; linked_devotee_name?: string; notes?: string; total_amount_minor: number;
  donation_count: number; first_donation_date?: string; latest_donation_date?: string;
  created_at: string; modified_at: string;
};

function mapDonation(row: DonationResponse): Donation {
  return {
    id: row.id, donorName: row.donor_name, phone: row.phone, addressLine1: row.address_line1,
    addressLine2: row.address_line2, city: row.city, district: row.district, state: row.state,
    postalCode: row.postal_code, amountMinor: Number(row.amount_minor), currency: row.currency,
    receiptNumber: row.receipt_number, donationDate: row.donation_date, donationTypeId: row.donation_type_id,
    donationTypeName: row.donation_type_name, paymentMethod: row.payment_method,
    paymentReference: row.payment_reference, donationGroupId: row.donation_group_id,
    donationGroupTitle: row.donation_group_title, linkedDevoteeId: row.linked_devotee_id,
    linkedDevoteeName: row.linked_devotee_name, linkedDevoteeNo: row.linked_devotee_no,
    notes: row.notes, reviewStatus: row.review_status, reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by, reviewedByName: row.reviewed_by_name, reviewNotes: row.review_notes,
    createdAt: row.created_at, modifiedAt: row.modified_at,
  };
}

function mapDonationGroup(row: DonationGroupResponse): DonationGroup {
  return {
    id: row.group_id, title: row.title, phone: row.phone, alternatePhone: row.alternate_phone,
    addressLine1: row.address_line1, addressLine2: row.address_line2, city: row.city,
    district: row.district, state: row.state, postalCode: row.postal_code,
    linkedDevoteeId: row.linked_devotee_id, linkedDevoteeName: row.linked_devotee_name,
    notes: row.notes, totalAmountMinor: Number(row.total_amount_minor), donationCount: Number(row.donation_count),
    firstDonationDate: row.first_donation_date, latestDonationDate: row.latest_donation_date,
    createdAt: row.created_at, modifiedAt: row.modified_at,
  };
}

export function createSupabaseTempleRepository(
  config: SupabaseRepositoryConfig,
): TempleRepository {
  if (!config.url || !config.anonKey || !config.accessToken) {
    throw new Error("An authenticated Supabase configuration is required.");
  }
  return {
    async listDevoteesPage({ search, letter, page, pageSize }): Promise<DevoteeDirectoryPage> {
      const result = await callRpc<{
        items: Array<DevoteeRow & { pooja_count: number }>;
        total: number;
        allTotal: number;
        letterCounts: Record<string, number>;
      }>(config, "devotee_directory_page", {
        search_text: search?.trim() || null,
        initial_letter: letter && letter !== "ALL" ? letter : null,
        page_size: pageSize,
        page_offset: Math.max(0, page - 1) * pageSize,
      });
      return {
        items: result.items.map((row) => {
          const devotee = mapDevotee(row);
          const hasException = !devotee.phonePrimary || !devotee.addressLine1 || !devotee.addressCity || !/^\d{6}$/.test(devotee.addressPostalCode);
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
            poojaCount: Number(row.pooja_count),
            hasException,
            createdAt: devotee.createdAt,
            modifiedAt: devotee.modifiedAt,
          };
        }),
        total: Number(result.total),
        allTotal: Number(result.allTotal),
        letterCounts: Object.fromEntries(Object.entries(result.letterCounts ?? {}).map(([key, value]) => [key, Number(value)])),
      };
    },
    async getDevoteeById(devoteeId) {
      const params = new URLSearchParams({ select: "*", id: `eq.${devoteeId}`, limit: "1" });
      const [devoteeResponse, countResponse] = await Promise.all([
        fetch(`${config.url}/rest/v1/devotees?${params}`, {
          headers: { apikey: config.anonKey, Authorization: `Bearer ${config.accessToken}` },
          cache: "no-store",
        }),
        fetch(`${config.url}/rest/v1/pooja_enrollments?select=id&devotee_id=eq.${encodeURIComponent(devoteeId)}&status=eq.active`, {
          method: "HEAD",
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.accessToken}`,
            Prefer: "count=exact",
            Range: "0-0",
          },
          cache: "no-store",
        }),
      ]);
      if (!devoteeResponse.ok || !countResponse.ok) throw new Error("Supabase devotee lookup failed.");
      const row = ((await devoteeResponse.json()) as DevoteeRow[])[0];
      if (!row) return null;
      const devotee = mapDevotee(row);
      const count = Number(countResponse.headers.get("content-range")?.split("/")[1] ?? 0);
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
        poojaCount: count,
        hasException: !devotee.phonePrimary || !devotee.addressLine1 || !devotee.addressCity || !/^\d{6}$/.test(devotee.addressPostalCode),
        createdAt: devotee.createdAt,
        modifiedAt: devotee.modifiedAt,
      };
    },
    async listPoojasPage({ mode, date, search, page, pageSize }): Promise<PageResult<PoojaRegisterRow>> {
      type JoinedRow = EnrollmentRow & {
        devotee_no: string;
        sponsor_name: string;
        phone_primary: string | null;
        beneficiary_name?: string;
        beneficiary_relation?: PoojaRegisterRow["relation"];
        beneficiary_phone?: string;
        beneficiary_rashi?: string;
        beneficiary_nakshatra?: string;
        beneficiary_gotra?: string;
        beneficiary_notes?: string;
        devotee_address_line1: string;
        devotee_address_line2?: string;
        devotee_address_city: string;
        devotee_address_district?: string;
        devotee_address_state: string;
        devotee_address_postal_code: string;
      };
      const result = await callRpc<{ items: JoinedRow[]; total: number }>(config, "pooja_register_page", {
        filter_mode: mode,
        target_date: date,
        search_text: search?.trim() || null,
        page_size: pageSize,
        page_offset: Math.max(0, page - 1) * pageSize,
      });
      return {
        items: result.items.map((row) => {
          const custom = row.address_mode === "custom";
          const addressLine = custom ? row.custom_address_line1 ?? "" : row.devotee_address_line1;
          const addressCity = custom ? row.custom_address_city ?? "" : row.devotee_address_city;
          const postalCode = custom ? row.custom_address_postal_code ?? "" : row.devotee_address_postal_code;
          const missingPhone = !row.phone_primary;
          const missingAddress = !addressLine || !addressCity;
          const missingPincode = !/^\d{6}$/.test(postalCode);
          const hasException = missingPhone || missingAddress || missingPincode;
          const missingParts = [
            missingPhone && "phone number",
            missingPincode && "PIN code",
            missingAddress && "address",
          ].filter((part): part is string => Boolean(part));
          const relation = row.for_self ? "Self" : `${row.beneficiary_relation ?? "other"}`.replace(/^./, (value) => value.toUpperCase()) as PoojaRegisterRow["relation"];
          return {
            enrollmentId: row.id,
            poojaNo: row.pooja_no,
            devoteeId: row.devotee_id,
            devoteeNo: row.devotee_no,
            beneficiaryId: row.beneficiary_id,
            sponsorName: row.sponsor_name,
            beneficiaryName: row.for_self ? row.sponsor_name : row.beneficiary_name ?? "Unknown beneficiary",
            relation,
            beneficiaryPhone: row.beneficiary_phone,
            beneficiaryRashi: row.beneficiary_rashi,
            beneficiaryNakshatra: row.beneficiary_nakshatra,
            beneficiaryGotra: row.beneficiary_gotra,
            beneficiaryNotes: row.beneficiary_notes,
            phone: row.phone_primary,
            annualMonth: row.annual_month,
            annualDay: row.annual_day,
            leapDayPolicy: row.leap_day_policy,
            addressMode: row.address_mode,
            addressLine,
            addressLine2: custom ? row.custom_address_line2 : row.devotee_address_line2,
            addressCity,
            addressDistrict: custom ? row.custom_address_district : row.devotee_address_district,
            addressState: custom ? row.custom_address_state ?? "" : row.devotee_address_state,
            postalCode,
            status: row.status,
            feeMinor: row.fee_minor,
            currency: row.currency,
            paymentReference: row.payment_reference,
            receiptNumber: row.receipt_number,
            enrollmentDate: row.enrollment_date,
            notes: row.notes,
            hasException,
            exceptionNote: missingParts.length > 0 ? `Missing ${missingParts.join(", ")}` : undefined,
            createdAt: row.created_at,
            modifiedAt: row.modified_at,
          };
        }),
        total: Number(result.total),
      };
    },
    async getCalendarCounts(year, month): Promise<Record<number, number>> {
      const rows = await callRpc<Array<{ annual_day: number; pooja_count: number }>>(config, "pooja_calendar_counts", {
        target_year: year,
        target_month: month,
      });
      return Object.fromEntries(rows.map((row) => [Number(row.annual_day), Number(row.pooja_count)]));
    },
    async getDashboardSummary(date): Promise<DashboardSummary> {
      const result = await callRpc<DashboardSummary>(config, "dashboard_summary", { target_date: date });
      return {
        ...result,
        todayCount: Number(result.todayCount),
        weekCount: Number(result.weekCount),
        activeCount: Number(result.activeCount),
        devoteeCount: Number(result.devoteeCount),
        dailyCounts: result.dailyCounts.map((item) => ({ date: item.date, count: Number(item.count) })),
        missingPhoneCount: Number(result.missingPhoneCount),
        missingPincodeCount: Number(result.missingPincodeCount),
        missingAddressCount: Number(result.missingAddressCount),
      };
    },
    async listAuditPage({ search, entity, action, page, pageSize }) {
      const result = await callRpc<{
        items: Array<{
          id: string;
          actor_id: string | null;
          actor_name: string;
          action: string;
          entity_type: string;
          entity_id: string;
          reference_no: string;
          occurred_at: string;
          changed_fields: string[];
        }>;
        total: number;
      }>(config, "audit_log_page", {
        search_text: search?.trim() || null,
        entity_filter: entity?.trim() || null,
        action_filter: action?.trim() || null,
        page_size: pageSize,
        page_offset: Math.max(0, page - 1) * pageSize,
      });
      return {
        items: result.items.map((row): AuditLogRow => ({
          id: row.id,
          actorId: row.actor_id,
          actorName: row.actor_name,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          referenceNo: row.reference_no,
          occurredAt: row.occurred_at,
          changedFields: row.changed_fields ?? [],
        })),
        total: Number(result.total),
      };
    },
    async listBeneficiariesByDevotee(devoteeId) {
      const params = new URLSearchParams({
        select: "*",
        devotee_id: `eq.${devoteeId}`,
        archived_at: "is.null",
        order: "full_name.asc,id.asc",
      });
      const response = await fetch(`${config.url}/rest/v1/beneficiaries?${params}`, {
        headers: { apikey: config.anonKey, Authorization: `Bearer ${config.accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Supabase beneficiary query failed (${response.status}).`);
      return ((await response.json()) as BeneficiaryRow[]).map(mapBeneficiary);
    },
    async listDevoteePoojaDates(devoteeId): Promise<DevoteePoojaDate[]> {
      const rows = await callRpc<Array<{
        enrollment_id: string;
        pooja_no: string;
        beneficiary_name: string;
        relation: DevoteePoojaDate["relation"];
        annual_month: number;
        annual_day: number;
        status: DevoteePoojaDate["status"];
      }>>(config, "devotee_pooja_dates", { target_devotee_id: devoteeId });
      return rows.map((row) => ({
        enrollmentId: row.enrollment_id,
        poojaNo: row.pooja_no,
        beneficiaryName: row.beneficiary_name,
        relation: row.relation,
        annualMonth: row.annual_month,
        annualDay: row.annual_day,
        status: row.status,
      }));
    },
    async listLabelRecipients({ mode, date, rangeFrom, rangeTo }): Promise<LabelRecipient[]> {
      const rows = await callRpc<Array<{
        id: string;
        name: string;
        phone: string | null;
        address_line: string;
        address_line2: string | null;
        city: string;
        state: string;
        postal_code: string;
      }>>(config, "label_recipients", {
        filter_mode: mode,
        target_date: date ?? null,
        range_from: rangeFrom ?? null,
        range_to: rangeTo ?? null,
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        addressLine: row.address_line,
        addressLine2: row.address_line2 ?? undefined,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
      }));
    },
    async listInvitationRecipients(scope): Promise<LabelRecipient[]> {
      const rows = await callRpc<Array<{
        id: string;
        name: string;
        phone: string | null;
        address_line: string;
        address_line2: string | null;
        city: string;
        state: string;
        postal_code: string;
      }>>(config, "label_invitation_recipients", { scope });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        addressLine: row.address_line,
        addressLine2: row.address_line2 ?? undefined,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
      }));
    },
    async queryReport(input): Promise<ReportPage> {
      type ReportRowResponse = ReportPage["items"][number] & {
        enrollment_id: string;
        devotee_no: string;
        sponsor_name: string;
        beneficiary_name: string;
        address_city: string;
        postal_code: string;
        address_mode: "devotee_primary" | "custom";
        annual_month: number;
        annual_day: number;
      };
      const result = await callRpc<{
        items: ReportRowResponse[];
        total: number;
        activeCount: number;
        uniqueDevotees: number;
        incompleteCount: number;
        groups: Array<{ label: string; count: number }>;
        filterOptions: ReportPage["filterOptions"];
      }>(config, "report_query", {
        from_date: input.fromDate || null,
        to_date: input.toDate || null,
        search_text: input.search || null,
        filter_pincode: input.pincode || null,
        filter_state: input.state || null,
        filter_rashi: input.rashi || null,
        filter_gotra: input.gotra || null,
        filter_nakshatra: input.nakshatra || null,
        filter_relation: input.relation || null,
        filter_address_mode: input.addressMode || null,
        filter_status: input.status || null,
        group_by: input.groupBy,
        page_size: input.pageSize,
        page_offset: Math.max(0, input.page - 1) * input.pageSize,
      });
      return {
        items: result.items.map((row) => ({
          enrollmentId: row.enrollment_id,
          devoteeNo: row.devotee_no,
          sponsorName: row.sponsor_name,
          beneficiaryName: row.beneficiary_name,
          relation: row.relation,
          phone: row.phone,
          rashi: row.rashi,
          nakshatra: row.nakshatra,
          gotra: row.gotra,
          addressCity: row.address_city,
          state: row.state,
          postalCode: row.postal_code,
          addressMode: row.address_mode,
          status: row.status,
          annualMonth: row.annual_month,
          annualDay: row.annual_day,
        })),
        total: Number(result.total),
        activeCount: Number(result.activeCount),
        uniqueDevotees: Number(result.uniqueDevotees),
        incompleteCount: Number(result.incompleteCount),
        groups: result.groups,
        filterOptions: result.filterOptions,
      };
    },
    async exportReportRows(input): Promise<ReportPage["items"]> {
      type ExportRowResponse = {
        enrollment_id: string;
        devotee_no: string;
        sponsor_name: string;
        beneficiary_name: string;
        relation: string;
        phone: string | null;
        rashi: string;
        nakshatra: string;
        gotra: string;
        address_city: string;
        state: string;
        postal_code: string;
        address_mode: "devotee_primary" | "custom";
        status: ReportPage["items"][number]["status"];
        annual_month: number;
        annual_day: number;
      };
      const rows = await callRpc<ExportRowResponse[]>(config, "report_export_rows", {
        from_date: input.fromDate || null,
        to_date: input.toDate || null,
        search_text: input.search || null,
        filter_pincode: input.pincode || null,
        filter_state: input.state || null,
        filter_rashi: input.rashi || null,
        filter_gotra: input.gotra || null,
        filter_nakshatra: input.nakshatra || null,
        filter_relation: input.relation || null,
        filter_address_mode: input.addressMode || null,
        filter_status: input.status || null,
      });
      return rows.map((row) => ({
        enrollmentId: row.enrollment_id,
        devoteeNo: row.devotee_no,
        sponsorName: row.sponsor_name,
        beneficiaryName: row.beneficiary_name,
        relation: row.relation,
        phone: row.phone,
        rashi: row.rashi,
        nakshatra: row.nakshatra,
        gotra: row.gotra,
        addressCity: row.address_city,
        state: row.state,
        postalCode: row.postal_code,
        addressMode: row.address_mode,
        status: row.status,
        annualMonth: row.annual_month,
        annualDay: row.annual_day,
      }));
    },
    async createDevotee(input: SaveDevoteeInput) {
      const row = await callRpc<DevoteeRow>(config, "create_devotee", {
        input_payload: input,
      });
      return mapDevotee(row);
    },
    async updateDevotee(
      input: SaveDevoteeInput & { id: string; expectedModifiedAt: string },
    ) {
      const row = await callRpc<DevoteeRow>(config, "update_devotee", {
        devotee_id: input.id,
        expected_modified_at: input.expectedModifiedAt,
        input_payload: input,
      });
      return mapDevotee(row);
    },
    async createEnrollment(input: SaveEnrollmentInput) {
      const row = await callRpc<EnrollmentRow>(config, "create_pooja_enrollment", {
        input_payload: input,
      });
      return mapEnrollment(row);
    },
    async updateEnrollment(
      input: SaveEnrollmentInput & { id: string; expectedModifiedAt: string },
    ) {
      const row = await callRpc<EnrollmentRow>(config, "update_pooja_enrollment", {
        enrollment_id: input.id,
        expected_modified_at: input.expectedModifiedAt,
        input_payload: input,
      });
      return mapEnrollment(row);
    },
    async archiveEnrollment(enrollmentId, expectedModifiedAt) {
      return callRpc<boolean>(config, "archive_pooja_enrollment", {
        target_enrollment_id: enrollmentId,
        expected_modified_at: expectedModifiedAt,
      });
    },
    async listDonationTypes() {
      const rows = await callRpc<Array<{ id: string; name: string; description?: string; active: boolean; display_order: number }>>(config, "donation_types_active", {});
      return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, active: row.active, displayOrder: row.display_order }));
    },
    async listDonationsPage(input) {
      const result = await callRpc<{ items: DonationResponse[]; total: number; totalAmountMinor: number; mappedCount: number; unmappedCount: number; reviewRequiredCount: number; reviewedCount: number }>(config, "donation_list_page", {
        search_text: input.search?.trim() || null, donor_initial: input.donorInitial?.trim() || null, from_date: input.fromDate || null, to_date: input.toDate || null,
        filter_type_id: input.donationTypeId || null, filter_payment_method: input.paymentMethod || null, filter_group_id: input.donationGroupId || null,
        mapping_status: input.mappingStatus || null, filter_review_status: input.reviewStatus || null, minimum_amount: input.minimumAmountMinor ?? null,
        maximum_amount: input.maximumAmountMinor ?? null, sort_by: "name_asc",
        page_size: input.pageSize, page_offset: Math.max(0, input.page - 1) * input.pageSize,
      });
      return { items: result.items.map(mapDonation), total: Number(result.total), totalAmountMinor: Number(result.totalAmountMinor), mappedCount: Number(result.mappedCount), unmappedCount: Number(result.unmappedCount), reviewRequiredCount: Number(result.reviewRequiredCount), reviewedCount: Number(result.reviewedCount) };
    },
    async listDonationGroupsPage(input) {
      const result = await callRpc<{ items: DonationGroupResponse[]; totalGroups: number; totalDonations: number; totalAmountMinor: number; unmappedDonations: number }>(config, "donation_groups_page", {
        search_text: input.search?.trim() || null, sort_by: input.sortBy || "latest", page_size: input.pageSize,
        page_offset: Math.max(0, input.page - 1) * input.pageSize,
      });
      return { items: result.items.map(mapDonationGroup), totalGroups: Number(result.totalGroups), totalDonations: Number(result.totalDonations), totalAmountMinor: Number(result.totalAmountMinor), unmappedDonations: Number(result.unmappedDonations) };
    },
    async getDonationGroupDetail(groupId) {
      const result = await callRpc<{ group: DonationGroupResponse; donations: DonationResponse[] } | null>(config, "donation_group_detail", { target_group_id: groupId });
      return result ? { group: mapDonationGroup(result.group), donations: result.donations.map(mapDonation) } : null;
    },
    async listUnassignedDonations(search) {
      const rows = await callRpc<DonationResponse[]>(config, "unassigned_donations", { search_text: search?.trim() || null, page_size: 50 });
      return rows.map(mapDonation);
    },
    async saveDonation(input) {
      const saved = await callRpc<{ id: string }>(config, "save_donation", { input_payload: input });
      const row = await callRpc<DonationResponse>(config, "donation_by_id", { target_donation_id: saved.id });
      return mapDonation(row);
    },
    async markDonationReviewed(donationId, reviewNotes) {
      await callRpc<DonationResponse>(config, "mark_donation_reviewed", { target_donation_id: donationId, review_notes_input: reviewNotes || null });
      const row = await callRpc<DonationResponse>(config, "donation_by_id", { target_donation_id: donationId });
      return mapDonation(row);
    },
    async returnDonationToReview(donationId) {
      await callRpc<DonationResponse>(config, "return_donation_to_review", { target_donation_id: donationId });
      const row = await callRpc<DonationResponse>(config, "donation_by_id", { target_donation_id: donationId });
      return mapDonation(row);
    },
    async archiveDonation(donationId) {
      return Boolean(await callRpc<boolean>(config, "archive_donation", { target_donation_id: donationId }));
    },
    async saveDonationGroup(input) {
      const saved = await callRpc<{ id: string }>(config, "save_donation_group", { input_payload: input });
      const detail = await callRpc<{ group: DonationGroupResponse; donations: DonationResponse[] }>(config, "donation_group_detail", { target_group_id: saved.id });
      return mapDonationGroup(detail.group);
    },
    async mapDonations(groupId, donationIds) {
      return Number(await callRpc<number>(config, "map_donations", { target_group_id: groupId, donation_ids: donationIds }));
    },
    async unmapDonation(donationId) {
      return Boolean(await callRpc<boolean>(config, "unmap_donation", { target_donation_id: donationId }));
    },
    async archiveDonationGroup(groupId) {
      return Boolean(await callRpc<boolean>(config, "archive_donation_group", { target_group_id: groupId }));
    },
  };
}
