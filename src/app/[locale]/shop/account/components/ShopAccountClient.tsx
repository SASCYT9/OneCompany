'use client';

import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { formatShopMoney, type ShopCurrencyCode } from '@/lib/shopMoneyFormat';
import { formatShopOrderStatus, shopOrderStatusBadgeClass } from '@/lib/shopOrderPresentation';

type Props = {
  locale: SupportedLocale;
  profile: {
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    companyName: string | null;
    vatNumber: string | null;
    group: 'B2C' | 'B2B_PENDING' | 'B2B_APPROVED';
    b2bDiscountPercent: number | null;
    preferredLocale: string;
    defaultShippingAddress: {
      label: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      postcode: string | null;
      country: string;
    } | null;
    orders: Array<{
      orderNumber: string;
      status: string;
      currency: string;
      total: number;
      createdAt: string;
      itemCount: number;
      previewItem: {
        title: string;
        image: string | null;
      } | null;
    }>;
  };
};

function groupLabel(locale: SupportedLocale, group: Props['profile']['group']) {
  if (locale === 'ua') {
    if (group === 'B2B_APPROVED') return 'B2B схвалено';
    if (group === 'B2B_PENDING') return 'B2B на розгляді';
    return 'B2C';
  }
  if (group === 'B2B_APPROVED') return 'B2B approved';
  if (group === 'B2B_PENDING') return 'B2B pending';
  return 'B2C';
}

