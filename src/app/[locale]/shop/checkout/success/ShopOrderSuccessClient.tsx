"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import type { SupportedLocale } from "@/lib/seo";
import { trackOrderPlaced } from "@/lib/analytics";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { formatShopOrderStatus, shopOrderStatusBadgeClass } from "@/lib/shopOrderPresentation";
import {
  buildShopStorefrontProductPath,
  isExternalCatalogProductSlug,
} from "@/lib/shopStorefrontRouting";

type LandedCost = {
  ruleName: string;
  mode: "DDP" | "DAP" | "QUOTE";
  guaranteed: boolean;
  dutyAmount: number;
  importVatAmount: number;
  brokerageAmount: number;
  handlingAmount: number;
  includedAmount: number;
  dueAtDeliveryAmount: number;
};

type OrderData = {
  orderNumber: string;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  monobankPayment?: { status: string; canPay: boolean } | null;
  email: string;
  customerName: string;
  currency: string;
  subtotal: number;
  regionalAdjustmentAmount: number;
  shippingCost: number;
  taxableSubtotal?: number;
  taxableShippingCost?: number;
  taxAmount: number;
  total: number;
  landedCost: LandedCost | null;
  showTaxesIncludedNotice: boolean;
  createdAt: string;
  items: Array<{
    productSlug: string;
    title: string;
    quantity: number;
    price: number;
    total: number;
    image: string | null;
    originalPrice?: number | null;
    pricingSource?: string | null;
    discountPercent?: number | null;
    sku?: string | null;
    brand?: string | null;
  }>;
};

type FopDetails = {
  companyName: string | null;
  iban: string | null;
  bankName: string | null;
  edrpou: string | null;
  details: string | null;
};

type Props = { locale: SupportedLocale; orderNumber?: string | null; token?: string | null };

function hasMoneyAmount(value?: number | null) {
  return Math.abs(value ?? 0) >= 0.005;
}

