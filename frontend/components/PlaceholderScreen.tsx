import { AppShell } from "@/components/AppShell";

export function PlaceholderScreen({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <AppShell title={title}>
      <section className="dashboard-body">
        <div className="placeholder panel">
          <h2>Coming soon</h2>
          <p>{body}</p>
        </div>
      </section>
    </AppShell>
  );
}
