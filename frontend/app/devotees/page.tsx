import { AppShell } from "@/components/AppShell";
import { DevoteeDirectory } from "@/components/devotees/DevoteeDirectory";
import { getBackendServices } from "@/lib/server/backend";

export default async function DevoteesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const services = await getBackendServices();
  const [initialPage, initialEditRow] = await Promise.all([
    services.devotees.listDirectoryPage(),
    edit ? services.devotees.getById(edit) : Promise.resolve(null),
  ]);
  return (
    <AppShell title="Devotees">
      <DevoteeDirectory initialPage={initialPage} initialEditRow={initialEditRow ?? undefined} />
    </AppShell>
  );
}
