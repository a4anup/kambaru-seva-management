import type { TempleRepository } from "../repositories";

export function createAuditService(templeData: TempleRepository) {
  return {
    async listPage(input: {
      search?: string;
      entity?: string;
      action?: string;
      page?: number;
      pageSize?: number;
    } = {}) {
      return templeData.listAuditPage({
        search: input.search,
        entity: input.entity,
        action: input.action,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 25,
      });
    },
  };
}