export default function ShopAccountClient({ locale, profile }: Props) {
  const isUa = locale === 'ua';
  const [submittingB2B, setSubmittingB2B] = useState(false);
  const [b2bMessage, setB2BMessage] = useState('');
  const [profileGroup, setProfileGroup] = useState<Props['profile']['group']>(profile.group);
  const signOutCallbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/shop/account/login`
      : `/${locale}/shop/account/login`;

  async function handleApplyB2B() {
    setSubmittingB2B(true);
    setB2BMessage('');
    try {
      const response = await fetch('/api/shop/account/apply-b2b', {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setB2BMessage(data.error || (isUa ? 'Не вдалося надіслати заявку' : 'Failed to submit request'));
        return;
      }
      if (data.group === 'B2B_PENDING' || data.group === 'B2B_APPROVED') {
        setProfileGroup(data.group);
      }
      setB2BMessage(isUa ? 'B2B заявку надіслано. Менеджер перевірить акаунт.' : 'B2B request submitted. Our team will review your account.');
    } finally {
      setSubmittingB2B(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
              {isUa ? 'Акаунт клієнта' : 'Customer account'}
            </p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
              {profile.fullName}
            </h1>
            <p className="mt-2 text-sm text-white/55">{profile.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
              {groupLabel(locale, profileGroup)}
            </span>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: signOutCallbackUrl })}
              className="rounded-full border border-white/15 bg-white px-5 py-2 text-xs uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
            >
              {isUa ? 'Вийти' : 'Sign out'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div>
              <h2 className="text-lg font-medium text-white">{isUa ? 'Профіль' : 'Profile'}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoCard label="Email" value={profile.email} />
                <InfoCard label={isUa ? 'Телефон' : 'Phone'} value={profile.phone || '—'} />
                <InfoCard label={isUa ? 'Компанія' : 'Company'} value={profile.companyName || '—'} />
                <InfoCard label="VAT" value={profile.vatNumber || '—'} />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium text-white">{isUa ? 'B2B статус' : 'B2B status'}</h2>
              <p className="mt-2 text-sm text-white/55">
                {profileGroup === 'B2B_APPROVED'
                  ? (isUa ? 'Для цього акаунта вже активовано B2B доступ.' : 'This account already has B2B access.')
                  : profileGroup === 'B2B_PENDING'
                    ? (isUa ? 'Заявка на B2B уже на розгляді.' : 'Your B2B request is currently under review.')
                    : (isUa ? 'Подайте заявку, щоб отримати схвалений B2B доступ і B2B pricing.' : 'Apply to unlock approved B2B access and B2B pricing.')}
              </p>
              {profileGroup === 'B2B_APPROVED' && profile.b2bDiscountPercent != null ? (
                <p className="mt-3 text-sm text-white/65">
                  {isUa
                    ? `Персональна B2B знижка: ${profile.b2bDiscountPercent}%`
                    : `Personal B2B discount: ${profile.b2bDiscountPercent}%`}
                </p>
              ) : null}
              {profileGroup === 'B2C' ? (
                <button
                  type="button"
                  onClick={() => void handleApplyB2B()}
                  disabled={submittingB2B}
                  className="mt-4 rounded-full border border-white/20 bg-white px-5 py-2 text-xs uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {submittingB2B ? (isUa ? 'Надсилання…' : 'Submitting…') : (isUa ? 'Подати B2B заявку' : 'Apply for B2B')}
                </button>
              ) : null}
              {b2bMessage ? <p className="mt-3 text-sm text-white/65">{b2bMessage}</p> : null}
            </div>

            <div>
              <h2 className="text-lg font-medium text-white">{isUa ? 'Адреса доставки' : 'Shipping address'}</h2>
              {profile.defaultShippingAddress ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/75">
                  <p>{profile.defaultShippingAddress.label}</p>
                  <p className="mt-2">{profile.defaultShippingAddress.line1}</p>
                  {profile.defaultShippingAddress.line2 ? <p>{profile.defaultShippingAddress.line2}</p> : null}
                  <p>
                    {profile.defaultShippingAddress.city}
                    {profile.defaultShippingAddress.region ? `, ${profile.defaultShippingAddress.region}` : ''}
                    {profile.defaultShippingAddress.postcode ? ` ${profile.defaultShippingAddress.postcode}` : ''}
                  </p>
                  <p>{profile.defaultShippingAddress.country}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/55">
                  {isUa ? 'Поки що немає збереженої адреси. Вона збережеться після оформлення замовлення.' : 'No saved shipping address yet. It will be stored after your first checkout.'}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-white">{isUa ? 'Замовлення' : 'Orders'}</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/35">
                  {isUa ? 'Історія покупок Urban Automotive' : 'Urban Automotive purchase history'}
                </p>
              </div>
              <Link href={`/${locale}/shop/urban/collections`} className="text-sm text-white/55 hover:text-white">
                {isUa ? 'До покупок' : 'Continue shopping'}
              </Link>
            </div>
            {profile.orders.length ? (
              <ul className="mt-4 space-y-3">
                {profile.orders.map((order) => (
                  <li
                    key={order.orderNumber}
                    className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)] transition hover:-translate-y-[1px] hover:border-white/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]"
                  >
                    <Link
                      href={`/${locale}/shop/account/orders/${order.orderNumber}`}
                      className="block"
                    >
                      <div className="mb-4 h-px w-full bg-[linear-gradient(90deg,rgba(201,168,106,0.35),rgba(255,255,255,0.08),transparent)]" />
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                            {order.previewItem?.image ? (
                              <Image
                                src={order.previewItem.image}
                                alt={order.previewItem.title}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.22em] text-white/30">
                                OC
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-mono text-sm text-white hover:text-white/90">{order.orderNumber}</div>
                              <span className="text-[10px] uppercase tracking-[0.22em] text-white/25">•</span>
                              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                {new Intl.DateTimeFormat(locale === 'ua' ? 'uk-UA' : 'en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                }).format(new Date(order.createdAt))}
                              </div>
                            </div>
                            <div className="mt-3 line-clamp-2 text-[15px] leading-6 text-white/88">
                              {order.previewItem?.title || (isUa ? 'Замовлення без прев’ю товару' : 'Order without preview item')}
                            </div>
                            {order.itemCount > 1 ? (
                              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
                                {isUa ? `Ще ${order.itemCount - 1} позицій` : `${order.itemCount - 1} more items`}
                              </div>
                            ) : null}
                            <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${shopOrderStatusBadgeClass(order.status)}`}>
                              {formatShopOrderStatus(locale, order.status)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm text-white/70">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                            {isUa ? 'Разом' : 'Total'}
                          </div>
                          <div className="mt-2 text-base font-medium text-white">
                            {formatShopMoney(locale, order.total, order.currency as ShopCurrencyCode)}
                          </div>
                          <div className="mt-2 text-xs text-white/45">{order.itemCount} {isUa ? 'позицій' : 'items'}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs uppercase tracking-[0.18em] text-white/42">
                        <span>{isUa ? 'Відкрити замовлення' : 'Open order'}</span>
                        <span aria-hidden>→</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-white/55">{isUa ? 'Замовлень поки немає.' : 'No orders yet.'}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="mt-2 text-sm text-white/80">{value}</div>
    </div>
  );
}
