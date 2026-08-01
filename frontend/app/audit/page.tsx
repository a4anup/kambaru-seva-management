import { AppShell } from "@/components/AppShell";
import { AuditLog } from "@/components/audit/AuditLog";
import { getBackendServices } from "@/lib/server/backend";

export default async function AuditPage() {
  const { audit } = await getBackendServices();
  return (
    <AppShell title="Audit Log">
      <AuditLog initialPage={await audit.listPage()} />
    </AppShell>
  );
}
