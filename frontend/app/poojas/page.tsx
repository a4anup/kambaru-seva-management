import { BeneficiaryService, DevoteeService, EnrollmentService } from "@kambaru/backend";
import { AppShell } from "@/components/AppShell";
import { PoojaRegister } from "@/components/poojas/PoojaRegister";

export default async function PoojasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const [initialRows, devotees, beneficiaries] = await Promise.all([
    EnrollmentService.listRegister(),
    DevoteeService.listDirectory(),
    BeneficiaryService.listAll(),
  ]);
  return (
    <AppShell title="Poojas">
      <PoojaRegister
        initialRows={initialRows}
        devotees={devotees}
        beneficiaries={beneficiaries}
        initialDate={date}
      />
    </AppShell>
  );
}
