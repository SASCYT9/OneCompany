'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trackAddToCart } from '@/lib/analytics';

type Props = {
  slug?: string;
  turn14Id?: string;
  locale: string;
  variantId?: string | null;
  variant?: 'default' | 'minimal' | 'inline';
  /** When false, do not redirect to cart after add (e.g. when button is inside a product card link). */
  redirect?: boolean;
  className?: string;
  label?: string;
  labelAdded?: string;
  /** Product name for analytics (view_product / add_to_cart). */
  productName?: string;
};

export function AddToCartButton({
  slug,
  turn14Id,
  locale,
  variantId,
  variant = 'default',
  redirect = true,
  className = '',
  label,
  labelAdded,
  productName,
}: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const isUa = locale === 'ua';
  const defaultLabel = isUa ? 'Додати в кошик' : 'Add to cart';
  const defaultAdded = isUa ? 'Додано' : 'Added';

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (adding || added) return;
    setAdding(true);
    try {
      const payload: any = { quantity: 1, variantId };
      if (slug) payload.slug = slug;
      if (turn14Id) payload.turn14Id = turn14Id;
      
      const response = await fetch('/api/shop/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Add to cart failed');
      }
      setAdded(true);
      if (slug) trackAddToCart(slug, 1, productName);
      if (redirect) router.push(`/${locale}/shop/cart`);
    } catch {
      setAdding(false);
    }
  };

  if (variant === 'minimal' || variant === 'inline') {
    const adding_label = isUa ? 'Додаємо…' : 'Adding…';
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={adding || added}
        aria-busy={adding}
        className={className}
      >
        {adding
          ? adding_label
          : added
            ? (labelAdded ?? defaultAdded)
            : (label ?? defaultLabel)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={adding}
      className={`rounded-full border border-white/25 bg-white px-5 py-2 text-xs uppercase tracking-[0.2em] text-black transition hover:border-white hover:bg-white/90 disabled:opacity-50 ${className}`}
    >
      {adding ? (isUa ? 'Додаємо…' : 'Adding…') : (label ?? defaultLabel)}
    </button>
  );
}

/** Link that goes to cart (e.g. in header). */
export function CartLink({ locale, className = '' }: { locale: string; className?: string }) {
  const isUa = locale === 'ua';
  return (
    <Link href={`/${locale}/shop/cart`} className={className}>
      {isUa ? 'Кошик' : 'Cart'}
    </Link>
  );
}
