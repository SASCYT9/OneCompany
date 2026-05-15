"use client";

import { create } from "zustand";

type MobileFilterDrawerStore = {
  mobileFilterOpen: boolean;
  setMobileFilterOpen: (open: boolean) => void;
  closeMobileFilter: () => void;
  toggleMobileFilter: () => void;
};

// Shared module-level store: every consumer (the catalog component AND the
// MobileFilterDrawerCTA rendered inside it) reads the same `mobileFilterOpen`.
// Previously this hook used a local useState, so the CTA's `mobileFilterOpen`
// was always its own initial `false` — it never rendered when the drawer was
// open, breaking the "View N products" CTA across every brand catalog.
const useStore = create<MobileFilterDrawerStore>((set) => ({
  mobileFilterOpen: false,
  setMobileFilterOpen: (open) => set({ mobileFilterOpen: open }),
  closeMobileFilter: () => set({ mobileFilterOpen: false }),
  toggleMobileFilter: () => set((state) => ({ mobileFilterOpen: !state.mobileFilterOpen })),
}));

// Browser-only side effects (body-scroll lock + Escape-to-close). Installed
// once at module load via Zustand subscribe rather than in a per-consumer
// useEffect — multiple consumers running their own setup/cleanup would each
// snapshot `body.style` and clobber each other (the second cleanup would
// restore "hidden" because the first had already set it).
//
// Lock strategy: pin the body in place via `position: fixed` with a negative
// `top` equal to the current scrollY. Reasons over the simpler
// `body.style.overflow = "hidden"`:
//   • iOS Safari ignores `overflow: hidden` on body for touch scrolling.
//   • If the scroll container is `<html>` (common in Next.js), setting
//     overflow on body does nothing.
//   • `overscroll-behavior: contain` on the drawer prevents chain-scroll on
//     desktop, but on touch the page still scrolls underneath unless the
//     viewport itself is unscrollable.
// Pinning via fixed makes the page literally unscrollable until we restore.
if (typeof window !== "undefined") {
  let saved: {
    bodyPosition: string;
    bodyTop: string;
    bodyLeft: string;
    bodyRight: string;
    bodyWidth: string;
    bodyOverflow: string;
    htmlOverflow: string;
    scrollY: number;
  } | null = null;
  let escHandler: ((event: KeyboardEvent) => void) | null = null;

  useStore.subscribe((state, prevState) => {
    if (state.mobileFilterOpen === prevState.mobileFilterOpen) return;

    if (state.mobileFilterOpen) {
      const body = document.body;
      const html = document.documentElement;
      saved = {
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyOverflow: body.style.overflow,
        htmlOverflow: html.style.overflow,
        scrollY: window.scrollY || window.pageYOffset || 0,
      };
      body.style.position = "fixed";
      body.style.top = `-${saved.scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";

      escHandler = (event) => {
        if (event.key === "Escape") {
          useStore.getState().setMobileFilterOpen(false);
        }
      };
      window.addEventListener("keydown", escHandler);
    } else {
      if (saved) {
        const body = document.body;
        const html = document.documentElement;
        body.style.position = saved.bodyPosition;
        body.style.top = saved.bodyTop;
        body.style.left = saved.bodyLeft;
        body.style.right = saved.bodyRight;
        body.style.width = saved.bodyWidth;
        body.style.overflow = saved.bodyOverflow;
        html.style.overflow = saved.htmlOverflow;
        // Restore scroll position — `scroll-behavior: smooth` global rules
        // would animate this; `instant` skips the animation.
        window.scrollTo({ top: saved.scrollY, left: 0, behavior: "instant" });
        saved = null;
      }
      if (escHandler) {
        window.removeEventListener("keydown", escHandler);
        escHandler = null;
      }
    }
  });
}

export function useMobileFilterDrawer() {
  const mobileFilterOpen = useStore((s) => s.mobileFilterOpen);
  const setMobileFilterOpen = useStore((s) => s.setMobileFilterOpen);
  const closeMobileFilter = useStore((s) => s.closeMobileFilter);
  const toggleMobileFilter = useStore((s) => s.toggleMobileFilter);

  return {
    mobileFilterOpen,
    setMobileFilterOpen,
    closeMobileFilter,
    toggleMobileFilter,
  };
}
