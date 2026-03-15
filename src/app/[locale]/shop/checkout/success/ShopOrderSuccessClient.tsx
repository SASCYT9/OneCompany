'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { trackOrderPlaced } from '@/lib/analytics';

type OrderData = {
  orderNumber: string;
  status: string;
  email: string;
  customerName: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  createdAt: string;
  items: Array<{ title: string; quantity: number; total: number }>;
};

type Props = { locale: SupportedLocale; orderNumber?: string | null; token?: string | null };

export default function ShopOrderSuccessClient({ locale, orderNumber, token }: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(!!(orderNumber && token));
  const [error, setError] = useState('');
  const trackedRef = useRef(false);
  const isUa = locale === 'ua';

  useEffect(() => {
    if (!orderNumber || !token) {
      setLoading(false);
      setError(isUa ? 'Немає даних замовлення.' : 'No order data.');
      return;
    }
    fetch(`/api/shop/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setOrder(data);
        if (!trackedRef.current) {
          trackedRef.current = true;
          trackOrderPlaced(data.orderNumber, data.total, data.currency);
        }
      })
      .catch(() => setError(isUa ? 'Замовлення не знайдено.' : 'Order not found.'))
      .finally(() => setLoading(false));
  }, [orderNumber, token, isUa]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-24 text-center text-white/60">
        {isUa ? 'Завантаження…' : 'Loading…'}
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-black px-4 py-24">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-white/60">{error}</p>
          <Link href={`/${locale}/shop/urban/collections`} className="mt-4 inline-block text-white underline">
            {isUa ? 'До колекцій Urban' : 'Back to Urban collections'}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] text-white"
    >
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28 sm:px-6">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300" aria-hidden>
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
            Urban Automotive
          </p>
          <h1 className="mt-3 text-2xl font-light tracking-tight sm:text-4xl">
            {isUa ? 'Замовлення прийнято' : 'Urban order confirmed'}
          </h1>
          <p className="mt-2 font-mono text-lg text-white/80">{order.orderNumber}</p>
          <p className="mt-4 text-sm text-white/60">
            {isUa ? 'Ми надішлемо підтвердження на' : 'We will send confirmation to'} {order.email}
          </p>
          <div className="mt-6 border-t border-white/10 pt-6 text-left">
            <p className="text-xs uppercase tracking-wider text-white/45">{isUa ? 'Склад замовлення' : 'Order summary'}</p>
            <ul className="mt-2 space-y-1 text-sm text-white/80">
              {order.items.map((i, idx) => (
                <li key={idx}>
                  {i.title} × {i.quantity} — {order.currency} {i.total.toFixed(0)}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 text-sm text-white/70">
              <p>{isUa ? 'Товари' : 'Subtotal'}: {order.currency} {order.subtotal.toFixed(0)}</p>
              <p>{isUa ? 'Доставка' : 'Shipping'}: {order.currency} {order.shippingCost.toFixed(0)}</p>
              <p>{isUa ? 'Податок' : 'Tax'}: {order.currency} {order.taxAmount.toFixed(0)}</p>
            </div>
            <p className="mt-4 font-medium text-white">
              {isUa ? 'Разом' : 'Total'}: {order.currency} {order.total.toFixed(0)}
            </p>
          </div>
          <Link
            href={`/${locale}/shop/urban/collections`}
            className="mt-8 inline-block rounded-full border border-white/20 bg-white px-6 py-2 text-sm text-black transition hover:bg-white/90"
          >
            {isUa ? 'Продовжити в колекціях' : 'Continue with collections'}
          </Link>
        </div>
      </div>
    </main>
  );
}
