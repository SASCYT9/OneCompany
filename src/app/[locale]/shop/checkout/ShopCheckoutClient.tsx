"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronDown, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import type { SupportedLocale } from "@/lib/seo";
import { trackBeginCheckout } from "@/lib/analytics";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { ShopCountryCombobox } from "@/components/shop/ShopCountryCombobox";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import ShopCheckoutShell from "./ShopCheckoutShell";
import styles from "./ShopCheckout.module.css";

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
  shippingIncludedInPrice?: boolean;
  taxableSubtotal?: number;
  taxableShippingCost?: number;
  taxAmount: number;
  total: number;
  landedCost: {
    ruleId: string;
    ruleName: string;
    country: string;
    currency: string;
    mode: "DDP" | "DAP" | "QUOTE";
    guaranteed: boolean;
    importerOfRecord: string | null;
    customsValue: number;
    freightAmount: number;
    dutyAmount: number;
    insuranceAmount: number;
    brokerageAmount: number;
    handlingAmount: number;
    riskReserveAmount: number;
    importVatBase: number;
    importVatAmount: number;
    includedAmount: number;
    dueAtDeliveryAmount: number;
    requiresQuote: boolean;
  } | null;
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
  items?: Array<{
    productSlug: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
    pricingBaseRegion?: "default" | "europe";
  }>;
  /** True when at least one brand in the cart is `manual_quote`. Backend-driven flag. */
  requiresQuote?: boolean;
  brandsRequiringQuote?: string[];
};

