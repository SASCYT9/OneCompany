"use client";

import Link from "next/link";
import Image from "next/image";
import type { SupportedLocale } from "@/lib/seo";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { formatShopOrderStatus, shopOrderStatusBadgeClass } from "@/lib/shopOrderPresentation";
import { Package, ArrowLeft, Download } from "lucide-react";

type ShopOrderShippingAddress = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
} | null;

type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
  image: string | null;
  productSlug: string | null;
  variantId: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  items: OrderItem[];
  shippingAddress: ShopOrderShippingAddress;
  pricingSnapshot: unknown;
  ttnNumber?: string | null;
  deliveryMethod?: string | null;
};

function isLikelyNovaPoshtaTtn(value: string) {
  // Nova Poshta TTN is exactly 14 digits.
  return /^\d{14}$/.test(value.replace(/\s+/g, ""));
}

function buildTrackingUrl(ttn: string) {
  const compact = ttn.replace(/\s+/g, "");
  if (isLikelyNovaPoshtaTtn(compact)) {
    return `https://novaposhta.ua/tracking/?cargo_number=${compact}`;
  }
  return null;
}

export default function ShopOrderDetailClient({
  locale,
  order,
}: {
  locale: SupportedLocale;
  order: Order;
}) {
  const isUa = locale === "ua";

  return (
    <main className="min-h-screen bg-background text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)]">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/${locale}/shop/account`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/70 dark:text-foreground/55 transition hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> {isUa ? "Назад до акаунта" : "Back to account"}
        </Link>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-foreground/10 pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/65 dark:text-foreground/45">
              {isUa ? "Замовлення" : "Order"}
            </p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
              #{order.orderNumber}
            </h1>
            <p className="mt-2 text-sm text-foreground/70 dark:text-foreground/55">
              {new Date(order.createdAt).toLocaleDateString(isUa ? "uk-UA" : "en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] ${shopOrderStatusBadgeClass(order.status)}`}
            >
              {formatShopOrderStatus(locale, order.status)}
            </span>
            <a
              href={`/api/shop/account/orders/${order.orderNumber}/invoice`}
              download={`invoice-${order.orderNumber}.pdf`}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-primary/6 px-4 py-2 text-xs uppercase tracking-[0.2em] text-foreground dark:text-foreground/85 transition hover:border-foreground/30 hover:bg-foreground/10"
            >
              <Download className="h-3.5 w-3.5" />
              {isUa ? "PDF-інвойс" : "PDF invoice"}
            </a>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-foreground/60 dark:text-foreground/40 mb-2">
              {isUa ? "Товари" : "Items"}
            </h2>
            <div className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <ul className="space-y-4">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] border border-foreground/10 bg-foreground/5">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6 text-foreground/45 dark:text-foreground/20" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground dark:text-foreground/90">
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/65 dark:text-foreground/45">
                        <span>
                          {item.quantity} ×{" "}
                          {formatShopMoney(locale, item.price, order.currency as ShopCurrencyCode)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium text-foreground">
                      {formatShopMoney(locale, item.total, order.currency as ShopCurrencyCode)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="space-y-6">
            <section>
              <h2 className="text-sm uppercase tracking-widest text-foreground/60 dark:text-foreground/40 mb-2">
                {isUa ? "Підсумок замовлення" : "Order Summary"}
              </h2>
              <div className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] text-sm">
                <div className="flex justify-between text-foreground/75 dark:text-foreground/60 mb-3">
                  <span>{isUa ? "Підсумок товарів" : "Subtotal"}</span>
                  <span>
                    {formatShopMoney(locale, order.subtotal, order.currency as ShopCurrencyCode)}
                  </span>
                </div>
                <div className="flex justify-between text-foreground/75 dark:text-foreground/60 mb-3">
                  <span>{isUa ? "Доставка" : "Shipping"}</span>
                  <span>
                    {formatShopMoney(
                      locale,
                      order.shippingCost,
                      order.currency as ShopCurrencyCode
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-foreground/75 dark:text-foreground/60 mb-3">
                  <span>{isUa ? "Податки" : "Tax"}</span>
                  <span>
                    {formatShopMoney(locale, order.taxAmount, order.currency as ShopCurrencyCode)}
                  </span>
                </div>
                <div className="mt-4 border-t border-foreground/10 pt-4 flex justify-between text-base font-medium text-foreground">
                  <span>{isUa ? "Разом" : "Total"}</span>
                  <span>
                    {formatShopMoney(locale, order.total, order.currency as ShopCurrencyCode)}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-widest text-foreground/60 dark:text-foreground/40 mb-2">
                {isUa ? "Інформація про доставку" : "Shipping Info"}
              </h2>
              <div className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] text-sm text-foreground/75 dark:text-foreground/60">
                {order.shippingAddress && order.shippingAddress.line1 ? (
                  <>
                    <p className="text-foreground/95 dark:text-foreground/80 font-medium mb-1">
                      {order.shippingAddress.name}
                    </p>
                    <p>{order.shippingAddress.line1}</p>
                    {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                    <p>
                      {[
                        order.shippingAddress.city,
                        order.shippingAddress.region,
                        order.shippingAddress.postcode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p>{order.shippingAddress.country}</p>
                    {order.shippingAddress.phone && (
                      <p className="mt-2">{order.shippingAddress.phone}</p>
                    )}
                  </>
                ) : (
                  <p>
                    {isUa
                      ? "Доставка не застосовується або не вказана"
                      : "Shipping not applicable or not provided"}
                  </p>
                )}
              </div>
            </section>

            {order.ttnNumber ? (
              <section>
                <h2 className="text-sm uppercase tracking-widest text-foreground/60 dark:text-foreground/40 mb-2">
                  {isUa ? "Відстеження" : "Tracking"}
                </h2>
                <div className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] text-sm text-foreground/75 dark:text-foreground/60">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/60 dark:text-foreground/40 mb-2">
                    {isUa ? "Номер ТТН" : "Tracking number"}
                  </p>
                  <p className="font-mono text-base text-foreground dark:text-foreground/85 break-all">
                    {order.ttnNumber}
                  </p>
                  {(() => {
                    const url = buildTrackingUrl(order.ttnNumber!);
                    if (!url) {
                      return (
                        <p className="mt-3 text-xs text-foreground/65 dark:text-foreground/45">
                          {isUa
                            ? "Скопіюйте номер і відстежте на сайті перевізника."
                            : "Copy the number and track on the carrier website."}
                        </p>
                      );
                    }
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-primary transition hover:text-foreground"
                      >
                        {isUa ? "Відстежити на Новій Пошті" : "Track on Nova Poshta"} →
                      </a>
                    );
                  })()}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
