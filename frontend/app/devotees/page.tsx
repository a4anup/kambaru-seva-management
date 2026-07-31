import { AppShell } from "@/components/AppShell";
import { DevoteeDirectory } from "@/components/devotees/DevoteeDirectory";
import { getBackendServices } from "@/lib/server/backend";

export default async function DevoteesPage() {
  const services = await getBackendServices();
  return (
    <AppShell title="Devotees">
      <DevoteeDirectory initialPage={await services.devotees.listDirectoryPage()} />
    </AppShell>
  );
}
