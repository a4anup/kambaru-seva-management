import type {
  Beneficiary,
  AuditLogRow,
  DashboardSummary,
  Devotee,
  DevoteeDirectoryPage,
  DevoteePoojaDate,
  LabelDateMode,
  LabelInvitationScope,
  LabelRecipient,
  PageResult,
  PoojaEnrollment,
  PoojaRegisterFilterMode,
  PoojaRegisterRow,
  ReportFilters,
  ReportGroupBy,
  ReportPage,
  SaveDevoteeInput,
  SaveEnrollmentInput,
} from "../types";

/**
 * Application services depend on this contract rather than the Supabase SDK or
 * REST transport, keeping domain rules portable and independently testable.
 */
export interface TempleRepository {
  listDevoteesPage(input: { search?: string; letter?: string; page: number; pageSize: number }): Promise<DevoteeDirectoryPage>;
  getDevoteeById(devoteeId: string): Promise<DevoteeDirectoryPage["items"][number] | null>;
  listPoojasPage(input: { mode: PoojaRegisterFilterMode; date: string; search?: string; page: number; pageSize: number }): Promise<PageResult<PoojaRegisterRow>>;
  getCalendarCounts(year: number, month: number): Promise<Record<number, number>>;
  getDashboardSummary(date: string): Promise<DashboardSummary>;
  listAuditPage(input: { search?: string; entity?: string; action?: string; page: number; pageSize: number }): Promise<PageResult<AuditLogRow>>;
  listBeneficiariesByDevotee(devoteeId: string): Promise<Beneficiary[]>;
  listDevoteePoojaDates(devoteeId: string): Promise<DevoteePoojaDate[]>;
  listLabelRecipients(input: { mode: LabelDateMode; date?: string; rangeFrom?: string; rangeTo?: string }): Promise<LabelRecipient[]>;
  listInvitationRecipients(scope: LabelInvitationScope): Promise<LabelRecipient[]>;
  queryReport(input: ReportFilters & { groupBy: ReportGroupBy; page: number; pageSize: number }): Promise<ReportPage>;
  exportReportRows(input: ReportFilters): Promise<ReportPage["items"]>;
  createDevotee(input: SaveDevoteeInput): Promise<Devotee>;
  updateDevotee(input: SaveDevoteeInput & { id: string; expectedModifiedAt: string }): Promise<Devotee>;
  createEnrollment(input: SaveEnrollmentInput): Promise<PoojaEnrollment>;
  updateEnrollment(input: SaveEnrollmentInput & { id: string; expectedModifiedAt: string }): Promise<PoojaEnrollment>;
}
