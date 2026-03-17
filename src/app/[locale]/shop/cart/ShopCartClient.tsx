'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { trackViewCart } from '@/lib/analytics';

type CartItem = {
  id: string;
  slug: string;
  quantity: number;
  variantId?: string | null;
  variantTitle?: string | null;
  title?: { ua: string; en: string };
  price?: { eur: number; usd: number; uah: number };
  image?: string;
};

type CartResponse = { items: CartItem[]; totalItems: number };

function localize(locale: SupportedLocale, v: { ua: string; en: string } | undefined) {
  if (!v) return '';
  // Fallback to the other language when a translation is missing.
  return locale === 'ua' ? v.ua || v.en : v.en || v.ua;
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
  const currency: 'EUR' | 'USD' | 'UAH' = isUa ? 'UAH' : 'EUR';
  const subtotal = items.reduce((s, i) => s + (i.price ? getPrice(i.price, currency) * i.quantity : 0), 0);

  useEffect(() => {
    if (!cart) return;
    trackViewCart(items.length, subtotal);
  }, [cart, items.length, subtotal]);
  function getPrice(p: { eur: number; usd: number; uah: number }, c: string) {
    if (c === 'USD') return p.usd;
    if (c === 'UAH') return p.uah;
    return p.eur;
  }

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
          href={`/${locale}/shop/urban/collections`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          ← {isUa ? 'До колекцій Urban' : 'Back to Urban collections'}
        </Link>
        <header>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
            Urban Automotive
          </p>
          <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
            {isUa ? 'Кошик Urban' : 'Urban cart'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            {items.length > 0
              ? isUa
                ? `${items.length} ${items.length === 1 ? 'позиція' : 'позиції'}`
                : `${items.length} ${items.length === 1 ? 'item' : 'items'}`
              : isUa
                ? 'Додайте товари з колекцій Urban'
                : 'Add items from the Urban collections'}
          </p>
        </header>

        {items.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.04] p-10 text-center text-white/60 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p>{isUa ? 'Кошик порожній.' : 'Your cart is empty.'}</p>
            <Link
              href={`/${locale}/shop/urban/collections`}
              className="mt-4 inline-block rounded-full border border-white/20 bg-white px-5 py-2 text-sm text-black transition hover:bg-white/90"
            >
              {isUa ? 'Перейти до колекцій' : 'Go to collections'}
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-4">
              {items.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-col gap-3 rounded-[26px] border border-white/10 bg-white/[0.05] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
                    {i.image ? (
                      <Image src={i.image} alt={localize(locale, i.title)} fill className="object-cover" sizes="(max-width: 640px) 100vw, 96px" />
                    ) : (
                      <div className="h-full w-full bg-white/5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{localize(locale, i.title)}</p>
                    {i.variantTitle ? <p className="mt-1 text-xs text-white/45">{i.variantTitle}</p> : null}
                    <p className="mt-1 text-sm text-white/55">
                      {i.price ? formatPrice(locale, getPrice(i.price, currency), currency) : ''} × {i.quantity}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(i.id, Math.max(1, i.quantity - 1))}
                        disabled={updating === i.id}
                        className="h-8 w-8 rounded border border-white/15 text-white/70 transition hover:bg-white/5 disabled:opacity-50"
                        aria-label={isUa ? 'Зменшити кількість' : 'Decrease quantity'}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(i.id, i.quantity + 1)}
                        disabled={updating === i.id}
                        className="h-8 w-8 rounded border border-white/15 text-white/70 transition hover:bg-white/5 disabled:opacity-50"
                        aria-label={isUa ? 'Збільшити кількість' : 'Increase quantity'}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantity(i.id, 0)}
                        disabled={updating === i.id}
                        className="ml-1 text-xs text-white/45 transition hover:text-red-400"
                      >
                        {isUa ? 'Видалити' : 'Remove'}
                      </button>
                    </div>
                  </div>
                  <div className="text-left text-sm font-medium text-white sm:text-right sm:shrink-0">
                    {i.price ? formatPrice(locale, getPrice(i.price, currency) * i.quantity, currency) : '—'}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
              <div className="flex justify-between text-lg text-white">
                <span>{isUa ? 'Підсумок' : 'Subtotal'}</span>
                <span>{formatPrice(locale, subtotal, currency)}</span>
              </div>
              <Link
                href={`/${locale}/shop/checkout`}
                className="mt-4 block w-full rounded-full border border-white/20 bg-white py-3 text-center font-medium text-black transition hover:bg-white/90"
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
