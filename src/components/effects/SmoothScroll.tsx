"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip if user prefers reduced motion — native scroll respects accessibility.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const lenis = new Lenis({
      // Luxury easing — long elegant decay (Apple-style).
      duration: 1.4,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Wheel feels heavier and more deliberate.
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      // Avoid breaking native momentum on touch devices.
      smoothWheel: true,
      syncTouch: false,
    });

    // Drive Lenis with GSAP's RAF — single ticker, no double-RAF, perfect sync
    // with ScrollTrigger.
    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    // Tell ScrollTrigger to use Lenis's scroll position so triggers fire at
    // the right moments while smoothing is active.
    lenis.on("scroll", ScrollTrigger.update);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  return null;
}
