'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { trackBeginCheckout } from '@/lib/analytics';
import { formatShopMoney, type ShopCurrencyCode } from '@/lib/shopMoneyFormat';
import { ShoppingBag, Loader2 } from 'lucide-react';

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
type AccountProfile = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  preferredLocale: string;
  defaultShippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postcode: string | null;
    country: string;
  } | null;
};
type CheckoutQuote = {
  currency: string;
  pricingAudience: 'b2c' | 'b2b';
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  shippingZone: { id: string; name: string } | null;
  taxRegion: { id: string; name: string; rate?: number } | null;
  regionalPricingRule: { id: string; name: string; value?: number; mode?: 'percent' | 'fixed'; currency?: string } | null;
  showTaxesIncludedNotice: boolean;
};

type PaymentOptions = {
  methods: Array<'FOP' | 'STRIPE' | 'WHITEBIT' | 'HUTKO'>;
  fopDetails: {
    companyName: string | null;
    iban: string | null;
    bankName: string | null;
    edrpou: string | null;
    details: string | null;
  } | null;
};

function getPrice(
  price: { eur: number; usd: number; uah: number },
  currency: ShopCurrencyCode,
) {
  if (currency === 'USD') return price.usd;
  if (currency === 'EUR') return price.eur;
  return price.uah;
}

