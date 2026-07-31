import styles from "@/app/login/login.module.css";

export function LoginBrandPanel({ className = "" }: { className?: string }) {
  return (
    <aside className={`${styles.brandPanel} ${className}`.trim()} aria-label="Kambaru Sri Durgaparameshwari Temple">
      <div className={styles.cornerOrnament} aria-hidden="true" />
      <div className={styles.mandala} aria-hidden="true">
        <span>ॐ</span>
      </div>
      <div className={styles.templeIdentity}>
        <span className={styles.templeEyebrow}>Kambaru</span>
        <h1>Sri Durgaparameshwari</h1>
        <strong>Temple</strong>
      </div>
      <div className={styles.deityPlaceholder} aria-hidden="true">
        <div className={styles.arch}>
          <span>ಶ್ರೀ</span>
        </div>
      </div>
      <blockquote className={styles.blessing}>
        <strong>Sri Durga Parameshwari Devi</strong>
        <span>Anugraha Katakshamastu</span>
      </blockquote>
    </aside>
  );
}
