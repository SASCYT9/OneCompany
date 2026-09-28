"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ShopVariantImageContextValue = {
  selectedVariantImage: string | null;
  setSelectedVariantImage: (image: string | null) => void;
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
  const setVariantImage = useCallback(
    (image: string | null) => {
      if (enabled) setSelectedVariantImage(image);
    },
    [enabled]
  );
  const value = useMemo<ShopVariantImageContextValue>(
    () => ({
      selectedVariantImage: enabled ? selectedVariantImage : null,
      setSelectedVariantImage: setVariantImage,
    }),
    [enabled, selectedVariantImage, setVariantImage]
  );

  return <ShopVariantImageContext.Provider value={value}>{children}</ShopVariantImageContext.Provider>;
}

export function useShopVariantImage() {
  return useContext(ShopVariantImageContext);
}
