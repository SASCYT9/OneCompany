'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { isAbsoluteHttpUrl, isBlobStorageUrl } from '@/lib/runtimeAssetPaths';

const DEFAULT_FALLBACK_SRC = '/images/placeholders/product-fallback.svg';

type ShopProductImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string | null;
};

const DO88_THUMB_PATTERN = /^https?:\/\/(?:www\.)?do88\.se\/bilder\/artiklar\/liten\/(.+?)_S\.jpg$/i;

function upgradeSupplierImage(src: string) {
  // do88 thumbnails (`/bilder/artiklar/liten/<sku>_S.jpg`) have a larger
  // un-suffixed counterpart (`/bilder/artiklar/<sku>.jpg`) — ~50% larger and
  // visually identical, so prefer it when available.
  const do88Match = src.match(DO88_THUMB_PATTERN);
  if (do88Match) {
    return `https://www.do88.se/bilder/artiklar/${do88Match[1]}.jpg`;
  }
  return src;
}

function normalizeImageSrc(src: string | null | undefined) {
  const normalized = String(src ?? '').trim();
  if (!normalized) {
    return '';
  }

  const withProtocol = normalized.startsWith('//') ? `https:${normalized}` : normalized;
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
