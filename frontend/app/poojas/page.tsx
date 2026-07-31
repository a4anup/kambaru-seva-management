import { AppShell } from "@/components/AppShell";
import { PoojaRegister } from "@/components/poojas/PoojaRegister";
import { getBackendServices } from "@/lib/server/backend";

export default async function PoojasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const services = await getBackendServices();
  const [initialRows, devotees, beneficiaries] = await Promise.all([
    services.enrollments.listRegister(),
    services.devotees.listDirectory(),
    services.beneficiaries.listAll(),
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
