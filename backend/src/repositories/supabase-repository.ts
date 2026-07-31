import type { TempleRepository } from "./contracts";
import type { SaveDevoteeInput, SaveEnrollmentInput } from "../types";
import type {
  DashboardSummary,
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
    throw new Error(`Supabase mutation failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
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
    async listPoojasPage({ mode, date, search, page, pageSize }): Promise<PageResult<PoojaRegisterRow>> {
      type JoinedRow = EnrollmentRow & {
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
  };
}
