import type { ReactNode } from "react";
import { LoginBrandPanel } from "@/components/auth/LoginBrandPanel";
import styles from "@/app/login/login.module.css";

export function AuthLayout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`${styles.authLayout} ${className}`.trim()}>
      <LoginBrandPanel />
      <section className={styles.formPanel}>
        <div className={styles.formPanelInner}>{children}</div>
        <footer className={styles.copyright}>
          © {new Date().getFullYear()} Kambaru Sri Durgaparameshwari Temple
        </footer>
      </section>
    </main>
  );
}
