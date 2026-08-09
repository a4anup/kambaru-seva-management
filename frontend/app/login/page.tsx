import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Staff Sign In",
  description: "Authorized staff access to the Kambaru Seva Management Application.",
};

export default function LoginPage() {
  // Phase 1b: perform a server-side session check here and redirect authenticated staff.
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
