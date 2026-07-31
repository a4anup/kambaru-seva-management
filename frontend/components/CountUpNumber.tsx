"use client";

import { useEffect, useRef } from "react";

export function CountUpNumber({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }

    let start: number | null = null;
    const duration = 700;
    let frame: number;

    function step(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (el) el.textContent = String(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <span className="num tabular" ref={ref}>
      0
    </span>
  );
}