export default function ShopOrderSuccessClient({ locale, orderNumber, token }: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [fopDetails, setFopDetails] = useState<FopDetails | null>(null);
  const [loading, setLoading] = useState(!!(orderNumber && token));
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const trackedRef = useRef(false);
  const isUa = locale === "ua";
  const showRegionalAdjustment = Boolean(order && hasMoneyAmount(order.regionalAdjustmentAmount));
  const showVatLine = Boolean(
    order &&
    !order.landedCost &&
    (hasMoneyAmount(order.taxAmount) ||
      (order.showTaxesIncludedNotice && hasMoneyAmount(order.taxableSubtotal)))
  );

  useEffect(() => {
    if (!orderNumber || !token) {
      setLoading(false);
      setError(isUa ? "Немає даних замовлення." : "No order data.");
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    const loadOrder = () => fetch(`/api/shop/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        if (disposed) return;
        setOrder(data);
        setError("");
        if (!trackedRef.current) {
          trackedRef.current = true;
          trackOrderPlaced(data.orderNumber, data.total, data.currency);
        }
        if (data.paymentMethod === "MONOBANK" &&
            !["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"].includes(data.paymentStatus) && polls++ < 12) {
          timer = setTimeout(loadOrder, 5000);
        }
        if (data.paymentMethod === "FOP") {
          return fetch("/api/shop/checkout/payment-options")
            .then((r) => r.json())
            .then((opts: { fopDetails: FopDetails | null }) =>
              setFopDetails(opts.fopDetails ?? null)
            )
            .catch(() => {});
        }
      })
      .catch(() => { if (!disposed && polls === 0) setError(isUa ? "Замовлення не знайдено." : "Order not found."); })
      .finally(() => { if (!disposed) setLoading(false); });
    void loadOrder();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [orderNumber, token, isUa, refreshKey]);

  const resumePayment = async () => {
    if (paying || !orderNumber || !token) return;
    setPaying(true);
    setPaymentError("");
    try {
      const response = await fetch(`/api/shop/orders/${encodeURIComponent(orderNumber)}/monobank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, locale }),
      });
      const data = await response.json();
      if (!response.ok || !data.redirectUrl) throw new Error("Payment unavailable");
      window.location.assign(data.redirectUrl);
    } catch {
      setPaymentError(isUa ? "Оплата зараз недоступна. Оновіть статус або зверніться до менеджера з номером замовлення." : "Payment is currently unavailable. Refresh the status or contact us with your order number.");
      setRefreshKey((value) => value + 1);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-24 text-center text-foreground/75 dark:text-foreground/60">
        {isUa ? "Завантаження…" : "Loading…"}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background px-4 py-24">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-foreground/75 dark:text-foreground/60">{error}</p>
          <Link href={`/${locale}/shop`} className="mt-4 inline-block text-foreground underline">
            {isUa ? "Повернутися до каталогу" : "Return to catalog"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)]">
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28 sm:px-6">
        <div className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10">
          <div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"
            aria-hidden
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/65 dark:text-foreground/45">
            One Company
          </p>
          <h1 className="mt-3 text-2xl font-light tracking-tight sm:text-4xl">
            {isUa ? "Замовлення прийнято" : "Order confirmed"}
          </h1>
          <p className="mt-2 font-mono text-lg text-foreground/95 dark:text-foreground/80">
            {order.orderNumber}
          </p>
          <div
            className={`mt-4 inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${shopOrderStatusBadgeClass(order.status)}`}
          >
            {formatShopOrderStatus(locale, order.status)}
          </div>
          <p className="mt-4 text-sm text-foreground/75 dark:text-foreground/60">
            {isUa ? "Ми надішлемо підтвердження на" : "We will send confirmation to"} {order.email}
          </p>
          {order.paymentMethod === "MONOBANK" && (
            <div className="mt-6 rounded-2xl border border-foreground/10 bg-card/40 p-5 text-left" aria-live="polite">
              <p className="text-sm font-medium">
                {order.paymentStatus === "PAID"
                  ? isUa ? "Оплату підтверджено" : "Payment confirmed"
                  : order.paymentStatus === "REFUNDED"
                    ? isUa ? "Кошти повернено" : "Payment refunded"
                    : order.paymentStatus === "PARTIALLY_REFUNDED"
                      ? isUa ? "Кошти частково повернено" : "Payment partially refunded"
                      : order.paymentStatus === "FAILED"
                        ? isUa ? "Оплату не завершено" : "Payment not completed"
                        : isUa ? "Очікуємо підтвердження оплати" : "Awaiting payment confirmation"}
              </p>
              <p className="mt-1 text-xs text-foreground/70">plata by mono · Apple Pay · Google Pay</p>
              {order.monobankPayment?.canPay && (
                <button type="button" disabled={paying} onClick={resumePayment} className="mt-4 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-50">
                  {paying ? isUa ? "Завантаження…" : "Loading…" : isUa ? "Продовжити оплату" : "Continue payment"}
                </button>
              )}
              {!["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus ?? "") && (
                <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="ml-4 mt-4 text-sm underline">
                  {isUa ? "Оновити статус" : "Refresh status"}
                </button>
              )}
              {order.monobankPayment && !order.monobankPayment.canPay && !["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus ?? "") && (
                <p className="mt-3 text-xs text-foreground/70">
                  {isUa ? "Якщо статус не оновлюється, зверніться до менеджера з номером цього замовлення." : "If the status does not update, contact us with this order number."}
                </p>
              )}
              {paymentError && <p role="alert" className="mt-3 text-sm text-red-500">{paymentError}</p>}
            </div>
          )}
          <div className="mt-6 border-t border-foreground/10 pt-6 text-left">
            <p className="text-xs uppercase tracking-wider text-foreground/65 dark:text-foreground/45">
              {isUa ? "Склад замовлення" : "Order summary"}
            </p>
            <ul className="mt-4 space-y-3">
              {order.items.map((i, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-card/40 dark:bg-black/20 p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5">
                    {i.image ? (
                      <Image
                        src={i.image}
                        alt={i.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.22em] text-foreground/55 dark:text-foreground/30">
                        OC
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {i.productSlug && !isExternalCatalogProductSlug(i.productSlug) ? (
                      <Link
                        href={buildShopStorefrontProductPath(locale, {
                          slug: i.productSlug,
                          brand: i.brand,
                        })}
                        className="line-clamp-2 text-sm text-foreground dark:text-foreground/85 transition hover:text-primary"
                      >
                        {i.title}
                      </Link>
                    ) : (
                      <div className="line-clamp-2 text-sm text-foreground dark:text-foreground/85">
                        {i.title}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/65 dark:text-foreground/45">
                      {i.sku && (
                        <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-foreground/75 dark:text-foreground/60">
                          SKU: {i.sku}
                        </span>
                      )}
                      {i.brand && (
                        <span className="text-foreground/60 dark:text-foreground/40">
                          {i.brand}
                        </span>
                      )}
                      <span>
                        {i.quantity} ×{" "}
                        {formatShopMoney(locale, i.price, order.currency as ShopCurrencyCode)}
                      </span>
                    </div>
                    {i.pricingSource?.includes("b2b-discount") &&
                      i.discountPercent &&
                      i.discountPercent > 0 &&
                      i.originalPrice && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-sm bg-cyan-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/20">
                            B2B
                          </span>
                          <span className="text-[10px] text-foreground/55 dark:text-foreground/30 line-through">
                            {formatShopMoney(
                              locale,
                              i.originalPrice,
                              order.currency as ShopCurrencyCode
                            )}
                          </span>
                        </div>
                      )}
                  </div>
                  <div className="text-right text-sm font-medium text-foreground">
                    {formatShopMoney(locale, i.total, order.currency as ShopCurrencyCode)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 text-sm text-foreground/85 dark:text-foreground/70">
              <p>
                {isUa ? "Товари" : "Subtotal"}:{" "}
                {formatShopMoney(locale, order.subtotal, order.currency as ShopCurrencyCode)}
              </p>
              {showRegionalAdjustment ? (
                <p>
                  {isUa ? "Корекція ціни" : "Price adjustment"}:{" "}
                  {formatShopMoney(
                    locale,
                    order.regionalAdjustmentAmount,
                    order.currency as ShopCurrencyCode
                  )}
                </p>
              ) : null}
              <p>
                {isUa ? "Доставка" : "Shipping"}:{" "}
                {formatShopMoney(locale, order.shippingCost, order.currency as ShopCurrencyCode)}
              </p>
              {order.landedCost ? (
                <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span>
                      {order.landedCost.mode === "DDP"
                        ? isUa
                          ? "Імпортні витрати · DDP"
                          : "Import charges · DDP"
                        : order.landedCost.mode === "DAP"
                          ? isUa
                            ? "Імпорт при доставці · DAP"
                            : "Import at delivery · DAP"
                          : isUa
                            ? "Імпортні витрати · quote"
                            : "Import charges · quote"}
                    </span>
                    <span className="tabular-nums">
                      {order.landedCost.mode === "QUOTE"
                        ? isUa
                          ? "Після підтвердження"
                          : "After confirmation"
                        : formatShopMoney(
                            locale,
                            order.landedCost.mode === "DDP"
                              ? order.landedCost.includedAmount
                              : order.landedCost.dueAtDeliveryAmount,
                            order.currency as ShopCurrencyCode
                          )}
                    </span>
                  </div>
                  <p className="mt-1 text-foreground/60 dark:text-foreground/45">
                    {order.landedCost.mode === "DDP"
                      ? order.landedCost.guaranteed
                        ? isUa
                          ? `Включено у total · ${order.landedCost.ruleName}`
                          : `Included in total · ${order.landedCost.ruleName}`
                        : isUa
                          ? "Включено у total за поточним розрахунком"
                          : "Included in total using the current estimate"
                      : isUa
                        ? "Орієнтовна сума при імпорті"
                        : "Estimated amount due at import"}
                  </p>
                </div>
              ) : null}
              {showVatLine ? (
                <p>
                  VAT:{" "}
                  {order.taxAmount <= 0 && order.showTaxesIncludedNotice
                    ? isUa
                      ? "VAT включено"
                      : "VAT included"
                    : formatShopMoney(locale, order.taxAmount, order.currency as ShopCurrencyCode)}
                </p>
              ) : null}
            </div>
            <p className="mt-4 font-medium text-foreground">
              {isUa ? "Разом" : "Total"}:{" "}
              {formatShopMoney(locale, order.total, order.currency as ShopCurrencyCode)}
            </p>
          </div>
          {order.paymentMethod === "FOP" &&
            fopDetails &&
            (fopDetails.companyName || fopDetails.iban || fopDetails.details) && (
              <div className="mt-6 border-t border-foreground/10 pt-6 text-left">
                <p className="text-xs uppercase tracking-wider text-foreground/65 dark:text-foreground/45">
                  {isUa ? "Оплата на ФОП — реквізити" : "Payment to company — details"}
                </p>
                <div className="mt-3 space-y-1 text-sm text-foreground/95 dark:text-foreground/80 font-mono">
                  {fopDetails.companyName && <p>{fopDetails.companyName}</p>}
                  {fopDetails.iban && <p>IBAN: {fopDetails.iban}</p>}
                  {fopDetails.bankName && <p>{fopDetails.bankName}</p>}
                  {fopDetails.edrpou && <p>ЄДРПОУ: {fopDetails.edrpou}</p>}
                  {fopDetails.details && (
                    <p className="mt-2 whitespace-pre-wrap text-foreground/85 dark:text-foreground/70">
                      {fopDetails.details}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-xs text-foreground/65 dark:text-foreground/50">
                  {isUa
                    ? "Оплатіть за цими реквізитами. У призначенні платежу вкажіть номер замовлення."
                    : "Pay using these details. Include order number in the payment reference."}
                </p>
              </div>
            )}
          <Link
            href={`/${locale}/shop`}
            className="mt-8 inline-block rounded-full border border-primary bg-primary px-6 py-2 text-sm text-primary-foreground transition hover:bg-primary/90"
          >
            {isUa ? "Повернутися до каталогу" : "Return to catalog"}
          </Link>
        </div>
      </div>
    </div>
  );
}
