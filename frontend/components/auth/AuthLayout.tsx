import type { ReactNode } from "react";
import { LoginBrandPanel } from "@/components/auth/LoginBrandPanel";
import styles from "@/app/login/login.module.css";

export function AuthLayout({ children, className = "" }: { children: ReactNode; className?: string }) {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <main className={`${styles.authLayout} ${className}`.trim()}>
      <LoginBrandPanel />
      <section className={styles.formPanel}>
        <div className={styles.formPanelInner}>{children}</div>
        <footer className={styles.copyright}>
          <span className={styles.copyrightOm} aria-hidden="true">ॐ</span>
          <span>Shree Durgaparameshwari Temple Kambar <b aria-label="registered">®</b> {year}</span>
        </footer>
      </section>
    </main>
  );
}
