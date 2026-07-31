import { readdir } from "node:fs/promises";
import path from "node:path";
import { RotatingTempleGallery } from "@/components/auth/RotatingTempleGallery";
import styles from "@/app/login/login.module.css";

const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|webp)$/i;
const brandTitle = "KAMBARAMMA";
const templeName = "Shree Durgaparameshwari Kambar Temple";

async function templeImageNames() {
  const directory = path.join(process.cwd(), "assets", "images");
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && IMAGE_EXTENSION.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

export async function LoginBrandPanel({ className = "" }: { className?: string }) {
  const images = await templeImageNames();

  return (
    <aside className={`${styles.brandPanel} ${className}`.trim()} aria-label="Shree Durgaparameshwari Kambar Temple">
      <div className={styles.brandGlow} aria-hidden="true" />
      <header className={styles.templeBrand}>
        <div className={styles.templeIdentity}>
          <h1 aria-label={brandTitle}>
            {Array.from(brandTitle).map((character, index) => (
              <span
                className={styles.brandTitleCharacter}
                key={`${character}-${index}`}
                style={{ animationDelay: `${index * 110 - 1800}ms` }}
                aria-hidden="true"
              >
                {character}
              </span>
            ))}
          </h1>
          <p aria-label={templeName}>
            {Array.from(templeName).map((character, index) => (
              <span
                className={styles.brandSubtitleCharacter}
                key={`${character}-${index}`}
                style={{ animationDelay: `${index * 70 - 2600}ms` }}
                aria-hidden="true"
              >
                {character === " " ? "\u00A0" : character}
              </span>
            ))}
          </p>
        </div>
      </header>

      <RotatingTempleGallery images={images} />

      {/* <p className={styles.blessing}>॥ ಶ್ರೀ ದುರ್ಗಾಪರಮೇಶ್ವರಿ ಪ್ರಸನ್ನ ॥</p> */}
    </aside>
  );
}
