"use client";

import { useEffect, useState } from "react";
import BrandedLoadingScreen from "./BrandedLoadingScreen";

const SESSION_KEY = "onecompany:intro-seen";

export function BrandedIntro() {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The route's Suspense loading screen owns data readiness. This is only a brief brand reveal.
    const revealAt = seen || reduced ? 0 : 650;
    const revealTimer = window.setTimeout(() => setExiting(true), revealAt);
    const removeTimer = window.setTimeout(
      () => setVisible(false),
      revealAt + (reduced ? 120 : 320)
    );
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;
  return <BrandedLoadingScreen exiting={exiting} />;
}
export default BrandedIntro;
