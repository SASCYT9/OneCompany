"use client";

import { useEffect, useState } from "react";
import BrandedLoadingScreen from "./BrandedLoadingScreen";

const REVEAL_AT_MS = 1720;
const REMOVE_AT_MS = 2220;
const REDUCED_REVEAL_AT_MS = 260;
const REDUCED_REMOVE_AT_MS = 620;

export function BrandedIntro() {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealAt = reducedMotion ? REDUCED_REVEAL_AT_MS : REVEAL_AT_MS;
    const removeAt = reducedMotion ? REDUCED_REMOVE_AT_MS : REMOVE_AT_MS;

    const revealTimer = window.setTimeout(() => setExiting(true), revealAt);
    const removeTimer = window.setTimeout(() => setVisible(false), removeAt);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return <BrandedLoadingScreen exiting={exiting} />;
}

export default BrandedIntro;