type PaymentOptions = {
  methods: Array<"FOP" | "WHITEBIT" | "WHITEPAY_FIAT" | "MONOBANK">;
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

function quoteLineKey(slug: string, variantId?: string | null) {
  return `${slug}::${variantId ?? ""}`;
}

function hasMoneyAmount(value?: number | null) {
  return Math.abs(value ?? 0) >= 0.005;
}

function formatVatRate(rate?: number | null) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return "";
  const percent = Math.round(rate * 1000) / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function vatSummaryLabel(quote: CheckoutQuote | null) {
  const rate = formatVatRate(quote?.taxRegion?.rate);
  return rate ? `VAT (${rate})` : "VAT";
}

const previewItems: CartItem[] = [
  {
    id: "checkout-design-preview",
    slug: "girodisc-design-preview",
    quantity: 1,
    title: { ua: "Girodisc · Передні гальмівні диски", en: "Girodisc · Front brake rotors" },
    variantTitle: "1 комплект / 1 set",
    price: { uah: 48000, eur: 1000, usd: 1100 },
    image: "/images/shop/girodisc/line-rotors.jpg",
  },
];

const imageFormatPreviewItems: CartItem[] = [
  ["jpg", "/images/shop/girodisc/line-rotors.jpg"],
  ["jpeg", "/images/shop/products/rotobox-carbon-wheelset.jpeg"],
  ["png", "/images/hero-auto.png"],
  ["webp", "/images/hero-stock-performance-v2.webp"],
  ["avif", "/images/shop/products/sc-project-race-system-v4.avif"],
  ["svg", "/images/placeholder-product.svg"],
  ["remote 404 fallback", "https://ducatiomaha.com/media/catalog/product/9/6/96482441ba.jpg"],
  ["remote 403 fallback", "https://amsducati.com/media/catalog/product/9/6/96482291ba.jpg"],
].map(([format, image], index) => ({
  id: `checkout-image-${format}`,
  slug: `checkout-image-${format}`,
  quantity: 1,
  title: {
    ua: `${format.toUpperCase()} · тест формату`,
    en: `${format.toUpperCase()} · format test`,
  },
  variantTitle: "Локальна перевірка / Local QA",
  price: { uah: (index + 1) * 1000, eur: (index + 1) * 20, usd: (index + 1) * 25 },
  image,
  fallbackImage: "/images/placeholders/product-fallback.svg",
}));

export default function ShopCheckoutClient({
  locale,
  preview = false,
  imagePreview = false,
}: {
  locale: SupportedLocale;
  preview?: boolean;
  imagePreview?: boolean;
}) {
  const router = useRouter();
  const isUa = locale === "ua";
  const {
    country: selectedShopCountry,
    currency: selectedShopCurrency,
    setCountry: setSelectedShopCountry,
    setCurrency: setSelectedShopCurrency,
  } = useShopCurrency();
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
    country: selectedShopCountry || "Ukraine",
    currency: selectedShopCurrency || (isUa ? "UAH" : "EUR"),
    paymentMethod: "FOP" as "FOP" | "WHITEBIT" | "WHITEPAY_FIAT" | "MONOBANK",
  });
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const previewCartItems = imagePreview ? imageFormatPreviewItems : previewItems;

  useEffect(() => {
    setForm((current) => {
      const nextCountry = selectedShopCountry || current.country;
      const nextCurrency = selectedShopCurrency || current.currency;
      if (current.country === nextCountry && current.currency === nextCurrency) {
        return current;
      }
      return {
        ...current,
        country: nextCountry,
        currency: nextCurrency,
        paymentMethod:
          current.paymentMethod === "MONOBANK" && nextCurrency !== "UAH"
            ? "FOP"
            : current.paymentMethod,
      };
    });
  }, [selectedShopCountry, selectedShopCurrency]);

  const checkoutTrackedRef = useRef(false);
  const quoteRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const quoteItemsByKey = new Map(
    (quote?.items ?? []).map((item) => [quoteLineKey(item.productSlug, item.variantId), item])
  );
  const quoteCurrency = (quote?.currency || form.currency) as ShopCurrencyCode;
  const showRegionalAdjustment =
    Boolean(quote?.regionalPricingRule) || hasMoneyAmount(quote?.regionalAdjustmentAmount);
  const showVatLine =
    !quote?.landedCost &&
    (hasMoneyAmount(quote?.taxAmount) ||
      (quote?.showTaxesIncludedNotice === true && hasMoneyAmount(quote?.taxableSubtotal)));

  useEffect(() => {
    if (preview) {
      setCart({ items: previewCartItems });
      setPaymentOptions({ methods: ["FOP", "WHITEBIT", "MONOBANK"], fopDetails: null });
      setForm((current) => ({
        ...current,
        paymentMethod: current.currency === "UAH" ? "MONOBANK" : "FOP",
      }));
      setIsAuthenticated(false);
      setLoading(false);
      setAccountLoaded(true);
      return;
    }
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
            country: current.country,
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
  }, [isUa, preview, previewCartItems]);

  useEffect(() => {
    if (!cart?.items?.length) {
      setQuote(null);
      return;
    }

    if (preview) {
      const currency = form.currency as ShopCurrencyCode;
      const total = previewCartItems.reduce(
        (sum, item) => sum + getPrice(item.price!, currency) * item.quantity,
        0
      );
      setQuote({
        currency,
        pricingAudience: "b2c",
        subtotal: total,
        regionalAdjustmentAmount: 0,
        shippingCost: 0,
        taxAmount: 0,
        total,
        landedCost: null,
        itemCount: previewCartItems.length,
        shippingZone: null,
        taxRegion: null,
        regionalPricingRule: null,
        showTaxesIncludedNotice: false,
        requiresQuote: false,
        items: previewCartItems.map((item) => ({
          productSlug: item.slug,
          quantity: item.quantity,
          unitPrice: getPrice(item.price!, currency),
          total: getPrice(item.price!, currency) * item.quantity,
        })),
      });
      setQuoteLoading(false);
      setQuoteError("");
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
    preview,
    previewCartItems,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) {
      setPreviewMessage(
        isUa
          ? "Це лише перегляд дизайну. Замовлення та платіж не створено."
          : "This is a design preview. No order or payment was created."
      );
      return;
    }
    if (submittingRef.current || quoteLoading || !quote || quoteError) return;
    submittingRef.current = true;
    setError("");
    setSubmitting(true);
    try {
      const payload = {
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
        ...(form.paymentMethod === "MONOBANK"
          ? { expectedAmount: Math.round((quote.total + Number.EPSILON) * 100) }
          : {}),
      };
      let checkoutKey: string | undefined;
      if (form.paymentMethod === "MONOBANK") {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(payload))
        );
        const fingerprint = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0")
        ).join("");
        const storageKey = `onecompany-mono-checkout:${fingerprint}`;
        checkoutKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
        sessionStorage.setItem(storageKey, checkoutKey);
      }
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(checkoutKey ? { checkoutKey } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "MONOBANK_QUOTE_CHANGED"
            ? isUa
              ? "Сума змінилася. Оновіть сторінку, щоб перевірити підсумок перед оплатою."
              : "The total changed. Refresh the page to review it before paying."
            : form.paymentMethod === "MONOBANK"
              ? isUa
                ? "Не вдалося підготувати оплату. Спробуйте ще раз."
                : "Could not prepare payment. Please try again."
              : data.error || (isUa ? "Помилка оформлення" : "Checkout failed")
        );
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(
        `/${locale}/shop/checkout/success?order=${encodeURIComponent(data.orderNumber)}&token=${encodeURIComponent(data.viewToken)}`
      );
    } catch {
      setError(
        isUa ? "Не вдалося з'єднатися. Спробуйте ще раз." : "Connection failed. Please try again."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ShopCheckoutShell locale={locale} preview={preview}>
        <div className={styles.loadingState} role="status">
          {isUa ? "Завантажуємо замовлення…" : "Loading your order…"}
        </div>
      </ShopCheckoutShell>
    );
  }

  if (!cart?.items?.length) {
    return (
      <ShopCheckoutShell locale={locale} preview={preview}>
        <div className={styles.emptyState}>
          <Package size={30} aria-hidden="true" className="mx-auto" />
          <h1>{isUa ? "Ваш кошик порожній" : "Your cart is empty"}</h1>
          <p>
            {error ||
              (isUa
                ? "Додайте товари, щоб перейти до оформлення."
                : "Add an item to begin checkout.")}
          </p>
          <Link href={"/" + locale + "/shop"} className={styles.submit}>
            {isUa ? "До магазину" : "Back to shop"} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </ShopCheckoutShell>
    );
  }

  const monoAvailable = paymentOptions?.methods.includes("MONOBANK");
  const totalText = quote ? formatShopMoney(locale, quote.total, quoteCurrency) : "—";
  const paymentIsOnline = form.paymentMethod !== "FOP";
  const submitDisabled =
    submitting ||
    quoteLoading ||
    !quote ||
    Boolean(quoteError) ||
    quote.requiresQuote === true ||
    (form.paymentMethod === "MONOBANK" && quote.currency !== "UAH");
  const otherPaymentOptions = (
    <div className={styles.paymentList}>
      <label className={styles.paymentOption}>
        <div className={styles.paymentTop}>
          <input
            type="radio"
            name="paymentMethod"
            value="FOP"
            checked={form.paymentMethod === "FOP"}
            onChange={() => setForm((current) => ({ ...current, paymentMethod: "FOP" }))}
          />
          <span className={styles.paymentName}>
            {isUa ? "Переказ за реквізитами" : "Bank transfer"}
          </span>
          <span className={styles.provider}>IBAN</span>
        </div>
        {form.paymentMethod === "FOP" && (
          <p className={styles.paymentDetail}>
            {isUa
              ? "Реквізити для оплати отримаєте після оформлення."
              : "Payment details will be available after placing your order."}
          </p>
        )}
      </label>
      {paymentOptions?.methods.includes("WHITEBIT") && (
        <label className={styles.paymentOption}>
          <div className={styles.paymentTop}>
            <input
              type="radio"
              name="paymentMethod"
              value="WHITEBIT"
              checked={form.paymentMethod === "WHITEBIT"}
              onChange={() => setForm((current) => ({ ...current, paymentMethod: "WHITEBIT" }))}
            />
            <span className={styles.paymentName}>{isUa ? "Криптовалюта" : "Cryptocurrency"}</span>
            <span className={styles.provider}>Whitepay</span>
          </div>
          {form.paymentMethod === "WHITEBIT" && (
            <p className={styles.paymentDetail}>USDT, BTC, ETH</p>
          )}
        </label>
      )}
    </div>
  );

  return (
    <ShopCheckoutShell locale={locale} preview={preview}>
      <div className={styles.grid}>
        <form className={styles.formColumn} onSubmit={handleSubmit}>
          <div className={styles.heading}>
            <h1>{isUa ? "Оформлення" : "Checkout"}</h1>
          </div>

          <section className={styles.section} aria-labelledby="checkout-contact">
            <div className={styles.sectionHead}>
              <h2 id="checkout-contact">{isUa ? "Контакти" : "Contact"}</h2>
              {isAuthenticated === false && (
                <Link
                  href={
                    "/" +
                    locale +
                    "/shop/account/login?next=" +
                    encodeURIComponent("/" + locale + "/shop/checkout")
                  }
                >
                  {isUa ? "Увійти" : "Sign in"}
                </Link>
              )}
            </div>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <div className={styles.fieldPair}>
                <label className={styles.field}>
                  <span>{isUa ? "Ім’я" : "First name"}</span>
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    required
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, firstName: event.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>{isUa ? "Прізвище" : "Last name"}</span>
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, lastName: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span>{isUa ? "Номер телефону" : "Phone number"}</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+380"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="checkout-delivery">
            <div className={styles.sectionHead}>
              <h2 id="checkout-delivery">{isUa ? "Доставка" : "Delivery"}</h2>
            </div>
            <div className={styles.fields}>
              <div className={styles.fieldPair}>
                <div className={styles.country}>
                  <span className={styles.countryLabel}>{isUa ? "Країна" : "Country"}</span>
                  <ShopCountryCombobox
                    locale={locale}
                    value={form.country}
                    buttonClassName={styles.countryButton}
                    ariaLabel={isUa ? "Країна" : "Country"}
                    onChange={(country) => {
                      setForm((current) => ({ ...current, country }));
                      setSelectedShopCountry(country);
                    }}
                  />
                </div>
                <label className={styles.field}>
                  <span>{isUa ? "Місто" : "City"}</span>
                  <input
                    name="city"
                    autoComplete="address-level2"
                    required
                    value={form.city}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, city: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span>{isUa ? "Адреса або відділення" : "Address or collection point"}</span>
                <input
                  name="line1"
                  autoComplete="address-line1"
                  required
                  placeholder={
                    isUa
                      ? "Вулиця, будинок або номер відділення"
                      : "Street, building or collection point"
                  }
                  value={form.line1}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, line1: event.target.value }))
                  }
                />
              </label>
              <details className={styles.optional}>
                <summary>
                  <ChevronDown size={14} aria-hidden="true" />
                  {isUa ? "Квартира, область, індекс" : "Apartment, region, postal code"}
                </summary>
                <div className={styles.fields}>
                  <label className={styles.field}>
                    <span>{isUa ? "Квартира / офіс" : "Apartment / suite"}</span>
                    <input
                      name="line2"
                      autoComplete="address-line2"
                      value={form.line2}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, line2: event.target.value }))
                      }
                    />
                  </label>
                  <div className={styles.fieldPair}>
                    <label className={styles.field}>
                      <span>{isUa ? "Область / регіон" : "State / region"}</span>
                      <input
                        name="region"
                        autoComplete="address-level1"
                        value={form.region}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, region: event.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>{isUa ? "Поштовий індекс" : "Postal code"}</span>
                      <input
                        name="postcode"
                        autoComplete="postal-code"
                        value={form.postcode}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, postcode: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </details>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="checkout-payment">
            <div className={styles.sectionHead}>
              <h2 id="checkout-payment">{isUa ? "Оплата" : "Payment"}</h2>
              {monoAvailable && <span className={styles.provider}>plata by mono</span>}
            </div>
            {monoAvailable ? (
              <>
                <div className={styles.paymentList}>
                  <label className={styles.paymentOption}>
                    <div className={styles.paymentTop}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="MONOBANK"
                        checked={form.paymentMethod === "MONOBANK"}
                        onChange={() => {
                          setForm((current) => ({
                            ...current,
                            paymentMethod: "MONOBANK",
                            currency: "UAH",
                          }));
                          setSelectedShopCurrency("UAH");
                        }}
                      />
                      <span className={styles.paymentName}>
                        {isUa ? "Оплата карткою" : "Card payment"}
                      </span>
                      <span className={styles.cardLogos}>
                        <Image src="/images/payments/visa.svg" alt="Visa" width={30} height={20} />
                        <Image
                          src="/images/payments/mastercard.svg"
                          alt="Mastercard"
                          width={30}
                          height={20}
                        />
                      </span>
                    </div>
                    <p className={styles.paymentDetail}>
                      {isUa
                        ? "Visa та Mastercard українських і закордонних банків."
                        : "Visa and Mastercard from Ukrainian and international banks."}
                    </p>
                    <div className={styles.walletNames}>
                      <span>Apple Pay</span>
                      <span>Google Pay</span>
                    </div>
                    {form.paymentMethod === "MONOBANK" && (
                      <p className={styles.paymentDetail}>
                        {isUa
                          ? "Оплата у гривні на захищеній сторінці mono."
                          : "Pay in UAH on mono’s secure payment page."}
                      </p>
                    )}
                  </label>
                </div>
                <div className={styles.otherPayments}>
                  <p className={styles.otherPaymentsTitle}>
                    {isUa ? "Інші способи оплати" : "Other payment methods"}
                  </p>
                  {otherPaymentOptions}
                </div>
              </>
            ) : (
              otherPaymentOptions
            )}
          </section>

          {quote?.requiresQuote && (
            <div className={styles.quoteNotice} role="status">
              <strong>{isUa ? "Потрібне підтвердження вартості" : "A quote is required"}</strong>
              {isUa
                ? "Менеджер має підтвердити доставку та фінальну суму перед оплатою."
                : "A manager needs to confirm shipping and the final total before payment."}
            </div>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {quoteError && (
            <p className={styles.error} role="alert">
              {quoteError}
            </p>
          )}
          {previewMessage && (
            <p className={styles.quoteNotice} role="status">
              {previewMessage}
            </p>
          )}

          <button type="submit" disabled={submitDisabled} className={styles.submit}>
            {submitting
              ? isUa
                ? "Оформлюємо…"
                : "Placing order…"
              : quoteLoading
                ? isUa
                  ? "Оновлюємо суму…"
                  : "Updating total…"
                : quote?.requiresQuote
                  ? isUa
                    ? "Очікуємо прорахунок"
                    : "Awaiting a quote"
                  : paymentIsOnline
                    ? (isUa ? "Перейти до оплати · " : "Continue to payment · ") + totalText
                    : isUa
                      ? "Оформити замовлення"
                      : "Place order"}
            {!submitting && <ArrowRight size={16} aria-hidden="true" />}
          </button>
          <p className={styles.terms}>
            {isUa
              ? "Оформлюючи замовлення, ви погоджуєтеся з "
              : "By placing your order, you agree to our "}
            <Link href={"/" + locale + "/terms"}>
              {isUa ? "умовами використання" : "terms of service"}
            </Link>
            {isUa ? " та " : " and "}
            <Link href={"/" + locale + "/privacy"}>
              {isUa ? "політикою конфіденційності" : "privacy policy"}
            </Link>
            .
          </p>
        </form>

        <aside
          className={styles.summaryColumn}
          aria-label={isUa ? "Ваше замовлення" : "Your order"}
        >
          <div className={styles.summaryInner}>
            <button
              type="button"
              className={styles.mobileSummary}
              aria-expanded={summaryOpen}
              aria-controls="checkout-summary"
              onClick={() => setSummaryOpen((current) => !current)}
            >
              <span>
                <ChevronDown size={15} aria-hidden="true" />
                {isUa ? "Ваше замовлення" : "Order summary"}
              </span>
              <span>{totalText}</span>
            </button>
            <div
              id="checkout-summary"
              className={styles.summaryContent}
              data-open={summaryOpen}
              aria-busy={quoteLoading}
            >
              <div className={styles.summaryHead}>
                <h2>{isUa ? "Ваше замовлення" : "Your order"}</h2>
                <select
                  aria-label={isUa ? "Валюта розрахунку" : "Billing currency"}
                  className={styles.currencySelect}
                  value={form.currency}
                  onChange={(event) => {
                    const currency = event.target.value as ShopCurrencyCode;
                    setForm((current) => ({
                      ...current,
                      currency,
                      paymentMethod:
                        current.paymentMethod === "MONOBANK" && currency !== "UAH"
                          ? "FOP"
                          : current.paymentMethod,
                    }));
                    setSelectedShopCurrency(currency);
                  }}
                >
                  <option value="UAH">UAH</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <ul className={styles.items}>
                {cart.items.map((item) => {
                  const line = quoteItemsByKey.get(quoteLineKey(item.slug, item.variantId));
                  const amount =
                    line?.total ??
                    (item.price ? getPrice(item.price, quoteCurrency) * item.quantity : null);
                  const title =
                    (isUa ? item.title?.ua : item.title?.en) || item.title?.en || item.slug;
                  return (
                    <li key={item.id} className={styles.item}>
                      <div className={styles.thumbnail}>
                        {item.image ? (
                          <ShopProductImage
                            src={item.image}
                            fallbackSrc={item.fallbackImage}
                            alt={title}
                            fill
                            sizes="66px"
                          />
                        ) : (
                          <Package size={22} aria-hidden="true" />
                        )}
                        <span
                          className={styles.quantity}
                          aria-label={
                            (isUa ? "Кількість: " : "Quantity: ") +
                            (line?.quantity ?? item.quantity)
                          }
                        >
                          {line?.quantity ?? item.quantity}
                        </span>
                      </div>
                      <div>
                        <div className={styles.itemTitle}>{title}</div>
                        {item.variantTitle && (
                          <div className={styles.itemVariant}>
                            {preview ? (isUa ? "1 комплект" : "1 set") : item.variantTitle}
                          </div>
                        )}
                      </div>
                      <span className={styles.itemAmount}>
                        {amount === null ? "—" : formatShopMoney(locale, amount, quoteCurrency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>{isUa ? "Товари" : "Subtotal"}</span>
                  <span>
                    {quote ? formatShopMoney(locale, quote.subtotal, quoteCurrency) : "—"}
                  </span>
                </div>
                {showRegionalAdjustment && (
                  <div className={styles.totalRow}>
                    <span>{isUa ? "Корекція ціни" : "Price adjustment"}</span>
                    <span>
                      {formatShopMoney(locale, quote?.regionalAdjustmentAmount ?? 0, quoteCurrency)}
                    </span>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>{isUa ? "Доставка" : "Shipping"}</span>
                  <span className={styles.totalRowMuted}>
                    {!quote
                      ? "—"
                      : quote.shippingIncludedInPrice
                        ? isUa
                          ? "Включена у ціну"
                          : "Included in price"
                        : quote.shippingCost === 0
                          ? isUa
                            ? "За тарифами перевізника"
                            : "Calculated by carrier"
                          : formatShopMoney(locale, quote.shippingCost, quoteCurrency)}
                  </span>
                </div>
                {showVatLine && (
                  <div className={styles.totalRow}>
                    <span>{vatSummaryLabel(quote)}</span>
                    <span>
                      {hasMoneyAmount(quote?.taxAmount)
                        ? formatShopMoney(locale, quote?.taxAmount ?? 0, quoteCurrency)
                        : quote?.showTaxesIncludedNotice
                          ? isUa
                            ? "Включено"
                            : "Included"
                          : formatShopMoney(locale, 0, quoteCurrency)}
                    </span>
                  </div>
                )}
                {quote?.landedCost && (
                  <div className={styles.totalRow}>
                    <span>
                      {quote.landedCost.mode === "DDP"
                        ? isUa
                          ? "Імпортні витрати · DDP"
                          : "Import charges · DDP"
                        : isUa
                          ? "Імпорт при доставці"
                          : "Import due on delivery"}
                    </span>
                    <span>
                      {quote.landedCost.mode === "QUOTE"
                        ? isUa
                          ? "Після підтвердження"
                          : "After confirmation"
                        : formatShopMoney(
                            locale,
                            quote.landedCost.mode === "DDP"
                              ? quote.landedCost.includedAmount
                              : quote.landedCost.dueAtDeliveryAmount,
                            quoteCurrency
                          )}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.grandTotal}>
                <span>{isUa ? "Разом" : "Total"}</span>
                <span className={styles.totalAmount}>{totalText}</span>
              </div>
              {quoteLoading && (
                <p className={styles.summaryNote} role="status">
                  {isUa ? "Оновлюємо розрахунок…" : "Updating your total…"}
                </p>
              )}
              {quote?.pricingAudience === "b2b" && (
                <p className={styles.summaryNote}>
                  {isUa ? "Застосовано ваші B2B ціни" : "Your B2B pricing is applied"}
                </p>
              )}
              {quote?.regionalPricingRule && (
                <p className={styles.summaryNote}>{quote.regionalPricingRule.name}</p>
              )}
              {quote?.landedCost && (
                <details className={styles.landedCost}>
                  <summary>{isUa ? "Деталі імпортних витрат" : "Import cost details"}</summary>
                  <p>
                    {quote.landedCost.mode === "DDP"
                      ? isUa
                        ? "Включено у підсумок за поточним розрахунком маршруту."
                        : "Included in the total using the current route estimate."
                      : isUa
                        ? "Орієнтовні мито, VAT та митні збори сплачуються при імпорті."
                        : "Estimated duty, VAT and customs charges are due at import."}
                  </p>
                  <div className={styles.totalRow}>
                    <span>{isUa ? "Мито" : "Duty"}</span>
                    <span>
                      {formatShopMoney(locale, quote.landedCost.dutyAmount, quoteCurrency)}
                    </span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>Import VAT</span>
                    <span>
                      {formatShopMoney(locale, quote.landedCost.importVatAmount, quoteCurrency)}
                    </span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>{isUa ? "Митне оформлення" : "Brokerage + handling"}</span>
                    <span>
                      {formatShopMoney(
                        locale,
                        quote.landedCost.brokerageAmount + quote.landedCost.handlingAmount,
                        quoteCurrency
                      )}
                    </span>
                  </div>
                </details>
              )}
            </div>
          </div>
        </aside>
      </div>
    </ShopCheckoutShell>
  );
}
