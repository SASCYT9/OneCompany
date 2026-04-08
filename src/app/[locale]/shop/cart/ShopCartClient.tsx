'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { localizeShopText } from '@/lib/shopText';
import { trackViewCart } from '@/lib/analytics';
import { useShopCurrency } from '@/components/shop/CurrencyContext';

type CartItem = {
  id: string;
  slug: string;
  quantity: number;
  variantId?: string | null;
  variantTitle?: string | null;
  title?: { ua: string; en: string };
  price?: { eur: number; usd: number; uah: number };
  image?: string;
  fallbackImage?: string | null;
};

type CartResponse = { items: CartItem[]; totalItems: number };

function localize(locale: SupportedLocale, v: { ua: string; en: string } | undefined) {
  if (!v) return '';
  return localizeShopText(locale, v);
}

function formatPrice(locale: SupportedLocale, amount: number, currency: 'EUR' | 'USD' | 'UAH') {
  const n = new Intl.NumberFormat(locale === 'ua' ? 'uk-UA' : 'en-US', { maximumFractionDigits: 0 }).format(amount);
  return locale === 'ua' ? `${n} ${currency === 'UAH' ? 'грн' : currency}` : `${currency} ${n}`;
}

export default function ShopCartClient({ locale }: { locale: SupportedLocale }) {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const isUa = locale === 'ua';
  const { currency: selectedCurrency } = useShopCurrency();

  const CartItemImage = ({ src, fallbackSrc, alt }: { src: string; fallbackSrc?: string | null; alt: string }) => {
    const [failedCount, setFailedCount] = useState(0);
    
    // Attempt 1: src
    // Attempt 2: fallbackSrc (if different)
    // Attempt 3: ShoppingBag icon
    
    const currentSrc = failedCount === 0 ? src : fallbackSrc;
    const hasValidSrc = currentSrc && currentSrc.trim().length > 0;

    if (failedCount >= 2 || !hasValidSrc) {
      return (
        <div className="h-full w-full bg-white/5 flex items-center justify-center text-white/20">
          <ShoppingBag className="w-8 h-8 opacity-50" />
        </div>
      );
    }
    
    return (
      <img
        src={currentSrc!.replace(/^["']|["']$/g, '').trim()}
        alt={alt}
        className="h-full w-full object-contain p-1.5 mix-blend-screen"
        onError={() => setFailedCount(c => c + 1)}
      />
    );
  };

  const loadCart = async () => {
    try {
      const res = await fetch('/api/shop/cart');
      const data = await res.json();
      setCart(data);
    } catch {
      setCart({ items: [], totalItems: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const setQuantity = async (itemId: string, quantity: number) => {
    if (!cart) return;
    setUpdating(itemId);
    try {
      const response = await fetch(`/api/shop/cart/items/${itemId}`, {
        method: quantity > 0 ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        ...(quantity > 0 ? { body: JSON.stringify({ quantity }) } : {}),
      });
      if (!response.ok) {
        throw new Error('Cart update failed');
      }
      await loadCart();
    } finally {
      setUpdating(null);
    }
  };

  const items = cart?.items ?? [];
  const currency = selectedCurrency as 'EUR' | 'USD' | 'UAH';
  const { rates } = useShopCurrency();

  // Smart cross-currency conversion using live NBU rates
  // If the requested currency column is 0, convert from whichever currency IS available
  function getPrice(p: { eur: number; usd: number; uah: number }, c: string): number {
    const direct = c === 'USD' ? p.usd : c === 'UAH' ? p.uah : p.eur;
    if (direct > 0) return direct;

    // No direct price — try to convert from another currency using NBU rates
    if (!rates) {
      // No rates loaded yet, use any available value as rough fallback
      return p.uah || p.usd || p.eur || 0;
    }

    // rates.USD = how many UAH per 1 USD (e.g. 41.5)
    // rates.EUR = how many UAH per 1 EUR (e.g. 45.5)
    // Find a source price that has a value
    let sourceUah = 0;
    if (p.uah > 0) {
      sourceUah = p.uah;
    } else if (p.usd > 0 && rates.USD > 0) {
      sourceUah = p.usd * rates.USD; // USD → UAH
    } else if (p.eur > 0 && rates.EUR > 0) {
      sourceUah = p.eur * rates.EUR; // EUR → UAH
    }

    if (sourceUah <= 0) return 0;

    // Convert from UAH to target currency
    if (c === 'UAH') return Math.round(sourceUah);
    if (c === 'USD' && rates.USD > 0) return Math.round((sourceUah / rates.USD) * 100) / 100;
    if (c === 'EUR' && rates.EUR > 0) return Math.round((sourceUah / rates.EUR) * 100) / 100;
    return Math.round(sourceUah);
  }

  const subtotal = items.reduce((s, i) => s + (i.price ? getPrice(i.price, currency) * i.quantity : 0), 0);

  useEffect(() => {
    if (!cart) return;
    trackViewCart(items.length, subtotal);
  }, [cart, items.length, subtotal]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-24 text-center text-white/60">
        {isUa ? 'Завантаження кошика…' : 'Loading cart…'}
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] text-white"
    >
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/${locale}/shop`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          ← {isUa ? 'До каталогу' : 'Back to catalog'}
        </Link>
        <header>
          <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
            {isUa ? 'Мій Кошик' : 'My Cart'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            {items.length > 0
              ? isUa
                ? `${items.length} ${items.length === 1 ? 'позиція' : 'позиції'}`
                : `${items.length} ${items.length === 1 ? 'item' : 'items'}`
              : isUa
                ? 'Додайте товари з нашого каталогу'
                : 'Add items from our catalog'}
          </p>
        </header>

        {items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-black/40 p-10 text-center text-white/60 shadow-2xl backdrop-blur-xl">
            <p>{isUa ? 'Кошик порожній.' : 'Your cart is empty.'}</p>
            <Link
              href={`/${locale}/shop`}
              className="mt-6 inline-block rounded-full border border-white/10 bg-zinc-950 px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-white/90 transition hover:border-[#c29d59]/50 hover:bg-[#c29d59]/10 hover:text-[#c29d59]"
            >
              {isUa ? 'Перейти до каталогу' : 'Go to catalog'}
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-4">
              {items.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-xl transition hover:border-[#c29d59]/30 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 sm:h-24 sm:w-24">
                    <CartItemImage src={i.image || ''} fallbackSrc={i.fallbackImage} alt={localize(locale, i.title)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-light text-lg text-white truncate">{localize(locale, i.title)}</p>
                    {i.variantTitle ? <p className="mt-1 text-xs text-[#c29d59]/80 uppercase tracking-widest truncate">{i.variantTitle}</p> : null}
                    <p className="mt-2 text-sm text-white/55">
                      {i.price ? formatPrice(locale, getPrice(i.price, currency), currency) : ''} × {i.quantity}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(i.id, Math.max(1, i.quantity - 1))}
                        disabled={updating === i.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-[#c29d59]/50 hover:bg-[#c29d59]/10 hover:text-[#c29d59] disabled:opacity-50"
                        aria-label={isUa ? 'Зменшити кількість' : 'Decrease quantity'}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(i.id, i.quantity + 1)}
                        disabled={updating === i.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-[#c29d59]/50 hover:bg-[#c29d59]/10 hover:text-[#c29d59] disabled:opacity-50"
                        aria-label={isUa ? 'Збільшити кількість' : 'Increase quantity'}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantity(i.id, 0)}
                        disabled={updating === i.id}
                        className="ml-4 text-[10px] uppercase tracking-[0.2em] text-white/40 transition hover:text-[#c29d59]"
                      >
                        {isUa ? 'Видалити' : 'Remove'}
                      </button>
                    </div>
                  </div>
                  <div className="text-left text-lg font-light text-white sm:text-right sm:shrink-0">
                    {i.price ? formatPrice(locale, getPrice(i.price, currency) * i.quantity, currency) : '—'}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center text-xl font-light text-white">
                <span className="text-[#c29d59] uppercase tracking-[0.1em] text-xs font-normal">{isUa ? 'Підсумок' : 'Subtotal'}</span>
                <span>{formatPrice(locale, subtotal, currency)}</span>
              </div>
              <Link
                href={`/${locale}/shop/checkout`}
                className="mt-8 block w-full rounded-full border border-white/10 bg-zinc-950 py-4 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-[#c29d59] transition-all duration-300 hover:border-[#c29d59]/50 hover:bg-[#c29d59]/10 hover:shadow-[0_0_20px_-5px_rgba(194,157,89,0.3)] shadow-2xl"
              >
                {isUa ? 'Оформити замовлення' : 'Proceed to checkout'}
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
