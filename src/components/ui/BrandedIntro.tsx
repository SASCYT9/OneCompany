"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import BrandedLoadingScreen from "./BrandedLoadingScreen";

const SESSION_KEY = "onecompany:intro-seen";

export function BrandedIntro() {
  const pathname = usePathname();
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  // Shop pages own their loading and streaming states. Do not mount the fixed
  // branded screen there: it would cover the already available HTML before JS
  // hydrates (and would remain visible forever with JS disabled).
  const isShop = pathname?.split("/").includes("shop") ?? false;

  useEffect(() => {
    if (isShop) return;
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
  }, [isShop]);

  if (isShop || !visible) return null;
  return <BrandedLoadingScreen exiting={exiting} />;
}
export default BrandedIntro;
