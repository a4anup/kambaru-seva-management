"use server";

import type { AuditLogRow, PageResult } from "@kambaru/backend";
import { getBackendServices } from "@/lib/server/backend";

export async function loadAuditLog(input: {
  search?: string;
  entity?: string;
  action?: string;
  page?: number;
}): Promise<PageResult<AuditLogRow>> {
  const { audit } = await getBackendServices();
  return audit.listPage({ ...input, pageSize: 25 });
}
