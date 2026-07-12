"use client";

import { useEffect, useRef, useState } from "react";

export type CatalogIndexKey =
  | "adro"
  | "brabus"
  | "burger"
  | "csf"
  | "girodisc"
  | "ipe"
  | "ohlins"
  | "racechip";

type Manifest = {
  indexes?: Partial<Record<CatalogIndexKey, { file: string; count: number }>>;
};

export function useDeferredCatalogProducts<T>(initialProducts: T[], indexKey: CatalogIndexKey) {
  const [products, setProducts] = useState(initialProducts);
  const started = useRef(false);

  useEffect(() => setProducts(initialProducts), [initialProducts]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadIndex() {
      try {
        const manifestResponse = await fetch("/catalog-index/manifest.json", {
          cache: "no-cache",
          signal: controller.signal,
        });
        if (!manifestResponse.ok) return;
        const manifest = (await manifestResponse.json()) as Manifest;
        const entry = manifest.indexes?.[indexKey];
        if (!entry?.file) return;

        const indexResponse = await fetch(`/catalog-index/${entry.file}`, {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (!indexResponse.ok) return;
        const fullProducts = (await indexResponse.json()) as T[];
        if (!cancelled && fullProducts.length >= initialProducts.length) {
          setProducts(fullProducts);
        }
      } catch {
        // Keep the SSR page slice when the optional static index is unavailable.
      }
    }

    const enable = () => {
      if (started.current) return;
      started.current = true;
      void loadIndex();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((event) =>
      window.addEventListener(event, enable, { once: true, passive: true })
    );

    return () => {
      cancelled = true;
      controller.abort();
      events.forEach((event) => window.removeEventListener(event, enable));
    };
  }, [indexKey, initialProducts]);

  return products;
}
