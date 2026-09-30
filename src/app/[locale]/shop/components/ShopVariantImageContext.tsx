"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ShopVariantImageContextValue = {
  selectedVariantImage: string | null;
  setSelectedVariantImage: (image: string | null) => void;
  selectedVariantSku: string | null;
  setSelectedVariantSku: (sku: string | null) => void;
};

const ShopVariantImageContext = createContext<ShopVariantImageContextValue | null>(null);

export function ShopVariantImageProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [selectedVariantImage, setSelectedVariantImage] = useState<string | null>(null);
  const [selectedVariantSku, setSelectedVariantSku] = useState<string | null>(null);
  const setVariantImage = useCallback(
    (image: string | null) => {
      if (enabled) setSelectedVariantImage(image);
    },
    [enabled]
  );
  const setVariantSku = useCallback(
    (sku: string | null) => {
      if (enabled) setSelectedVariantSku(sku);
    },
    [enabled]
  );
  const value = useMemo<ShopVariantImageContextValue>(
    () => ({
      selectedVariantImage: enabled ? selectedVariantImage : null,
      setSelectedVariantImage: setVariantImage,
      selectedVariantSku: enabled ? selectedVariantSku : null,
      setSelectedVariantSku: setVariantSku,
    }),
    [enabled, selectedVariantImage, setVariantImage, selectedVariantSku, setVariantSku]
  );

  return <ShopVariantImageContext.Provider value={value}>{children}</ShopVariantImageContext.Provider>;
}

export function useShopVariantImage() {
  return useContext(ShopVariantImageContext);
}

/** Keep every visible part number aligned with the active do88 configuration. */
export function ShopVariantSkuText({ fallbackSku }: { fallbackSku: string }) {
  const context = useShopVariantImage();
  return <span aria-live="polite">{context?.selectedVariantSku || fallbackSku}</span>;
}