export default function ShopCheckoutClient({ locale }: { locale: SupportedLocale }) {
  const router = useRouter();
  const isUa = locale === 'ua';
  const [cart, setCart] = useState<{ items: CartItem[] } | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postcode: '',
    country: isUa ? 'Ukraine' : '',
    currency: isUa ? 'UAH' : 'EUR',
    paymentMethod: 'FOP' as 'FOP' | 'STRIPE' | 'WHITEBIT' | 'HUTKO',
  });
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);

  const checkoutTrackedRef = useRef(false);
  const quoteRequestRef = useRef(0);
  useEffect(() => {
    Promise.all([
      fetch('/api/shop/cart').then((r) => r.json()),
      fetch('/api/shop/account')
        .then(async (response) => {
          if (response.status === 401) return null;
          const data = await response.json().catch(() => null);
          return response.ok ? (data as AccountProfile) : null;
        })
        .catch(() => null),
      fetch('/api/shop/checkout/payment-options').then((r) => r.json()).catch(() => ({ methods: ['FOP'], fopDetails: null })),
    ])
      .then(([cartData, accountData, paymentOpts]) => {
        setCart(cartData);
        setPaymentOptions(paymentOpts as PaymentOptions);
        if (accountData) {
          setForm((current) => ({
            ...current,
            email: accountData.email || current.email,
            name: [accountData.firstName, accountData.lastName].filter(Boolean).join(' ').trim() || current.name,
            phone: accountData.phone || current.phone,
            line1: accountData.defaultShippingAddress?.line1 || current.line1,
            line2: accountData.defaultShippingAddress?.line2 || current.line2,
            city: accountData.defaultShippingAddress?.city || current.city,
            region: accountData.defaultShippingAddress?.region || current.region,
            postcode: accountData.defaultShippingAddress?.postcode || current.postcode,
            country: accountData.defaultShippingAddress?.country || current.country,
          }));
        }
        if (!cartData.items?.length) setError(isUa ? 'Кошик порожній' : 'Cart is empty');
        else if (!checkoutTrackedRef.current) {
          checkoutTrackedRef.current = true;
          const total = (cartData.items ?? []).reduce(
            (s: number, i: { price?: { eur?: number; usd?: number; uah?: number }; quantity: number }) =>
              s + (i.price?.eur ?? 0) * (i.quantity ?? 1),
            0
          );
          trackBeginCheckout((cartData.items ?? []).length, total);
        }
      })
      .catch(() => setError(isUa ? 'Помилка завантаження' : 'Failed to load'))
      .finally(() => {
        setLoading(false);
        setAccountLoaded(true);
      });
  }, [isUa]);

  useEffect(() => {
    if (!cart?.items?.length) {
      setQuote(null);
      return;
    }

    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;
    setQuoteLoading(true);
    setQuoteError('');

    fetch('/api/shop/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.items.map((item) => ({ slug: item.slug, quantity: item.quantity, variantId: item.variantId })),
        shipping: {
          line1: form.line1,
          line2: form.line2 || undefined,
          city: form.city,
          region: form.region || undefined,
          postcode: form.postcode || undefined,
          country: form.country,
        },
        currency: form.currency,
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Failed to quote checkout');
        }
        if (quoteRequestRef.current !== requestId) return;
        setQuote(data as CheckoutQuote);
      })
      .catch((quoteFetchError) => {
        if (quoteRequestRef.current !== requestId) return;
        setQuoteError((quoteFetchError as Error).message);
      })
      .finally(() => {
        if (quoteRequestRef.current === requestId) {
          setQuoteLoading(false);
        }
      });
  }, [accountLoaded, cart, form.city, form.country, form.currency, form.line1, form.line2, form.postcode, form.region]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: (cart?.items ?? []).map((i) => ({ slug: i.slug, quantity: i.quantity, variantId: i.variantId })),
          contact: { email: form.email.trim(), name: form.name.trim(), phone: form.phone.trim() || undefined },
          shipping: {
            line1: form.line1.trim(),
            line2: form.line2.trim() || undefined,
            city: form.city.trim(),
            region: form.region.trim() || undefined,
            postcode: form.postcode.trim() || undefined,
            country: form.country.trim(),
          },
          currency: form.currency,
          locale,
          paymentMethod: form.paymentMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (isUa ? 'Помилка оформлення' : 'Checkout failed'));
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(`/${locale}/shop/checkout/success?order=${encodeURIComponent(data.orderNumber)}&token=${encodeURIComponent(data.viewToken)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-24 text-center text-white/60">
        {isUa ? 'Завантаження…' : 'Loading…'}
      </main>
    );
  }

  if (!cart?.items?.length) {
    return (
      <main className="min-h-screen bg-black px-4 py-24">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-white/60">{error || (isUa ? 'Кошик порожній.' : 'Your cart is empty.')}</p>
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
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <Link href={`/${locale}/shop/cart`} className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
          ← {isUa ? 'Кошик' : 'Cart'}
        </Link>
        <header>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
            Urban Automotive
          </p>
          <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
            {isUa ? 'Оформлення замовлення' : 'Urban checkout'}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {isUa ? 'Контактні дані та адреса доставки' : 'Contact details and shipping address'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/55">{isUa ? 'Контакти' : 'Contact'}</h2>
            <div className="space-y-3">
              <input
                type="email"
                required
                placeholder={isUa ? 'Email' : 'Email'}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
              />
              <input
                type="text"
                required
                placeholder={isUa ? 'ПІБ' : 'Full name'}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
              />
              <input
                type="tel"
                placeholder={isUa ? 'Телефон' : 'Phone'}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/55">{isUa ? 'Адреса доставки' : 'Shipping address'}</h2>
            <div className="space-y-3">
              <input
                type="text"
                required
                placeholder={isUa ? 'Адреса (вулиця, будинок)' : 'Address (street, number)'}
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
              />
              <input
                type="text"
                placeholder={isUa ? 'Квартира, офіс (не обов’язково)' : 'Apt, office (optional)'}
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  placeholder={isUa ? 'Місто' : 'City'}
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={isUa ? 'Область' : 'Region'}
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder={isUa ? 'Індекс' : 'Postcode'}
                  value={form.postcode}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder={isUa ? 'Країна' : 'Country'}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium uppercase tracking-wider text-white/55">{isUa ? 'Валюта' : 'Currency'}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white focus:border-white/35 focus:outline-none"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="UAH">UAH</option>
            </select>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/60 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {isUa ? 'Спосіб оплати' : 'Payment method'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex cursor-pointer flex-col justify-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 transition-all hover:bg-white/5 hover:border-white/20 has-[:checked]:border-white/40 has-[:checked]:bg-white/[0.08] has-[:checked]:shadow-[0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                <div className="flex items-center gap-3 relative z-10">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="FOP"
                    checked={form.paymentMethod === 'FOP'}
                    onChange={() => setForm((f) => ({ ...f, paymentMethod: 'FOP' }))}
                    className="h-4 w-4 border-white/30 bg-black text-white focus:ring-white/50 accent-white"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                      {isUa ? 'Оплата на ФОП' : 'Bank Transfer'}
                    </span>
                    <span className="text-[11px] text-white/50">
                      {isUa ? 'За реквізитами (IBAN)' : 'Direct invoice payment'}
                    </span>
                  </div>
                </div>
              </label>
              
              {paymentOptions?.methods.includes('HUTKO') && (
                <label className="flex cursor-pointer flex-col justify-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 transition-all hover:bg-white/5 hover:border-white/20 has-[:checked]:border-white/40 has-[:checked]:bg-white/[0.08] has-[:checked]:shadow-[0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                  <div className="flex items-center gap-3 relative z-10">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="HUTKO"
                      checked={form.paymentMethod === 'HUTKO'}
                      onChange={() => setForm((f) => ({ ...f, paymentMethod: 'HUTKO' }))}
                      className="h-4 w-4 border-white/30 bg-black text-white focus:ring-white/50 accent-white"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">Apple Pay / Google Pay</span>
                      <span className="text-[11px] text-white/50">{isUa ? 'Онлайн оплата карткою' : 'Card acquiring (Hutko)'}</span>
                    </div>
                  </div>
                </label>
              )}

              {paymentOptions?.methods.includes('STRIPE') && (
                <label className="flex cursor-pointer flex-col justify-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 transition-all hover:bg-white/5 hover:border-white/20 has-[:checked]:border-white/40 has-[:checked]:bg-white/[0.08] has-[:checked]:shadow-[0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                  <div className="flex items-center gap-3 relative z-10">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="STRIPE"
                      checked={form.paymentMethod === 'STRIPE'}
                      onChange={() => setForm((f) => ({ ...f, paymentMethod: 'STRIPE' }))}
                      className="h-4 w-4 border-white/30 bg-black text-white focus:ring-white/50 accent-white"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">Stripe Checkout</span>
                      <span className="text-[11px] text-white/50">{isUa ? 'Міжнародна картка / USD EUR' : 'International Cards'}</span>
                    </div>
                  </div>
                </label>
              )}

              {paymentOptions?.methods.includes('WHITEBIT') && (
                <label className="flex cursor-pointer flex-col justify-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-4 transition-all hover:bg-white/5 hover:border-white/20 has-[:checked]:border-white/40 has-[:checked]:bg-white/[0.08] has-[:checked]:shadow-[0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                  <div className="flex items-center gap-3 relative z-10">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="WHITEBIT"
                      checked={form.paymentMethod === 'WHITEBIT'}
                      onChange={() => setForm((f) => ({ ...f, paymentMethod: 'WHITEBIT' }))}
                      className="h-4 w-4 border-white/30 bg-black text-white focus:ring-white/50 accent-white"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">WhiteBIT Crypto</span>
                      <span className="text-[11px] text-white/50">{isUa ? 'USDT, BTC, ETH' : 'Crypto checkout'}</span>
                    </div>
                  </div>
                </label>
              )}
            </div>
            
            <p className="mt-3 text-[11px] text-white/30 leading-relaxed max-w-lg">
              {isUa 
                ? 'Вибір способу оплати формує тип інвойсу в кінці. Зверніть увагу: замовлення не буде відправлено без підтвердження оплати або зв\'язку з менеджером (Payment Security).'
                : 'Payment choice determines the final invoice type. No items are shipped without payment clearance (Payment Security).'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wider text-white/55">
                  {isUa ? 'Підсумок замовлення' : 'Order summary'}
                </h2>
                <p className="mt-1 text-xs text-white/40">
                  {quote?.shippingZone
                    ? `${isUa ? 'Доставка' : 'Shipping'}: ${quote.shippingZone.name}`
                    : (isUa ? 'Розрахунок за поточними правилами' : 'Calculated from current shop rules')}
                </p>
              </div>
              {quoteLoading ? <span className="text-xs text-white/45">{isUa ? 'Оновлення…' : 'Updating…'}</span> : null}
            </div>

            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {(cart.items ?? []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4">
                  <span className="truncate">
                    {(isUa ? item.title?.ua : item.title?.en) || item.title?.en || item.slug} × {item.quantity}
                    {item.variantTitle ? ` · ${item.variantTitle}` : ''}
                  </span>
                  <span className="text-white/55">
                    {item.price
                      ? formatShopMoney(
                          locale,
                          getPrice(item.price, (quote?.currency || form.currency) as ShopCurrencyCode) * item.quantity,
                          (quote?.currency || form.currency) as ShopCurrencyCode,
                        )
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>

            {quoteError ? <p className="mt-4 text-sm text-amber-400">{quoteError}</p> : null}

            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>{isUa ? 'Підсумок товарів' : 'Subtotal'}</span>
                <span>{formatShopMoney(locale, quote?.subtotal ?? 0, (quote?.currency || form.currency) as ShopCurrencyCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isUa ? 'Регіональна корекція' : 'Regional adjustment'}</span>
                <span>{formatShopMoney(locale, quote?.regionalAdjustmentAmount ?? 0, (quote?.currency || form.currency) as ShopCurrencyCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isUa ? 'Доставка' : 'Shipping'}</span>
                <span>
                  {quote?.shippingCost === 0 
                    ? (isUa ? 'За тарифами перевізника' : 'Calculated by carrier')
                    : formatShopMoney(locale, quote?.shippingCost ?? 0, (quote?.currency || form.currency) as ShopCurrencyCode)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-medium text-white">
                <span>{isUa ? 'Разом' : 'Total'}</span>
                <span>{formatShopMoney(locale, quote?.total ?? 0, (quote?.currency || form.currency) as ShopCurrencyCode)}</span>
              </div>
            </div>

            <p className="mt-3 text-xs text-white/40">
              {quote?.pricingAudience === 'b2b' ? 'B2B pricing applied' : 'B2C pricing applied'}
            </p>

            {quote?.regionalPricingRule ? (
              <p className="mt-2 text-xs text-white/40">
                {isUa ? 'Регіональна корекція' : 'Regional adjustment'}: {quote.regionalPricingRule.name}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full border border-white/20 bg-white py-3 font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {submitting ? (isUa ? 'Відправка…' : 'Submitting…') : (isUa ? 'Підтвердити замовлення' : 'Place order')}
          </button>
        </form>
      </div>
    </main>
  );
}
