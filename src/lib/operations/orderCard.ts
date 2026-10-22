import type { Prisma, PrismaClient } from "@prisma/client";

import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import { opsAdminLink } from "@/lib/operations/adminLinks";
import type { OpsTelegramInlineButton } from "@/lib/operations/notifications";
import {
  exactSeat,
  findNovaPoshtaCity,
  novaPoshtaPriceText,
  quoteNovaPoshta,
  type NovaPoshtaSeat,
} from "@/lib/operations/novaPoshta";
import type { PriceButtonFactory, PriceReply } from "@/lib/operations/priceChanges";
import {
  escapeTelegramHtml,
  formatPriceWatchMoney,
  ruPlural,
} from "@/lib/operations/priceWatchReport";
import type { PriceWatchCurrency } from "@/lib/operations/priceWatchSources";
import { normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";
import {
  formatShopOrderStatus,
  orderPaymentLabel,
  orderPaymentMethodLabel,
} from "@/lib/shopOrderPresentation";
import { repriceShopSourceMoney } from "@/lib/shopPriceBookCurrency";

/**
 * «OC-2026-00033» in the bot: where the order is — payment, delivery, items —
 * for people who may read orders, with the admin page, Nova Poshta tracking
 * and a text for the customer. Labels are the admin's own. Before it ships,
 * what Nova Poshta charges to the customer's city.
 */

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  currency: true,
  total: true,
  amountPaid: true,
  customerName: true,
  shippingAddress: true,
  deliveryMethod: true,
  ttnNumber: true,
  isDraft: true,
  createdAt: true,
  items: {
    orderBy: { createdAt: "asc" },
    select: { title: true, quantity: true, total: true, productId: true, variantId: true },
  },
  shipments: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { trackingNumber: true, trackingUrl: true },
  },
} satisfies Prisma.ShopOrderSelect;

type OrderRow = Prisma.ShopOrderGetPayload<{ select: typeof ORDER_SELECT }>;

const ITEM_LINES = 8;
const PAID = ["PAID", "PARTIALLY_PAID"];

const DELIVERY_LABEL: Record<string, string> = {
  NOVA_POSHTA: "Нова Пошта",
  SPECIAL_DELIVERY: "спецдоставка",
  PICKUP: "самовывоз",
};

export function canReadOrders(actor: { permissions: string[] }) {
  return matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
}

function money(order: Pick<OrderRow, "currency">, value: Prisma.Decimal | number) {
  const currency = String(order.currency).toUpperCase();
  return ["EUR", "USD", "UAH", "GBP"].includes(currency)
    ? formatPriceWatchMoney(Number(value), currency as PriceWatchCurrency)
    : `${Number(value).toFixed(2)} ${currency}`;
}

function trackingOf(order: OrderRow) {
  const ttn = order.ttnNumber?.trim() || order.shipments[0]?.trackingNumber?.trim() || null;
  const url =
    order.shipments[0]?.trackingUrl?.trim() ||
    (ttn && (order.deliveryMethod === "NOVA_POSHTA" || /^\d{14}$/.test(ttn))
      ? `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`
      : null);
  return { ttn, url: url && /^https:\/\//.test(url) ? url : null };
}

function cityOf(order: OrderRow) {
  const address =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as Record<string, unknown>)
      : {};
  return [address.city, address.line1]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .map((part) => part.trim())
    .join(", ")
    .slice(0, 80);
}

const MEASURE_SELECT = {
  weight: true,
  length: true,
  width: true,
  height: true,
  isDimensionsEstimated: true,
} as const;

type OrderCardClient = Pick<PrismaClient, "shopOrder" | "shopProduct" | "shopSettings">;

/** The order's total in hryvnias: Nova Poshta insures the parcel for it. */
async function orderUah(client: OrderCardClient, order: OrderRow) {
  const currency = String(order.currency).toUpperCase();
  const total = Number(order.total);
  if (currency === "UAH") return total;
  if (currency !== "EUR" && currency !== "USD") return null;
  const settings = await client.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  try {
    return repriceShopSourceMoney(
      {
        eur: currency === "EUR" ? total : 0,
        usd: currency === "USD" ? total : 0,
        uah: 0,
        sourceCurrency: currency,
      },
      normalizeShopCurrencyRates(settings?.currencyRates)
    ).uah;
  } catch {
    return null;
  }
}

