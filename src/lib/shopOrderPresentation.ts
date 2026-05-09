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
