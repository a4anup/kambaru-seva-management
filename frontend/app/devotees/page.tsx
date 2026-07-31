import { DevoteeService } from "@kambaru/backend";
import { AppShell } from "@/components/AppShell";
import { DevoteeDirectory } from "@/components/devotees/DevoteeDirectory";

export default async function DevoteesPage() {
  return (
    <AppShell title="Devotees">
      <DevoteeDirectory initialRows={await DevoteeService.listDirectory()} />
    </AppShell>
  );
}
