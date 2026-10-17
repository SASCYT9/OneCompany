"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Fitment } from "@/lib/crossShopFitment";
import type { CrossShopCardGroup } from "@/lib/crossShopRecommendationCard";
import type { SupportedLocale } from "@/lib/seo";

const CrossShopFitment = dynamic(() => import("@/app/[locale]/shop/components/CrossShopFitment"));

export function DeferredCrossShopFitment({
  slug,
  locale,
  initialResult,
}: {
  slug: string;
  locale: SupportedLocale;
  /**
   * Cards computed on the server for this product. When present they are part
   * of the server HTML (crawlable links) and no request is made on scroll.
   */
  initialResult?: { fitment: Fitment; groups: CrossShopCardGroup[] } | null;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{
    slug: string;
    fitment: Fitment;
    groups: CrossShopCardGroup[];
  } | null>(initialResult?.groups.length ? { ...initialResult, slug } : null);
  const hasServerResult = Boolean(initialResult?.groups.length);

  useEffect(() => {
    if (hasServerResult) return;
    const controller = new AbortController();
    let active = true;
    let requested = false;
    async function load() {
      if (requested) return;
      requested = true;
      try {
        const response = await fetch(`/api/shop/recommendations?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (active && !controller.signal.aborted && data.fitment && data.groups?.length) {
          setResult({ ...data, slug });
        }
      } catch {
        // Optional recommendations must never interrupt the product or checkout.
      }
    }
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined") {
      void load();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            void load();
          }
        },
        { rootMargin: "400px" }
      );
      if (anchor.current) observer.observe(anchor.current);
    }
    return () => {
      active = false;
      observer?.disconnect();
      controller.abort();
    };
  }, [slug, hasServerResult]);

  const shown =
    result?.slug === slug
      ? result
      : initialResult?.groups.length
        ? { ...initialResult, slug }
        : null;

  return (
    <div ref={anchor} className="min-h-px">
      {shown ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <CrossShopFitment locale={locale} fitment={shown.fitment} groups={shown.groups} />
        </div>
      ) : null}
    </div>
  );
}
