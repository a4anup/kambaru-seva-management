import { AppShell } from "@/components/AppShell";
import { DonationList } from "@/components/donations/DonationList";
import { getBackendServices } from "@/lib/server/backend";

export default async function DonationListPage() {
  const services = await getBackendServices();
  const [page, types, groups] = await Promise.all([
    services.donations.list(), services.donations.listTypes(), services.donationGroups.list360({ pageSize: 100 }),
  ]);
  return <AppShell title="Donations"><DonationList initialPage={page} types={types} groups={groups.items} /></AppShell>;
}
