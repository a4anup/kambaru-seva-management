import { AppShell } from "@/components/AppShell";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";
import { getBackendServices } from "@/lib/server/backend";

export default async function ReportsPage() {
  const services = await getBackendServices();
  const [poojas, devotees] = await Promise.all([
    services.enrollments.listRegister(),
    services.devotees.listDirectory(),
  ]);
  return (
    <AppShell title="Reports">
      <ReportsWorkspace
        poojas={poojas}
        devotees={devotees}
      />
    </AppShell>
  );
}
