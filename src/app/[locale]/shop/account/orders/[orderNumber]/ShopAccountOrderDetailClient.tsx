'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { formatShopMoney, type ShopCurrencyCode } from '@/lib/shopMoneyFormat';
import { formatShopOrderStatus, shopOrderStatusBadgeClass } from '@/lib/shopOrderPresentation';

type OrderData = {
  orderNumber: string;
  status: string;
  paymentMethod?: string;
  email: string;
  customerName: string;
  phone: string | null;
  shippingAddress: Record<string, unknown>;
  currency: string;
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  showTaxesIncludedNotice: boolean;
  createdAt: string;
  items: Array<{ productSlug: string; title: string; quantity: number; price: number; total: number; image: string | null }>;
  shipments?: Array<{
    id: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: string;
    shippedAt: string | null;
    deliveredAt: string | null;
  }>;
};

type Props = { locale: SupportedLocale; orderNumber: string };

export default function ShopAccountOrderDetailClient({ locale, orderNumber }: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isUa = locale === 'ua';

  useEffect(() => {
    fetch(`/api/shop/orders/${encodeURIComponent(orderNumber)}`, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(setOrder)
      .catch(() => setError(isUa ? 'Замовлення не знайдено або немає доступу.' : 'Order not found or access denied.'))
      .finally(() => setLoading(false));
  }, [orderNumber, isUa]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] px-4 py-24 text-center text-white/60">
        {isUa ? 'Завантаження…' : 'Loading…'}
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] px-4 py-24">
        <div className="mx-auto max-w-lg text-center text-white">
          <p className="text-white/60">{error}</p>
          <Link href={`/${locale}/shop/account`} className="mt-4 inline-block text-white underline">
            {isUa ? '← В кабінет' : '← Back to account'}
          </Link>
        </div>
      </main>
    );
  }

  const addr = order.shippingAddress as Record<string, string>;
  const addressLines = [
    addr?.line1,
    addr?.line2,
    [addr?.city, addr?.region, addr?.postcode].filter(Boolean).join(', '),
    addr?.country,
  ].filter(Boolean);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] text-white"
    >
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/${locale}/shop/account`}
          className="mb-6 inline-block text-sm text-white/60 hover:text-white"
        >
          ← {isUa ? 'В кабінет' : 'Back to account'}
        </Link>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="h-px w-full bg-[linear-gradient(90deg,rgba(201,168,106,0.45),rgba(255,255,255,0.12),transparent)]" />
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xl font-medium text-white">{order.orderNumber}</div>
              <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${shopOrderStatusBadgeClass(order.status)}`}>
                {formatShopOrderStatus(locale, order.status)}
              </div>
              <p className="mt-3 text-sm text-white/70">
                {isUa ? 'Дата' : 'Date'}: {new Intl.DateTimeFormat(locale === 'ua' ? 'uk-UA' : 'en-GB', { dateStyle: 'medium' }).format(new Date(order.createdAt))}
              </p>
            </div>
            <div className="grid min-w-[240px] gap-3 sm:grid-cols-2">
              <DetailStat
                label={isUa ? 'Разом' : 'Total'}
                value={formatShopMoney(locale, order.total, order.currency as ShopCurrencyCode)}
              />
              <DetailStat
                label={isUa ? 'Позицій' : 'Items'}
                value={String(order.items.reduce((sum, item) => sum + item.quantity, 0))}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-wider text-white/45">{isUa ? 'Склад замовлення' : 'Order summary'}</p>
            <ul className="mt-4 space-y-3">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {i.image ? (
                      <Image src={i.image} alt={i.title} fill className="object-cover" sizes="64px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.22em] text-white/30">
                        OC
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {i.productSlug ? (
                      <Link href={`/${locale}/shop/urban/products/${i.productSlug}`} className="line-clamp-2 text-[15px] leading-6 text-white/88 transition hover:text-white">
                        {i.title}
                      </Link>
                    ) : (
                      <div className="line-clamp-2 text-[15px] leading-6 text-white/88">{i.title}</div>
                    )}
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
                      {i.quantity} × {formatShopMoney(locale, i.price, order.currency as ShopCurrencyCode)}
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium text-white">
                    {formatShopMoney(locale, i.total, order.currency as ShopCurrencyCode)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 text-sm text-white/70">
              <p>{isUa ? 'Товари' : 'Subtotal'}: {formatShopMoney(locale, order.subtotal, order.currency as ShopCurrencyCode)}</p>
              <p>{isUa ? 'Регіональна корекція' : 'Regional adjustment'}: {formatShopMoney(locale, order.regionalAdjustmentAmount, order.currency as ShopCurrencyCode)}</p>
              <p>{isUa ? 'Доставка' : 'Shipping'}: {formatShopMoney(locale, order.shippingCost, order.currency as ShopCurrencyCode)}</p>
              <p>{isUa ? 'Податок' : 'Tax'}: {order.taxAmount <= 0 && order.showTaxesIncludedNotice ? (isUa ? 'Податки включено' : 'Taxes included') : formatShopMoney(locale, order.taxAmount, order.currency as ShopCurrencyCode)}</p>
            </div>
            <p className="mt-4 font-medium text-white">
              {isUa ? 'Разом' : 'Total'}: {formatShopMoney(locale, order.total, order.currency as ShopCurrencyCode)}
            </p>
          </div>

          {addressLines.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-wider text-white/45">{isUa ? 'Адреса доставки' : 'Shipping address'}</p>
              <p className="mt-2 text-sm text-white/80">{addressLines.join(', ')}</p>
            </div>
          )}

          {order.shipments && order.shipments.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-wider text-white/45">{isUa ? 'Відправлення' : 'Shipments'}</p>
              <ul className="mt-2 space-y-2 text-sm text-white/80">
                {order.shipments.map((s) => (
                  <li key={s.id}>
                    {s.carrier && <span>{s.carrier}</span>}
                    {s.trackingNumber && <span> — {s.trackingNumber}</span>}
                    {s.trackingUrl ? (
                      <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="ml-2 text-white/70 underline hover:text-white">
                        {isUa ? 'Відстежити' : 'Track'}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`/${locale}/shop/account`}
            className="mt-8 inline-block rounded-full border border-white/20 bg-white px-6 py-2 text-sm text-black transition hover:bg-white/90"
          >
            {isUa ? 'Повернутися в кабінет' : 'Back to account'}
          </Link>
        </div>
      </div>
    </main>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}
