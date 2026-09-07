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
}: {
  slug: string;
  locale: SupportedLocale;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{
    slug: string;
    fitment: Fitment;
    groups: CrossShopCardGroup[];
  } | null>(null);

  useEffect(() => {
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
  }, [slug]);

  return (
    <div ref={anchor} className="min-h-px">
      {result?.slug === slug ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <CrossShopFitment locale={locale} fitment={result.fitment} groups={result.groups} />
        </div>
      ) : null}
    </div>
  );
}
