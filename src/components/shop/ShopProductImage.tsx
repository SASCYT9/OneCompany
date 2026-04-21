'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';

const DEFAULT_FALLBACK_SRC = '/images/placeholders/product-fallback.svg';

type ShopProductImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
};

function normalizeImageSrc(src: string | null | undefined) {
  const normalized = String(src ?? '').trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('//') ? `https:${normalized}` : normalized;
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

  useEffect(() => {
    setCurrentSrc(normalizedSrc || normalizedFallback);
  }, [normalizedFallback, normalizedSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (currentSrc !== normalizedFallback) {
          setCurrentSrc(normalizedFallback);
        }
      }}
    />
  );
}