/** Every unit is a box of its card's real weight; one missing weight prices nothing. */
async function novaPoshtaOrderLine(
  client: OrderCardClient,
  order: OrderRow,
  fetchImpl?: typeof fetch
) {
  const address =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as Record<string, unknown>)
      : {};
  const city = typeof address.city === "string" ? address.city.trim() : "";
  if (!city) return null;
  const ids = [
    ...new Set(order.items.map((item) => item.productId).filter((id): id is string => Boolean(id))),
  ];
  const products = ids.length
    ? await client.shopProduct.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          ...MEASURE_SELECT,
          variants: { select: { id: true, ...MEASURE_SELECT } },
        },
      })
    : [];
  const seats: NovaPoshtaSeat[] = [];
  let missing = 0;
  for (const item of order.items) {
    const product = products.find((entry) => entry.id === item.productId);
    const seat =
      exactSeat(product?.variants.find((entry) => entry.id === item.variantId)) ??
      exactSeat(product);
    if (!seat) missing += 1;
    else for (let unit = 0; unit < Math.max(1, item.quantity); unit += 1) seats.push(seat);
  }
  if (missing) {
    return `🚚 Новая почта: нет веса у ${missing} из ${order.items.length} ${ruPlural(
      order.items.length,
      "товара",
      "товаров",
      "товаров"
    )} — не посчитать.`;
  }
  try {
    const target = await findNovaPoshtaCity(city, fetchImpl);
    if (!target) return `🚚 Новая почта: не нашёл город «${escapeTelegramHtml(city)}».`;
    const quote = await quoteNovaPoshta({
      cityRef: target.ref,
      seats,
      declaredUah: await orderUah(client, order),
      fetchImpl,
    });
    return `🚚 Новая почта до ${escapeTelegramHtml(target.name)}: ${novaPoshtaPriceText(quote)}`;
  } catch {
    return "🚚 Новая почта сейчас не отвечает — цену доставки не посчитал.";
  }
}

/** What should happen next, as the shop's own order tasks see it. */
function nextStep(order: OrderRow, ttn: string | null) {
  if (order.isDraft) return "черновик: ждёт согласования с клиентом";
  if (["CANCELLED", "REFUNDED"].includes(order.status)) return null;
  if (order.status === "DELIVERED") return "готово — доставлен";
  if (order.status === "SHIPPED" || ttn) return "ждём доставку";
  if (PAID.includes(order.paymentStatus)) return "отправить: ТТН ещё нет";
  return "ждём оплату";
}

async function loadOrder(
  client: Pick<PrismaClient, "shopOrder">,
  where: Prisma.ShopOrderWhereUniqueInput
) {
  return client.shopOrder.findUnique({ where, select: ORDER_SELECT });
}

