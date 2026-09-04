import type { SupportedLocale } from "@/lib/seo";

const STATUS_LABELS = {
  ua: {
    PENDING_PAYMENT: "Очікує оплату",
    PENDING_REVIEW: "На розгляді",
    CONFIRMED: "Підтверджено",
    PROCESSING: "В обробці",
    SHIPPED: "Відправлено",
    DELIVERED: "Доставлено",
    CANCELLED: "Скасовано",
    REFUNDED: "Повернено",
  },
  en: {
    PENDING_PAYMENT: "Pending payment",
    PENDING_REVIEW: "Pending review",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  },
} as const;

export function formatShopOrderStatus(locale: SupportedLocale, status: string) {
  const key = locale === "ua" ? "ua" : "en";
  return STATUS_LABELS[key][status as keyof (typeof STATUS_LABELS)[typeof key]] ?? status;
}

export function shopOrderStatusBadgeClass(status: string) {
  switch (status) {
    case "DELIVERED":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "SHIPPED":
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
    case "CONFIRMED":
    case "PROCESSING":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    case "CANCELLED":
    case "REFUNDED":
      return "border-red-400/25 bg-red-400/10 text-red-200";
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
}

export type OrderProductReference = {
  productSlug: string;
  productId?: string | null;
  variantId?: string | null;
};

export function orderItemSnapshotDetails(snapshot: unknown, item: OrderProductReference) {
  const data =
    snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : {};
  const entries = Array.isArray(data.items) ? data.items : [];
  const match = entries.find(
    (value) =>
      value &&
      typeof value === "object" &&
      value.slug === item.productSlug &&
      (!value.variantId || value.variantId === item.variantId)
  );
  const string = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return { sku: string(match?.sku), variantTitle: string(match?.variantTitle) };
}

export function orderProductLinks(item: OrderProductReference, locale = "ua") {
  const slug = item.productSlug.trim();
  const external = /^(crm-|turn14-|preview-)/i.test(slug);
  return {
    storefront:
      slug && !external
        ? `/${locale === "en" ? "en" : "ua"}/shop/${encodeURIComponent(slug)}`
        : null,
    admin: item.productId ? `/admin/shop/${encodeURIComponent(item.productId)}` : null,
  };
}

export function orderAddressText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const address = value as Record<string, unknown>;
  return ["country", "region", "city", "line1", "line2", "postcode"]
    .map((key) => (typeof address[key] === "string" ? address[key].trim() : ""))
    .filter(Boolean)
    .join(", ");
}

export function orderPaymentLabel(status: string) {
  return (
    (
      {
        UNPAID: "Не оплачено",
        PAID: "Оплачено",
        PARTIALLY_PAID: "Частково оплачено",
        REFUNDED: "Повернено",
        PARTIALLY_REFUNDED: "Частково повернено",
        PENDING: "Очікує оплату",
        FAILED: "Помилка оплати",
      } as Record<string, string>
    )[status] || status
  );
}

export function orderPaymentMethodLabel(method: string | null | undefined) {
  return (
    (
      {
        FOP: "Переказ на рахунок ФОП",
        WHITEBIT: "Криптовалюта · Whitepay",
        WHITEPAY_FIAT: "Картка · Whitepay",
      } as Record<string, string>
    )[method || ""] ||
    method ||
    "Не вказано"
  );
}
