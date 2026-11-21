import type { Metadata } from "next";
import { StaffSessionProvider } from "@/components/auth/StaffSessionProvider";
import { NavigationFeedback } from "@/components/NavigationFeedback";
import { getStaffSession } from "@/lib/server/auth";
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
  const staff = await getStaffSession();
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
