import { AppShell } from "@/components/AppShell";
import styles from "./PageLoading.module.css";

/**
 * Route-level loading state (used by app/<route>/loading.tsx). Keeps the
 * sidebar and header visible and shows a neutral skeleton, so navigation
 * responds instantly even when the server render is slow.
 */
export function PageLoading({ title, metrics = false }: { title: string; metrics?: boolean }) {
  return (
    <AppShell title={title}>
      <div className={styles.wrap} role="status" aria-busy="true">
        <span className="visually-hidden">Loading {title}</span>
        {metrics && (
          <div className={styles.row} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className={`${styles.block} ${styles.metric}`} />
            ))}
          </div>
        )}
        <div className={`${styles.block} ${styles.panel}`} aria-hidden="true" />
      </div>
    </AppShell>
  );
}
