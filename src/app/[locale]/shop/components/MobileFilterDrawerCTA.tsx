"use client";

import { useCallback } from "react";

import type { SupportedLocale } from "@/lib/seo";

import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type MobileFilterDrawerCTAProps = {
  /** Localized locale string, drives copy. */
  locale: SupportedLocale;
  /** Current filter result count. Drives pluralization and disabled state. */
  resultsCount: number;
  /** DOM id of the results grid `<main>` element to scroll to. */
  resultsAnchorId: string;
};

/**
 * Sticky bottom-of-drawer CTA that closes the mobile filter drawer and
 * smooth-scrolls the viewport to the result grid.
 *
 * Why: every brand catalog (Adro, Akrapovic, CSF, Girodisc, Ipe, Ohlins,
 * RaceChip) shares the same mobile drawer pattern from `useMobileFilterDrawer`.
 * A full-screen drawer covers the product grid on phones, so after narrowing
 * the filter the user sees something like "1 результат" inside the drawer
 * but has no way to know the matching card lives BELOW the drawer they
 * can't see past. Users have to manually tap X or the backdrop to dismiss
 * the drawer and only then scroll to find their result.
 *
 * This component renders a prominent primary-action button at the bottom
 * of the drawer body. Tap → close drawer → next frame → smooth scroll to
 * the `<main id="{resultsAnchorId}">` results container.
 *
 * The catalog component is expected to add `id={resultsAnchorId}` and
 * `scroll-mt-24` (so the sticky site header doesn't cover the top of the
 * grid after the smooth scroll) to its results `<main>` element.
 */
export function MobileFilterDrawerCTA({
  locale,
  resultsCount,
  resultsAnchorId,
}: MobileFilterDrawerCTAProps) {
  const { mobileFilterOpen, closeMobileFilter } = useMobileFilterDrawer();
  const isUa = locale === "ua";

  const onClick = useCallback(() => {
    closeMobileFilter();
    if (typeof window === "undefined") return;
    // Wait one frame so the drawer exit transition fires before we scroll;
    // otherwise the smooth scroll competes with the layout shift and feels
    // janky on mid-range phones.
    window.requestAnimationFrame(() => {
      document
        .getElementById(resultsAnchorId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [closeMobileFilter, resultsAnchorId]);

  // Some catalogs (e.g. Adro) render the drawer aside element unconditionally
  // and toggle its visibility via CSS. The CTA must NOT render in the desktop
  // sidebar variant — only when the drawer is actually open on mobile.
  if (!mobileFilterOpen) return null;

  let label: string;
  if (resultsCount === 0) {
    label = isUa ? "Немає результатів" : "No results";
  } else if (isUa) {
    // Ukrainian plural: 1 товар / 2-4 товари / 5+ товарів. Keep in sync with
    // the result-count line elsewhere in the drawer that says "N результатів".
    const word = resultsCount === 1 ? "товар" : resultsCount < 5 ? "товари" : "товарів";
    label = `Переглянути ${resultsCount} ${word}`;
  } else {
    label = `View ${resultsCount} ${resultsCount === 1 ? "product" : "products"}`;
  }

  return (
    <div className="sticky bottom-0 -mx-5 mt-6 border-t border-foreground/15 dark:border-white/10 bg-card/95 dark:bg-[#050505]/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
      <button
        type="button"
        onClick={onClick}
        disabled={resultsCount === 0}
        className="flex w-full items-center justify-center gap-2 border border-[#ff4a00]/50 bg-[#ff4a00]/15 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground transition-colors hover:border-[#ff4a00] hover:bg-[#ff4a00]/25 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white"
      >
        {label}
      </button>
    </div>
  );
}
