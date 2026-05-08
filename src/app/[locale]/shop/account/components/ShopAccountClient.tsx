'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { formatShopMoney, type ShopCurrencyCode } from '@/lib/shopMoneyFormat';
import { formatShopOrderStatus, shopOrderStatusBadgeClass } from '@/lib/shopOrderPresentation';
import {
  airtableOrderStatusBadgeClass,
  classifyCrmBalance,
  formatAirtableOrderStatus,
  normalizeAirtableOrderStatus,
} from '@/lib/airtableCrmStatus';

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

export default function ShopAccountClient({ locale, profile: initialProfile }: Props) {
  const isUa = locale === 'ua';
  const [profile, setProfile] = useState(initialProfile);
  const [submittingB2B, setSubmittingB2B] = useState(false);
  const [b2bMessage, setB2BMessage] = useState('');
  const [profileGroup, setProfileGroup] = useState<Props['profile']['group']>(initialProfile.group);

  // Profile edit modal state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: initialProfile.firstName,
    lastName: initialProfile.lastName,
    phone: initialProfile.phone ?? '',
    companyName: initialProfile.companyName ?? '',
    vatNumber: initialProfile.vatNumber ?? '',
    preferredLocale: initialProfile.preferredLocale,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  function openProfileEditor() {
    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? '',
      companyName: profile.companyName ?? '',
      vatNumber: profile.vatNumber ?? '',
      preferredLocale: profile.preferredLocale,
    });
    setProfileError('');
    setEditingProfile(true);
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError('');
    try {
      const response = await fetch('/api/shop/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileError(
          (data as { error?: string }).error ||
            (isUa ? 'Не вдалося зберегти профіль' : 'Failed to save profile'),
        );
        return;
      }
      const updated = data as Props['profile'];
      setProfile(updated);
      setProfileGroup(updated.group);
      setEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  }

  // CRM orders from Airtable
  type CrmOrder = { id: string; number: number; name: string; orderStatus: string; paymentStatus: string; totalAmount: number; clientTotal: number; tag: string; orderDate: string | null; itemCount: number; items: Array<{ productName: string; brand: string; quantity: number; price: number; total: number }> };
  const [crmOrders, setCrmOrders] = useState<CrmOrder[]>([]);
  const [crmBalance, setCrmBalance] = useState<number>(0);
  const [crmLoading, setCrmLoading] = useState(true);
  const [expandedCrmOrder, setExpandedCrmOrder] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shop/account/crm-orders')
      .then(r => r.json())
      .then(d => {
        setCrmOrders(d.data || []);
        setCrmBalance(d.balance || 0);
      })
      .catch(() => {})
      .finally(() => setCrmLoading(false));
  }, []);

  const balanceWho = classifyCrmBalance(crmBalance);
  const balanceLabel =
    balanceWho === 'balanced'
      ? (isUa ? 'Розрахунки збігаються' : 'Balanced')
      : balanceWho === 'client_owes'
        ? (isUa ? 'Клієнт винен' : 'Customer owes')
        : (isUa ? 'Ми винні' : 'We owe');
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
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl truncate">
              {profile.fullName}
            </h1>
            <p className="mt-2 text-sm text-white/55 truncate">{profile.email}</p>
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
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-white">{isUa ? 'Профіль' : 'Profile'}</h2>
                <button
                  type="button"
                  onClick={openProfileEditor}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-white/75 transition hover:border-white/30 hover:text-white"
                >
                  {isUa ? 'Редагувати' : 'Edit'}
                </button>
              </div>
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
              <h2 className="text-lg font-medium text-white">{isUa ? 'Баланс (Airtable)' : 'Balance (Airtable)'}</h2>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-5 mb-8">
                {crmLoading ? (
                  <div className="text-xs text-white/40 uppercase tracking-widest">{isUa ? 'Завантаження…' : 'Loading…'}</div>
                ) : (
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-1">
                        {isUa ? 'Поточний стан балансу' : 'Current balance state'}
                      </p>
                      <p className={`text-2xl font-light ${balanceWho === 'client_owes' ? 'text-red-400' : balanceWho === 'we_owe' ? 'text-emerald-400' : 'text-white/70'}`}>
                        {crmBalance === 0 ? '$0' : crmBalance > 0 ? `+$${crmBalance.toLocaleString()}` : `-$${Math.abs(crmBalance).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border ${
                          balanceWho === 'client_owes'
                            ? 'border-red-500/20 text-red-400 bg-red-500/5'
                            : balanceWho === 'we_owe'
                              ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                              : 'border-white/15 text-white/55 bg-white/5'
                        }`}
                      >
                        {balanceLabel}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-white">{isUa ? 'Адреса доставки' : 'Shipping address'}</h2>
                <Link
                  href={`/${locale}/shop/account/addresses`}
                  className="text-xs uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
                >
                  {isUa ? 'Усі адреси →' : 'All addresses →'}
                </Link>
              </div>
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
                <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-black/25 p-4 text-sm text-white/55">
                  <p>
                    {isUa
                      ? 'Поки що немає збереженої адреси.'
                      : 'No saved shipping address yet.'}
                  </p>
                  <Link
                    href={`/${locale}/shop/account/addresses`}
                    className="mt-2 inline-block text-xs uppercase tracking-[0.18em] text-[#c29d59] hover:text-white transition"
                  >
                    {isUa ? 'Додати адресу →' : 'Add address →'}
                  </Link>
                </div>
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

            {/* CRM Orders Section */}
            {crmLoading ? (
              <div className="mt-6 text-xs text-white/30 uppercase tracking-widest">
                {isUa ? 'Завантажую CRM замовлення…' : 'Loading CRM orders…'}
              </div>
            ) : crmOrders.length > 0 ? (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                  <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
                    {isUa ? 'CRM Замовлення (Airtable)' : 'CRM Orders (Airtable)'}
                  </h3>
                  <span className="text-[9px] text-white/20">{crmOrders.length}</span>
                </div>
                <ul className="space-y-2">
                  {crmOrders.map(o => {
                    const statusKind = normalizeAirtableOrderStatus(o.orderStatus);
                    const statusLabel = formatAirtableOrderStatus(statusKind, locale, o.orderStatus);
                    const statusBadgeClass = airtableOrderStatusBadgeClass(statusKind);
                    return (
                    <li key={o.id} className="rounded-2xl border border-indigo-500/10 bg-indigo-500/[0.03] p-4 cursor-pointer transition hover:bg-indigo-500/[0.06]" onClick={() => setExpandedCrmOrder(expandedCrmOrder === o.id ? null : o.id)}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white">#{o.number}</span>
                            <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusBadgeClass}`}>{statusLabel}</span>
                          </div>
                          <p className="mt-1 text-xs text-white/40 truncate">{o.name}</p>
                          {o.orderDate && <p className="text-[10px] text-white/20 mt-1">{new Date(o.orderDate).toLocaleDateString('uk-UA')}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium text-white">${o.clientTotal.toLocaleString()}</div>
                          <div className="text-[10px] text-white/30">{o.itemCount} {isUa ? 'позицій' : 'items'}</div>
                          <div className="text-[9px] text-indigo-400/50 mt-1">{expandedCrmOrder === o.id ? '▲' : '▼'}</div>
                        </div>
                      </div>
                      {expandedCrmOrder === o.id && o.items && o.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-indigo-500/10 space-y-2">
                          {o.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0 flex-1">
                                <span className="text-white/70">{item.productName}</span>
                                {item.brand && <span className="text-white/30 ml-1">({item.brand})</span>}
                              </div>
                              <div className="text-white/40 shrink-0">{item.quantity} × ${item.price.toLocaleString()}</div>
                              <div className="text-white/70 font-medium shrink-0 w-20 text-right">${item.total.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {editingProfile ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => !savingProfile && setEditingProfile(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0a0a0a] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
          >
            <h3 className="text-xl font-light tracking-tight">
              {isUa ? 'Редагувати профіль' : 'Edit profile'}
            </h3>
            <p className="mt-1 text-xs text-white/45">
              {isUa
                ? 'Email не редагується — для зміни email зверніться у підтримку.'
                : 'Email cannot be edited here — contact support to change it.'}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ProfileField
                label={isUa ? 'Імʼя' : 'First name'}
                value={profileForm.firstName}
                onChange={(v) => setProfileForm((f) => ({ ...f, firstName: v }))}
                required
              />
              <ProfileField
                label={isUa ? 'Прізвище' : 'Last name'}
                value={profileForm.lastName}
                onChange={(v) => setProfileForm((f) => ({ ...f, lastName: v }))}
                required
              />
              <ProfileField
                label={isUa ? 'Телефон' : 'Phone'}
                value={profileForm.phone}
                onChange={(v) => setProfileForm((f) => ({ ...f, phone: v }))}
              />
              <ProfileField
                label={isUa ? 'Компанія' : 'Company'}
                value={profileForm.companyName}
                onChange={(v) => setProfileForm((f) => ({ ...f, companyName: v }))}
              />
              <ProfileField
                label="VAT"
                value={profileForm.vatNumber}
                onChange={(v) => setProfileForm((f) => ({ ...f, vatNumber: v }))}
              />
              <label className="block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {isUa ? 'Бажана мова' : 'Preferred language'}
                </span>
                <select
                  value={profileForm.preferredLocale}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, preferredLocale: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white backdrop-blur-md transition-all focus:border-[#c29d59]/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[#c29d59]/50"
                >
                  <option value="ua">UA · Українська</option>
                  <option value="en">EN · English</option>
                </select>
              </label>
            </div>

            {profileError ? (
              <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {profileError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => setEditingProfile(false)}
                className="rounded-full border border-white/15 px-5 py-2 text-xs uppercase tracking-[0.18em] text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
              >
                {isUa ? 'Скасувати' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void saveProfile()}
                className="rounded-full border border-white bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {savingProfile
                  ? isUa
                    ? 'Збереження…'
                    : 'Saving…'
                  : isUa
                    ? 'Зберегти'
                    : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/45">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 backdrop-blur-md transition-all focus:border-[#c29d59]/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[#c29d59]/50"
      />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 overflow-hidden">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="mt-2 text-sm text-white/80 truncate" title={value}>{value}</div>
    </div>
  );
}
