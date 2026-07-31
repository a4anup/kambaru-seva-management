import type { Metadata } from "next";
import { StaffSessionProvider, type StaffSession } from "@/components/auth/StaffSessionProvider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Kambaru Devi Seva — Admin",
  description: "Shashwatha Pooja register for Kambaru Sri Durgaparameshwari Temple",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let staff: StaffSession | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("display_name, role, is_active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.is_active) {
      staff = {
        id: user.id,
        displayName: profile.display_name,
        role: profile.role,
      };
    }
  }
  return (
    <html lang="en">
      <body><StaffSessionProvider staff={staff}>{children}</StaffSessionProvider></body>
    </html>
  );
}
