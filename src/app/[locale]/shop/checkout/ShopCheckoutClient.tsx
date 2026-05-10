"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { SupportedLocale } from "@/lib/seo";
import { trackBeginCheckout } from "@/lib/analytics";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { SHOP_COUNTRIES } from "@/lib/shopCountries";
import { ShoppingBag, Loader2 } from "lucide-react";

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
  pricingAudience: "b2c" | "b2b";
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  shippingZone: { id: string; name: string } | null;
  taxRegion: { id: string; name: string; rate?: number } | null;
  regionalPricingRule: {
    id: string;
    name: string;
    value?: number;
    mode?: "percent" | "fixed";
    currency?: string;
  } | null;
  showTaxesIncludedNotice: boolean;
  /** True when at least one brand in the cart is `manual_quote`. Backend-driven flag. */
  requiresQuote?: boolean;
  brandsRequiringQuote?: string[];
};

type PaymentOptions = {
  methods: Array<"FOP" | "WHITEBIT" | "WHITEPAY_FIAT">;
  fopDetails: {
    companyName: string | null;
    iban: string | null;
    bankName: string | null;
    edrpou: string | null;
    details: string | null;
  } | null;
};

function getPrice(price: { eur: number; usd: number; uah: number }, currency: ShopCurrencyCode) {
  if (currency === "USD") return price.usd;
  if (currency === "EUR") return price.eur;
  return price.uah;
}

