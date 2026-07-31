import type { Metadata } from "next";
import { StaffSessionProvider, type StaffSession } from "@/components/auth/StaffSessionProvider";
import { NavigationFeedback } from "@/components/NavigationFeedback";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import logo from "@/assets/logo.png";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: {
    default: "Kambaramma — Temple Administration",
    template: "%s | Kambaramma",
  },
  description: "Shashwatha Pooja register for Shree Durgaparameshwari Temple Kambar",
  icons: {
    icon: [{ url: logo.src, type: "image/png" }],
    shortcut: [{ url: logo.src, type: "image/png" }],
    apple: [{ url: logo.src, type: "image/png" }],
  },
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
      <body>
        <StaffSessionProvider staff={staff}>
          <NavigationFeedback />
          {children}
        </StaffSessionProvider>
      </body>
    </html>
  );
}
