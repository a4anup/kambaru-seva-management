import { ShieldCheck } from "lucide-react";
import { ResourcePage } from "@/components/ResourcePage";

const rows = [
  { primary: "Pooja enrollment updated", secondary: "Anil Shetty · Today, 10:42", detail: "Changed dispatch address for Lakshmi R.", status: "Active" as const },
  { primary: "Devotee created", secondary: "Radha K. · Today, 09:18", detail: "Created DEV-00008 — Ramesh Kamath", status: "Active" as const },
  { primary: "Enrollment paused", secondary: "Anil Shetty · Yesterday, 16:05", detail: "Vijaya Hegde — administrator note recorded", status: "Paused" as const },
  { primary: "Labels generated", secondary: "Radha K. · Yesterday, 08:12", detail: "7 courier labels for 29 Jul 2026", status: "Ready" as const },
];

export default function AuditPage() {
  return <ResourcePage title="Audit Log" eyebrow="Append-only activity" description="Review who created or changed temple records and when each action occurred." actionLabel="Export Audit" icon={ShieldCheck} rows={rows} />;
}