export default function ShopCheckoutClient({ locale }: { locale: SupportedLocale }) {
  const router = useRouter();
  const isUa = locale === "ua";
  const [cart, setCart] = useState<{ items: CartItem[] } | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postcode: "",
    country: isUa ? "Ukraine" : "Ukraine",
    currency: isUa ? "UAH" : "EUR",
    paymentMethod: "FOP" as "FOP" | "WHITEBIT" | "WHITEPAY_FIAT",
  });
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);

  const checkoutTrackedRef = useRef(false);
  const quoteRequestRef = useRef(0);
  useEffect(() => {
    Promise.all([
      fetch("/api/shop/cart").then((r) => r.json()),
      fetch("/api/shop/account")
        .then(async (response) => {
          if (response.status === 401) return null;
          const data = await response.json().catch(() => null);
          return response.ok ? (data as AccountProfile) : null;
        })
        .catch(() => null),
      fetch("/api/shop/checkout/payment-options")
        .then((r) => r.json())
        .catch(() => ({ methods: ["FOP"], fopDetails: null })),
    ])
      .then(([cartData, accountData, paymentOpts]) => {
        setCart(cartData);
        setPaymentOptions(paymentOpts as PaymentOptions);
        setIsAuthenticated(Boolean(accountData));
        if (accountData) {
          setForm((current) => ({
            ...current,
            email: accountData.email || current.email,
            firstName: accountData.firstName || current.firstName,
            lastName: accountData.lastName || current.lastName,
            phone: accountData.phone || current.phone,
            line1: accountData.defaultShippingAddress?.line1 || current.line1,
            line2: accountData.defaultShippingAddress?.line2 || current.line2,
            city: accountData.defaultShippingAddress?.city || current.city,
            region: accountData.defaultShippingAddress?.region || current.region,
            postcode: accountData.defaultShippingAddress?.postcode || current.postcode,
            country: accountData.defaultShippingAddress?.country || current.country,
          }));
        }
        if (!cartData.items?.length) setError(isUa ? "Кошик порожній" : "Cart is empty");
        else if (!checkoutTrackedRef.current) {
          checkoutTrackedRef.current = true;
          const total = (cartData.items ?? []).reduce(
            (
              s: number,
              i: { price?: { eur?: number; usd?: number; uah?: number }; quantity: number }
            ) => s + (i.price?.eur ?? 0) * (i.quantity ?? 1),
            0
          );
          trackBeginCheckout((cartData.items ?? []).length, total);
        }
      })
      .catch(() => setError(isUa ? "Помилка завантаження" : "Failed to load"))
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
    setQuoteError("");

    fetch("/api/shop/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.items.map((item) => ({
          slug: item.slug,
          quantity: item.quantity,
          variantId: item.variantId,
        })),
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
          throw new Error(data.error || "Failed to quote checkout");
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
  }, [
    accountLoaded,
    cart,
    form.city,
    form.country,
    form.currency,
    form.line1,
    form.line2,
    form.postcode,
    form.region,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: (cart?.items ?? []).map((i) => ({
            slug: i.slug,
            quantity: i.quantity,
            variantId: i.variantId,
          })),
          contact: {
            email: form.email.trim(),
            name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            phone: form.phone.trim() || undefined,
          },
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
        setError(data.error || (isUa ? "Помилка оформлення" : "Checkout failed"));
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(
        `/${locale}/shop/checkout/success?order=${encodeURIComponent(data.orderNumber)}&token=${encodeURIComponent(data.viewToken)}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-24 text-center text-foreground/75 dark:text-foreground/60">
        {isUa ? "Завантаження…" : "Loading…"}
      </main>
    );
  }

  if (!cart?.items?.length) {
    return (
      <main className="min-h-screen bg-background px-4 py-24">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-foreground/75 dark:text-foreground/60">
            {error || (isUa ? "Кошик порожній." : "Your cart is empty.")}
          </p>
          <Link href={`/${locale}/shop`} className="mt-4 inline-block text-foreground underline">
            {isUa ? "До магазину" : "Back to shop"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-background text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)]"
    >
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/${locale}/shop/cart`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/70 dark:text-foreground/55 transition hover:text-foreground"
        >
          ← {isUa ? "Кошик" : "Cart"}
        </Link>
        <header>
          <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/65 dark:text-foreground/45">
            One Company Shop
          </p>
          <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
            {isUa ? "Оформлення замовлення" : "Checkout"}
          </h1>
          <p className="mt-2 text-sm text-foreground/70 dark:text-foreground/55">
            {isUa ? "Контактні дані та адреса доставки" : "Contact details and shipping address"}
          </p>
        </header>

        {isAuthenticated === false ? (
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm text-foreground/90 dark:text-foreground/75 flex flex-wrap items-center justify-between gap-3">
            <span>{isUa ? "Уже маєте акаунт?" : "Already have an account?"}</span>
            <Link
              href={`/${locale}/shop/account/login?next=${encodeURIComponent(`/${locale}/shop/checkout`)}`}
              className="text-[11px] uppercase tracking-[0.22em] text-primary hover:text-foreground transition"
            >
              {isUa ? "Увійти →" : "Sign in →"}
            </Link>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-10 rounded-3xl border border-foreground/10 bg-card/70 dark:bg-black/40 p-8 shadow-2xl backdrop-blur-xl"
        >
          {error && (
            <p className="rounded-xl bg-red-950/30 p-4 border border-red-900/50 text-red-500 text-sm">
              {error}
            </p>
          )}

          <div>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
              {isUa ? "Контакти" : "Contact"}
            </h2>
            <div className="space-y-4">
              <input
                type="email"
                required
                placeholder={isUa ? "Email" : "Email"}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  placeholder={isUa ? "Ім’я" : "First name"}
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  placeholder={isUa ? "Прізвище" : "Last name"}
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <input
                type="tel"
                placeholder={isUa ? "Телефон" : "Phone"}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
              {isUa ? "Адреса доставки" : "Shipping address"}
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                required
                placeholder={isUa ? "Адреса (вулиця, будинок)" : "Address (street, number)"}
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                type="text"
                placeholder={isUa ? "Квартира, офіс (не обов’язково)" : "Apt, office (optional)"}
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  placeholder={isUa ? "Місто" : "City"}
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  type="text"
                  placeholder={isUa ? "Область" : "Region"}
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder={isUa ? "Індекс" : "Postcode"}
                  value={form.postcode}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <select
                  required
                  aria-label={isUa ? "Країна" : "Country"}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="" disabled>
                    {isUa ? "Оберіть країну" : "Select country"}
                  </option>
                  {SHOP_COUNTRIES.map((country) => (
                    <option key={country.value} value={country.value}>
                      {isUa ? country.ua : country.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
              {isUa ? "Валюта розрахунку" : "Billing Currency"}
            </label>
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="mt-2 w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground backdrop-blur-md transition-all hover:bg-card/85 dark:hover:bg-black/60 focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="UAH">UAH (₴)</option>
            </select>
          </div>

          <div>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
              {isUa ? "Спосіб оплати" : "Payment method"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex cursor-pointer flex-col justify-center gap-1 rounded-2xl border border-foreground/10 bg-card/40 dark:bg-black/30 p-5 transition-all hover:bg-foreground/5 hover:border-foreground/20 has-checked:border-primary/50 has-checked:bg-primary/5 has-checked:shadow-[0_0_20px_rgba(213,0,28,0.15)] dark:has-checked:shadow-[0_0_20px_rgba(194,157,89,0.15)] relative overflow-hidden group">
                <div className="flex items-center gap-4 relative z-10">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="FOP"
                    checked={form.paymentMethod === "FOP"}
                    onChange={() => setForm((f) => ({ ...f, paymentMethod: "FOP" }))}
                    className="h-4 w-4 border-foreground/30 bg-foreground/5 text-primary focus:ring-primary/50 accent-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {isUa ? "Оплата на ФОП" : "Bank Transfer"}
                    </span>
                    <span className="text-[11px] text-foreground/60 dark:text-foreground/40">
                      {isUa ? "За реквізитами (IBAN)" : "Direct invoice payment"}
                    </span>
                  </div>
                </div>
              </label>
              {paymentOptions?.methods.includes("WHITEBIT") && (
                <label className="flex cursor-pointer flex-col justify-center gap-1 rounded-2xl border border-foreground/10 bg-card/40 dark:bg-black/30 p-5 transition-all hover:bg-foreground/5 hover:border-foreground/20 has-checked:border-primary/50 has-checked:bg-primary/5 has-checked:shadow-[0_0_20px_rgba(213,0,28,0.15)] dark:has-checked:shadow-[0_0_20px_rgba(194,157,89,0.15)] relative overflow-hidden group">
                  <div className="flex items-center gap-4 relative z-10">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="WHITEBIT"
                      checked={form.paymentMethod === "WHITEBIT"}
                      onChange={() => setForm((f) => ({ ...f, paymentMethod: "WHITEBIT" }))}
                      className="h-4 w-4 border-foreground/30 bg-foreground/5 text-primary focus:ring-primary/50 accent-primary"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        WhiteBIT Crypto
                      </span>
                      <span className="text-[11px] text-foreground/60 dark:text-foreground/40">
                        {isUa ? "USDT, BTC, ETH" : "Crypto checkout"}
                      </span>
                    </div>
                  </div>
                </label>
              )}
            </div>

            <p className="mt-4 text-[11px] text-foreground/55 dark:text-foreground/30 leading-relaxed max-w-lg">
              {isUa
                ? "Вибір способу оплати формує тип інвойсу в кінці. Зверніть увагу: замовлення не буде відправлено без підтвердження оплати або зв'язку з менеджером (Payment Security)."
                : "Payment choice determines the final invoice type. No items are shipped without payment clearance (Payment Security)."}
            </p>
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-card/70 dark:bg-black/40 p-6 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                  {isUa ? "Підсумок замовлення" : "Order summary"}
                </h2>
                <p className="mt-2 text-[11px] text-foreground/60 dark:text-foreground/40">
                  {quote?.shippingZone
                    ? `${isUa ? "Доставка" : "Shipping"}: ${quote.shippingZone.name}`
                    : isUa
                      ? "Розрахунок за поточними правилами"
                      : "Calculated from current shop rules"}
                </p>
              </div>
              {quoteLoading ? (
                <span className="text-[11px] uppercase tracking-wider text-foreground/65 dark:text-foreground/45">
                  {isUa ? "Оновлення…" : "Updating…"}
                </span>
              ) : null}
            </div>

            <ul className="mt-6 space-y-3 text-sm text-foreground dark:text-foreground/80">
              {(cart.items ?? []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 font-light">
                  <span className="truncate">
                    {(isUa ? item.title?.ua : item.title?.en) || item.title?.en || item.slug} ×{" "}
                    {item.quantity}
                    {item.variantTitle ? (
                      <span className="block text-[11px] text-primary/70 uppercase tracking-widest mt-1">
                        {item.variantTitle}
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                  <span className="text-foreground/70 dark:text-foreground/55 tabular-nums">
                    {item.price
                      ? formatShopMoney(
                          locale,
                          getPrice(
                            item.price,
                            (quote?.currency || form.currency) as ShopCurrencyCode
                          ) * item.quantity,
                          (quote?.currency || form.currency) as ShopCurrencyCode
                        )
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>

            {quoteError ? <p className="mt-4 text-sm text-red-400">{quoteError}</p> : null}

            <div className="mt-6 space-y-3 border-t border-foreground/10 pt-6 text-[13px] text-foreground/85 dark:text-foreground/70">
              <div className="flex items-center justify-between font-light">
                <span>{isUa ? "Підсумок товарів" : "Subtotal"}</span>
                <span className="tabular-nums">
                  {formatShopMoney(
                    locale,
                    quote?.subtotal ?? 0,
                    (quote?.currency || form.currency) as ShopCurrencyCode
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between font-light">
                <span>{isUa ? "Регіональна корекція" : "Regional adjustment"}</span>
                <span className="tabular-nums">
                  {formatShopMoney(
                    locale,
                    quote?.regionalAdjustmentAmount ?? 0,
                    (quote?.currency || form.currency) as ShopCurrencyCode
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between font-light">
                <span>{isUa ? "Доставка" : "Shipping"}</span>
                <span className="tabular-nums">
                  {quote?.shippingCost === 0
                    ? isUa
                      ? "За тарифами перевізника"
                      : "Calculated by carrier"
                    : formatShopMoney(
                        locale,
                        quote?.shippingCost ?? 0,
                        (quote?.currency || form.currency) as ShopCurrencyCode
                      )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-foreground/10 pt-4 text-lg font-light text-foreground">
                <span className="text-[#c29d59] uppercase tracking-widest text-[11px] font-medium">
                  {isUa ? "Разом" : "Total"}
                </span>
                <span className="tabular-nums">
                  {formatShopMoney(
                    locale,
                    quote?.total ?? 0,
                    (quote?.currency || form.currency) as ShopCurrencyCode
                  )}
                </span>
              </div>
            </div>

            <p className="mt-4 text-[11px] uppercase tracking-wider text-primary/60 dark:text-primary/50">
              {quote?.pricingAudience === "b2b"
                ? isUa
                  ? "Застосовано B2B ціни"
                  : "B2B pricing applied"
                : isUa
                  ? "Застосовано B2C ціни"
                  : "B2C pricing applied"}
            </p>

            {quote?.regionalPricingRule ? (
              <p className="mt-1 text-[11px] uppercase tracking-wider text-primary/60 dark:text-primary/50">
                {isUa ? "Корекція" : "Adjustment"}: {quote.regionalPricingRule.name}
              </p>
            ) : null}

            {form.email || form.firstName || form.line1 ? (
              <div className="mt-6 border-t border-foreground/10 pt-5 space-y-1.5 text-[12px] text-foreground/70 dark:text-foreground/55">
                <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/55 dark:text-foreground/35 mb-2">
                  {isUa ? "Замовлення оформлюється на" : "Order will be sent to"}
                </p>
                {form.firstName || form.lastName ? (
                  <p className="text-foreground dark:text-foreground/80">
                    {`${form.firstName} ${form.lastName}`.trim()}
                  </p>
                ) : null}
                {form.email ? <p>{form.email}</p> : null}
                {form.phone ? <p>{form.phone}</p> : null}
                {form.line1 ? (
                  <p>
                    {form.line1}
                    {form.line2 ? `, ${form.line2}` : ""}
                    {form.city ? `, ${form.city}` : ""}
                    {form.country ? `, ${form.country}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {quote?.requiresQuote ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-amber-100">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-300">
                {isUa ? "Потрібен ручний прорахунок" : "Manual quote required"}
              </div>
              <p className="mt-2 text-[13px] leading-5 text-amber-100/85">
                {isUa
                  ? `У кошику є товари брендів${quote.brandsRequiringQuote?.length ? ` (${quote.brandsRequiringQuote.join(", ")})` : ""}, для яких доставка прораховується вручну. Менеджер зв'яжеться з вами для уточнення вартості.`
                  : `Your cart contains items from brands${quote.brandsRequiringQuote?.length ? ` (${quote.brandsRequiringQuote.join(", ")})` : ""} that require manual quoting. A manager will reach out to confirm shipping.`}
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || quote?.requiresQuote === true}
            className="w-full rounded-full border border-primary bg-primary py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_18px_40px_-18px_rgba(213,0,28,0.45)] dark:hover:shadow-[0_18px_40px_-18px_rgba(194,157,89,0.65)] disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              quote?.requiresQuote
                ? isUa
                  ? "Спочатку залиш заявку нижче"
                  : "Submit a quote request first"
                : undefined
            }
          >
            {submitting
              ? isUa
                ? "Відправка…"
                : "Submitting…"
              : quote?.requiresQuote
                ? isUa
                  ? "Запит на прорахунок (скоро)"
                  : "Quote request (coming soon)"
                : isUa
                  ? "Підтвердити замовлення"
                  : "Place order"}
          </button>
        </form>
      </div>
    </main>
  );
}
