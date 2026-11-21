"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function isInternalNavigation(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) return false;

  const link = (event.target as Element | null)?.closest("a");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return false;

  const destination = new URL(link.href, window.location.href);
  return destination.origin === window.location.origin &&
    destination.href !== window.location.href &&
    !destination.hash;
}

// The current page stays visible underneath this overlay until the next route
// commits. Data-heavy routes have a loading.tsx (components/PageLoading) that
// keeps the sidebar/header and shows a skeleton — never a blank screen — and
// its commit changes the pathname, which clears this overlay. A short delay
// avoids the overlay flashing on near-instant transitions.
const OVERLAY_DELAY_MS = 200;

export function NavigationFeedback() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const timeout = useRef<number | undefined>(undefined);
  const overlayTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timeout.current);
    window.clearTimeout(overlayTimeout.current);
    // pathname changing is the external signal that the destination page has
    // mounted, so clearing the overlay here (not via lazy state) is correct.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowOverlay(false);
    const frame = window.requestAnimationFrame(() => setNavigating(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    function begin(event: MouseEvent) {
      if (!isInternalNavigation(event)) return;
      setNavigating(true);
      window.clearTimeout(timeout.current);
      window.clearTimeout(overlayTimeout.current);
      timeout.current = window.setTimeout(() => setNavigating(false), 10000);
      overlayTimeout.current = window.setTimeout(() => setShowOverlay(true), OVERLAY_DELAY_MS);
    }

    document.addEventListener("click", begin, true);
    return () => {
      document.removeEventListener("click", begin, true);
      window.clearTimeout(timeout.current);
      window.clearTimeout(overlayTimeout.current);
    };
  }, []);

  return (
    <>
      <div
        className={`navigation-progress ${navigating ? "is-navigating" : ""}`}
        role="progressbar"
        aria-label="Loading page"
        aria-hidden={!navigating}
      >
        <span />
      </div>
      <div
        className={`navigation-overlay ${showOverlay ? "is-active" : ""}`}
        aria-hidden="true"
      >
        <span className="navigation-overlay-spinner" />
      </div>
      <span className="visually-hidden" aria-live="polite">
        {navigating ? "Loading the selected page" : ""}
      </span>
    </>
  );
}
