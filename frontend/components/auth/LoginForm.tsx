"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, LoaderCircle, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/auth/PasswordInput";
import styles from "@/app/login/login.module.css";

type FieldErrors = {
  identity?: string;
  password?: string;
};

type SignInResult = { ok: true } | { ok: false };

async function mockSignIn(identity: string, password: string): Promise<SignInResult> {
  // Phase 1b integration point: replace with a backend AuthService/Supabase call.
  // Credentials are intentionally neither logged nor persisted.
  await new Promise((resolve) => window.setTimeout(resolve, 550));
  return identity.length > 0 && password.length > 0 ? { ok: true } : { ok: false };
}

export function LoginForm({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!identity.trim()) next.identity = "Enter your username or email.";
    if (!password) next.password = "Enter your password.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setAuthError(undefined);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await mockSignIn(identity.trim(), password);
      if (!result.ok) {
        setAuthError("Unable to sign in. Check your username and password.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setAuthError("Unable to sign in. Check your username and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.loginCard} ${className}`.trim()}>
      <header className={styles.cardHeader}>
        <div className={styles.devotionalMark} aria-hidden="true">
          <span />
          <Flame size={24} />
          <span />
        </div>
        <h2 className={styles.applicationTitle}>Shashwatha Pooja</h2>
        <p className={styles.applicationSubtitle}>Management Application</p>
        <p className={styles.welcome}>Welcome back! Please sign in to continue.</p>
      </header>

      <Alert icon={ShieldCheck} tone="info" role="status" className={styles.previewNotice}>
        Frontend preview: authentication is not connected yet. Validated submissions open the mock dashboard.
      </Alert>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {authError && <Alert>{authError}</Alert>}

        <FormField id="identity" label="Username or email" error={errors.identity}>
          <Input
            id="identity"
            name="username"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            onBlur={() => setErrors((current) => ({ ...current, identity: identity.trim() ? undefined : "Enter your username or email." }))}
            placeholder="Enter your username or email"
            autoComplete="username"
            aria-invalid={Boolean(errors.identity)}
            aria-describedby={errors.identity ? "identity-error" : undefined}
            leadingIcon={<UserRound size={19} />}
          />
        </FormField>

        <FormField id="password" label="Password" error={errors.password}>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            invalid={Boolean(errors.password)}
            describedBy={errors.password ? "password-error" : undefined}
          />
        </FormField>

        <div className={styles.formOptions}>
          <label className={styles.remember}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Remember me</span>
          </label>
        </div>

        <Button className={styles.signInButton} type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className={styles.spinner} size={19} aria-hidden="true" /> : <LogIn size={19} aria-hidden="true" />}
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <div className={styles.securityMessage}>
        <ShieldCheck size={17} aria-hidden="true" />
        <span>Secure staff application. Access is limited to authorized temple personnel.</span>
      </div>
    </div>
  );
}
