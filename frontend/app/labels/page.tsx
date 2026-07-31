import { DevoteeService, EnrollmentService } from "@kambaru/backend";
import { AppShell } from "@/components/AppShell";
import { LabelGenerator } from "@/components/labels/LabelGenerator";

export default async function LabelsPage() {
  const [enrollments, devotees] = await Promise.all([
    EnrollmentService.listRegister(),
    DevoteeService.listDirectory(),
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
