"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { isAbsoluteHttpUrl, isBlobStorageUrl } from "@/lib/runtimeAssetPaths";

const DEFAULT_FALLBACK_SRC = "/images/placeholders/product-fallback.svg";

type ShopProductImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string | null;
};

const DO88_THUMB_PATTERN =
  /^https?:\/\/(?:www\.)?do88\.se\/bilder\/artiklar\/liten\/(.+?)_S\.jpg$/i;

// Shopify CDN reuploads sometimes drop the `_<uuid>` suffix that the
// original asset URL carried — e.g. for Urban Automotive the legacy URL
// `Studio-10_df5ca99f-8380-4135-933b-e97001d981ce.jpg` now 404s, but the
// cleaned-up `Studio-10.jpg` resolves fine. Strip the UUID before the
// extension so DB-cached Shopify URLs keep resolving without a full
// re-scrape.
const SHOPIFY_UUID_SUFFIX_PATTERN =
  /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(?:jpg|jpeg|png|webp|gif|avif))/i;

function upgradeSupplierImage(src: string) {
  // do88 thumbnails (`/bilder/artiklar/liten/<sku>_S.jpg`) have a larger
  // un-suffixed counterpart (`/bilder/artiklar/<sku>.jpg`) — ~50% larger and
  // visually identical, so prefer it when available.
  const do88Match = src.match(DO88_THUMB_PATTERN);
  if (do88Match) {
    return `https://www.do88.se/bilder/artiklar/${do88Match[1]}.jpg`;
  }
  // Shopify-CDN stale-uuid normalisation. Only applies when the host is
  // shopify CDN so we don't accidentally rewrite something else.
  if (/^https?:\/\/cdn\.shopify\.com\//i.test(src)) {
    return src.replace(SHOPIFY_UUID_SUFFIX_PATTERN, "$1");
  }
  return src;
}

function normalizeImageSrc(src: string | null | undefined) {
  const normalized = String(src ?? "").trim();
  if (!normalized) {
    return "";
  }

  const withProtocol = normalized.startsWith("//") ? `https:${normalized}` : normalized;
  return upgradeSupplierImage(withProtocol);
}

export function ShopProductImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  ...props
}: ShopProductImageProps) {
  const normalizedSrc = normalizeImageSrc(src);
  const normalizedFallback = normalizeImageSrc(fallbackSrc) || DEFAULT_FALLBACK_SRC;
  const [currentSrc, setCurrentSrc] = useState(normalizedSrc || normalizedFallback);
  const shouldBypassOptimization =
    props.unoptimized ?? (isBlobStorageUrl(currentSrc) || isAbsoluteHttpUrl(currentSrc));

  useEffect(() => {
    setCurrentSrc(normalizedSrc || normalizedFallback);
  }, [normalizedFallback, normalizedSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      unoptimized={shouldBypassOptimization}
      onError={() => {
        if (currentSrc !== normalizedFallback) {
          setCurrentSrc(normalizedFallback);
        }
      }}
    />
  );
}
