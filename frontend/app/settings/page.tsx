import { Settings } from "lucide-react";
import { ResourcePage } from "@/components/ResourcePage";

const rows = [
  { primary: "Temple Profile", secondary: "Kambaru Sri Durgaparameshwari Temple", detail: "Branding, contact information, and default language", status: "Active" as const },
  { primary: "Pooja Configuration", secondary: "Shashwatha Pooja · ₹1,000", detail: "Annual recurrence · February 29 policy configurable", status: "Active" as const },
  { primary: "Label Layout", secondary: "A4 · 15 labels", detail: "3 columns × 5 rows · Physical calibration pending", status: "Pending" as const },
  { primary: "Staff Accounts", secondary: "5 authorized administrators", detail: "Email/password access · No public signup", status: "Active" as const },
];

export default function SettingsPage() {
  return <ResourcePage title="Settings" eyebrow="Temple administration" description="Configure temple details, Shashwatha Pooja defaults, labels, and staff access." actionLabel="Save Settings" icon={Settings} rows={rows} />;
}
