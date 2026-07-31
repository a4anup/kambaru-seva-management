import { DevoteeService, EnrollmentService } from "@kambaru/backend";
import { AppShell } from "@/components/AppShell";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";

export default async function ReportsPage() {
  const [poojas, devotees] = await Promise.all([
    EnrollmentService.listRegister(),
    DevoteeService.listDirectory(),
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
