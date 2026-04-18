"use client";

import { useCallback, useEffect, useState } from "react";

export function useMobileFilterDrawer() {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const closeMobileFilter = useCallback(() => {
    setMobileFilterOpen(false);
  }, []);

  const toggleMobileFilter = useCallback(() => {
    setMobileFilterOpen((current) => !current);
  }, []);

  useEffect(() => {
    if (!mobileFilterOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileFilterOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileFilterOpen]);

  return {
    mobileFilterOpen,
    setMobileFilterOpen,
    closeMobileFilter,
    toggleMobileFilter,
  };
}
