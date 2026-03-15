'use client';

import { useEffect, useRef } from 'react';
import { trackViewProduct } from '@/lib/analytics';

type Props = {
  slug: string;
  name: string;
  priceEur?: number;
};

export function ShopProductViewTracker({ slug, name, priceEur }: Props) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackViewProduct(slug, name, priceEur, 'EUR');
  }, [slug, name, priceEur]);
  return null;
}