/** The order card; null when there is no such order. */
export async function buildOrderCard(input: {
  client: OrderCardClient;
  orderNumber: string;
  actor: { permissions: string[] };
  button: PriceButtonFactory;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<PriceReply | null> {
  if (!canReadOrders(input.actor)) {
    return {
      text: "Заказы открыты только тем, у кого есть доступ к заказам в админке.",
      parseMode: "HTML",
    };
  }
  const order = await loadOrder(input.client, { orderNumber: input.orderNumber });
  if (!order) return null;
  const { ttn, url } = trackingOf(order);
  const city = cityOf(order);
  const paid = Number(order.amountPaid);
  const created = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(order.createdAt);
  const items = order.items
    .slice(0, ITEM_LINES)
    .map(
      (item) =>
        `• ${escapeTelegramHtml(item.title.slice(0, 90))} × ${item.quantity} — ${money(order, item.total)}`
    );
  if (order.items.length > ITEM_LINES) items.push(`…и ещё ${order.items.length - ITEM_LINES}`);
  const next = nextStep(order, ttn);
  const novaPoshta =
    order.deliveryMethod === "NOVA_POSHTA" &&
    !ttn &&
    !["CANCELLED", "REFUNDED", "DELIVERED", "SHIPPED"].includes(order.status)
      ? await novaPoshtaOrderLine(input.client, order, input.fetchImpl)
      : null;
  const statusLabel = formatShopOrderStatus("ua", order.status);
  const paymentLabel = orderPaymentLabel(order.paymentStatus);
  const lines = [
    `📦 <b>${escapeTelegramHtml(order.orderNumber)}</b> · ${escapeTelegramHtml(statusLabel)}${
      order.isDraft ? " · черновик" : ""
    }`,
    `${created} · ${escapeTelegramHtml(order.customerName)}`,
    // «Очікує оплату» once, when the status already says it.
    `Сумма: <b>${money(order, order.total)}</b>${
      paymentLabel === statusLabel ? "" : ` · ${escapeTelegramHtml(paymentLabel)}`
    }${order.paymentStatus === "PARTIALLY_PAID" && paid > 0 ? ` (${money(order, paid)})` : ""}`,
    `Оплата: ${escapeTelegramHtml(orderPaymentMethodLabel(order.paymentMethod))}`,
    `Доставка: ${escapeTelegramHtml(
      DELIVERY_LABEL[order.deliveryMethod ?? ""] ?? order.deliveryMethod ?? "не выбрана"
    )}${city ? ` · ${escapeTelegramHtml(city)}` : ""} · ${
      ttn ? `ТТН ${escapeTelegramHtml(ttn)}` : "ТТН ещё нет"
    }`,
    ...(novaPoshta ? [novaPoshta] : []),
    "",
    "Товары:",
    ...(items.length ? items : ["• нет позиций"]),
    ...(next ? ["", `➡️ ${next}`] : []),
  ];
  const links: OpsTelegramInlineButton[] = [];
  const adminUrl = opsAdminLink(`/admin/shop/orders/${order.id}`);
  if (/^https?:\/\//.test(adminUrl)) links.push({ text: "🛠 В админке", url: adminUrl });
  if (url) links.push({ text: "🚚 Отследить", url });
  const rows: OpsTelegramInlineButton[][] = links.length ? [links] : [];
  const clientText = await input.button("order_client_text", order.id, "📝 Текст для клиента");
  if (clientText) rows.push([clientText]);
  return {
    text: lines.join("\n").slice(0, 3_900),
    parseMode: "HTML",
    ...(rows.length ? { replyMarkup: { inline_keyboard: rows } } : {}),
  };
}

/** «📝 Текст для клиента» under the order card: where the order is, in Ukrainian. */
export async function orderClientText(input: {
  client: Pick<PrismaClient, "shopOrder">;
  orderId: string;
  actor: { permissions: string[] };
}) {
  if (!canReadOrders(input.actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  const order = await loadOrder(input.client, { id: input.orderId });
  if (!order) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  const { ttn, url } = trackingOf(order);
  const status =
    order.status === "DELIVERED"
      ? "доставлено ✅"
      : order.status === "CANCELLED"
        ? "скасовано"
        : order.status === "REFUNDED"
          ? "кошти повернено"
          : order.status === "SHIPPED" || ttn
            ? "відправлено"
            : order.paymentStatus === "PAID"
              ? "оплачено, готуємо до відправлення"
              : order.paymentStatus === "PARTIALLY_PAID"
                ? "передоплату отримали, готуємо замовлення"
                : "очікує оплати";
  const lines = [
    `Замовлення ${order.orderNumber}`,
    `Статус: ${status}`,
    `Сума: ${money(order, order.total)}`,
    ...order.items
      .slice(0, ITEM_LINES)
      .map((item) => `• ${item.title.slice(0, 90)} × ${item.quantity}`),
    ...(ttn ? [`ТТН: ${ttn}`] : []),
    ...(url ? [`Відстежити: ${url}`] : []),
  ];
  return {
    message: "Текст для клиента — ниже.",
    link: null,
    reply: { text: escapeTelegramHtml(lines.join("\n")), parseMode: "HTML" } satisfies PriceReply,
  };
}
