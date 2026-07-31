import { AppShell } from "@/components/AppShell";
import { LabelGenerator } from "@/components/labels/LabelGenerator";
import { getBackendServices } from "@/lib/server/backend";

export default async function LabelsPage() {
  const services = await getBackendServices();
  const [enrollments, devotees] = await Promise.all([
    services.enrollments.listRegister(),
    services.devotees.listDirectory(),
  ]);
  return (
    <AppShell title="Generate Labels">
      <LabelGenerator
        enrollments={enrollments}
        devotees={devotees}
      />
    </AppShell>
  );
}
