"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "@/app/login/login.module.css";

export function RotatingTempleGallery({ images }: { images: string[] }) {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveImage((current) => (current + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [images.length]);

  return (
    <div className={styles.templeGallery}>
      <div className={styles.galleryFrame}>
        {images.map((name, index) => (
          <Image
            className={`${styles.galleryImage} ${index === activeImage ? styles.galleryImageActive : ""}`}
            key={name}
            src={`/api/temple-images/${encodeURIComponent(name)}`}
            alt={`Kambaramma temple view ${index + 1}`}
            fill
            priority={index === 0}
            sizes="(max-width: 767px) 100vw, (max-width: 1024px) 36vw, 42vw"
          />
        ))}
        <div className={styles.galleryShade} aria-hidden="true" />
      </div>
      {images.length > 1 && (
        <div className={styles.galleryControls} aria-label="Temple image gallery">
          {images.map((name, index) => (
            <button
              className={index === activeImage ? styles.galleryDotActive : ""}
              key={name}
              type="button"
              onClick={() => setActiveImage(index)}
              aria-label={`Show temple image ${index + 1}`}
              aria-current={index === activeImage ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
