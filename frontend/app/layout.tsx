import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Kambaru Devi Seva — Admin",
  description: "Shashwatha Pooja register for Kambaru Sri Durgaparameshwari Temple",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
