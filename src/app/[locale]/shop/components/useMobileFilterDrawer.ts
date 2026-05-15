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
// snapshot `body.style.overflow` and clobber each other (the second cleanup
// would restore "hidden" because the first had already set it).
if (typeof window !== "undefined") {
  let previousOverflow = "";
  let escHandler: ((event: KeyboardEvent) => void) | null = null;

  useStore.subscribe((state, prevState) => {
    if (state.mobileFilterOpen === prevState.mobileFilterOpen) return;

    if (state.mobileFilterOpen) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      escHandler = (event) => {
        if (event.key === "Escape") {
          useStore.getState().setMobileFilterOpen(false);
        }
      };
      window.addEventListener("keydown", escHandler);
    } else {
      document.body.style.overflow = previousOverflow;
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
