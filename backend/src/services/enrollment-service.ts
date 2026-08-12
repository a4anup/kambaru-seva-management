import type { TempleRepository } from "../repositories";
import type { PoojaRegisterRow, SaveEnrollmentInput } from "../types";

// Mirrors PLAN.md §10.5 `EnrollmentService`. All filtering, counting, and
// pagination happen in Postgres via the repository's *Page/getDashboardSummary
// methods — this service stays a thin pass-through so no operation ever pages
// through the whole enrollments table just to answer a small question.

export function createEnrollmentService(templeData: TempleRepository) {
  return {
    async listRegisterPage(input: {
      mode?: import("../types").PoojaRegisterFilterMode;
      date: string;
      search?: string;
      page?: number;
      pageSize?: number;
    }) {
      return templeData.listPoojasPage({
        mode: input.mode ?? "today",
        date: input.date,
        search: input.search,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 10,
      });
    },

    async getCalendarCounts(year: number, month: number) {
      return templeData.getCalendarCounts(year, month);
    },

    async getDashboardSummary(date: string) {
      return templeData.getDashboardSummary(date);
    },

    async create(input: SaveEnrollmentInput): Promise<PoojaRegisterRow> {
      const saved = await templeData.createEnrollment(input);
      const page = await templeData.listPoojasPage({ mode: "all", date: saved.enrollmentDate, search: saved.poojaNo, page: 1, pageSize: 1 });
      const enrollment = page.items.find((item) => item.enrollmentId === saved.id);
      if (!enrollment) throw new Error("Created enrollment could not be loaded.");
      return enrollment;
    },

    async update(
      input: SaveEnrollmentInput & { id: string; expectedModifiedAt: string },
    ): Promise<PoojaRegisterRow> {
      const saved = await templeData.updateEnrollment(input);
      const page = await templeData.listPoojasPage({ mode: "all", date: saved.enrollmentDate, search: saved.poojaNo, page: 1, pageSize: 1 });
      const enrollment = page.items.find((item) => item.enrollmentId === saved.id);
      if (!enrollment) throw new Error("Updated enrollment could not be loaded.");
      return enrollment;
    },

    async archive(enrollmentId: string, expectedModifiedAt: string) {
      return templeData.archiveEnrollment(enrollmentId, expectedModifiedAt);
    },
  };
}
