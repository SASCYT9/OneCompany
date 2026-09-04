import {
  orderAddressText,
  orderPaymentLabel,
  orderPaymentMethodLabel,
  orderProductLinks,
  type OrderProductReference,
} from "./shopOrderPresentation";

export type ShopOrderNotification = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone?: string | null;
  customerGroup?: string;
  shippingAddress?: unknown;
  paymentMethod?: string;
  paymentStatus?: string;
  status?: string;
  currency: string;
  total: number;
  shippingCost?: number;
  requiresQuote?: boolean;
  taxAmount?: number;
  itemCount: number;
  items: Array<
    OrderProductReference & {
      title: string;
      sku?: string | null;
      variantTitle?: string | null;
      quantity: number;
      unitPrice: number;
      total: number;
    }
  >;
};

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (value: string | null | undefined, limit = 160) => {
  let result = "";
  for (const char of Array.from(value || "Не вказано")) {
    const escaped = escape(char);
    if (result.length + escaped.length > limit) return result + "…";
    result += escaped;
  }
  return result;
};

/** Pure rendering: no network calls. Keep whole HTML elements inside Telegram's limit. */
export function buildShopOrderTelegram(
  params: ShopOrderNotification,
  siteUrl = "https://onecompany.global"
) {
  let origin = "https://onecompany.global";
  try {
    const url = new URL(siteUrl);
    if (["https:", "http:"].includes(url.protocol)) origin = url.origin;
  } catch {
    /* use canonical site */
  }
  const money = (value: number) => `${Number(value).toFixed(2)} ${text(params.currency, 8)}`;
  const adminUrl = `${origin}/admin/shop/orders/${encodeURIComponent(params.orderId)}`;
  const header = [
    `<b>🛒 Нове замовлення ${text(params.orderNumber, 64)}</b>`,
    params.status === "PENDING_PAYMENT" ? "Очікує оплату" : "Потребує перевірки менеджером",
    "",
    `<b>Покупець:</b> ${text(params.customerName)}`,
    `<b>Телефон:</b> ${text(params.phone, 48)}`,
    `<b>Email:</b> ${text(params.email)}`,
    `<b>Група:</b> ${text(params.customerGroup || "B2C", 30)}`,
    `<b>Доставка:</b> ${text(orderAddressText(params.shippingAddress), 320)}`,
    `<b>Спосіб оплати:</b> ${text(orderPaymentMethodLabel(params.paymentMethod), 80)}`,
    `<b>Оплата:</b> ${text(orderPaymentLabel(params.paymentStatus || "UNPAID"), 60)}`,
    "",
    `<b>Разом: ${money(params.total)}</b>`,
    `Доставка: ${params.requiresQuote ? "потребує уточнення менеджером" : money(params.shippingCost || 0)} · Податок: ${money(params.taxAmount || 0)}`,
    "",
    `<b>Товари · ${params.itemCount} шт.</b>`,
  ].join("\n");
  const rows: string[] = [];
  let shown = 0;
  for (const item of params.items) {
    const links = orderProductLinks(item);
    const path = links.storefront || links.admin;
    const title = text(item.title, 160);
    const linkedTitle = path ? `<a href="${escape(origin + path)}">${title}</a>` : title;
    const identity = [
      item.sku ? `SKU: ${text(item.sku, 64)}` : "",
      item.variantTitle && item.variantTitle !== "Default Title" ? text(item.variantTitle, 80) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const row = `${shown + 1}. ${linkedTitle}${identity ? `\n${identity}` : ""}\n${item.quantity} × ${money(item.unitPrice)} = <b>${money(item.total)}</b>`;
    if (header.length + rows.join("\n\n").length + row.length > 3500) break;
    rows.push(row);
    shown++;
  }
  const remaining = params.items.length - shown;
  const message = [
    header,
    rows.join("\n\n"),
    remaining ? `Ще ${remaining} позицій — повний склад у замовленні.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    message,
    replyMarkup: { inline_keyboard: [[{ text: "Відкрити замовлення ↗", url: adminUrl }]] },
  };
}
