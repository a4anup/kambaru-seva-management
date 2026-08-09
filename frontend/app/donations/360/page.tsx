import { AppShell } from "@/components/AppShell";
import { Donation360 } from "@/components/donations/Donation360";
import { getBackendServices } from "@/lib/server/backend";

export default async function Donation360Page() {
  const page = await (await getBackendServices()).donationGroups.list360();
  return <AppShell title="Donations"><Donation360 initialPage={page} /></AppShell>;
}
