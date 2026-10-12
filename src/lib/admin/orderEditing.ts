/**
 * Manager corrections of a placed order (contacts, address, items). Pure — the route
 * applies the plan inside one transaction.
 */

export class OrderEditError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

type AmountLockFacts = {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  amountPaid: number | { toString(): string };
  isDraft: boolean;
  stripeCheckoutSessionId?: string | null;
  monobankPayment?: unknown;
};

export type OrderAmountLock = { code: string; text: string };

/**
 * The order total may only change while no payment exists and no payment link carries
 * the old amount — mono invoices and Whitepay links are issued for a fixed sum.
 */
export function orderAmountLock(order: AmountLockFacts): OrderAmountLock | null {
  if (order.isDraft)
    return { code: "DRAFT", text: "Це чернетка пропозиції — редагуйте її на сторінці чернеток." };
  if (order.status === "CANCELLED")
    return {
      code: "CANCELLED",
      text: "Замовлення скасоване. Відновіть його, щоб змінити товари.",
    };
  if (["SHIPPED", "DELIVERED", "REFUNDED"].includes(order.status))
    return {
      code: "FULFILLED",
      text: "Замовлення вже відправлене — товари змінювати пізно. Для змін оформіть повернення.",
    };
  if (
    Number(order.amountPaid) > 0 ||
    ["PAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus)
  )
    return {
      code: "PAID",
      text: "Клієнт уже платив за це замовлення, тому суму змінити не можна. Для змін оформіть повернення або нове замовлення.",
    };
  if (
    order.monobankPayment ||
    order.stripeCheckoutSessionId ||
    order.paymentStatus === "PENDING" ||
    ["MONOBANK", "WHITEPAY_FIAT", "WHITEPAY_CRYPTO", "WHITEBIT", "STRIPE"].includes(
      order.paymentMethod
    )
  )
    return {
      code: "PAYMENT_LINK",
      text: "Клієнту вже видано посилання на оплату на поточну суму. Щоб змінити товари, скасуйте це замовлення й створіть нове.",
    };
  return null;
}

export const ORDER_ADDRESS_FIELDS = [
  { key: "country", label: "Країна" },
  { key: "region", label: "Область" },
  { key: "city", label: "Місто" },
  { key: "line1", label: "Адреса / відділення" },
  { key: "line2", label: "Уточнення" },
  { key: "postcode", label: "Індекс" },
] as const;

export type OrderAddressKey = (typeof ORDER_ADDRESS_FIELDS)[number]["key"];

export type OrderContactEdit = { customerName: string; email: string; phone: string | null };

export type OrderItemUpdate = { id: string; quantity: number; price: number };

export type OrderItemAdd = {
  productId: string | null;
  variantId: string | null;
  productSlug: string | null;
  sku: string | null;
  title: string;
  image: string | null;
  quantity: number;
  price: number;
};

export type OrderEditRequest = {
  expectedUpdatedAt: string;
  contact: OrderContactEdit | null;
  shippingAddress: Partial<Record<OrderAddressKey, string>> | null;
  items: { update: OrderItemUpdate[]; remove: string[]; add: OrderItemAdd[] } | null;
  note: string;
};

const MAX_QUANTITY = 999;
const MAX_PRICE = 100_000_000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function quantityOf(value: unknown) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    throw new OrderEditError("INVALID_QUANTITY", `Кількість має бути цілим числом від 1 до ${MAX_QUANTITY}.`);
  return quantity;
}

function priceOf(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE)
    throw new OrderEditError("INVALID_PRICE", "Ціна має бути невід’ємним числом.");
  return Math.round(price * 100) / 100;
}

export function parseOrderEditRequest(body: unknown): OrderEditRequest {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const expectedUpdatedAt = text(input.expectedUpdatedAt, 64);
  if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt)))
    throw new OrderEditError("STALE_FORM", "Оновіть сторінку замовлення і спробуйте ще раз.");

  let contact: OrderContactEdit | null = null;
  if (input.contact && typeof input.contact === "object") {
    const raw = input.contact as Record<string, unknown>;
    const customerName = text(raw.customerName, 200);
    const email = text(raw.email, 254).toLowerCase();
    const phone = text(raw.phone, 40) || null;
    if (!customerName) throw new OrderEditError("NAME_REQUIRED", "Вкажіть ім’я клієнта.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new OrderEditError("INVALID_EMAIL", "Перевірте email клієнта.");
    contact = { customerName, email, phone };
  }

  let shippingAddress: OrderEditRequest["shippingAddress"] = null;
  if (input.shippingAddress && typeof input.shippingAddress === "object") {
    const raw = input.shippingAddress as Record<string, unknown>;
    shippingAddress = Object.fromEntries(
      ORDER_ADDRESS_FIELDS.map(({ key }) => [key, text(raw[key], 300)])
    );
  }

  let items: OrderEditRequest["items"] = null;
  if (input.items && typeof input.items === "object") {
    const raw = input.items as Record<string, unknown>;
    const update = (Array.isArray(raw.update) ? raw.update : []).map((entry) => {
      const line = (entry ?? {}) as Record<string, unknown>;
      const id = text(line.id, 64);
      if (!id) throw new OrderEditError("ITEM_NOT_FOUND", "Позицію не знайдено. Оновіть сторінку.");
      return { id, quantity: quantityOf(line.quantity), price: priceOf(line.price) };
    });
    const remove = (Array.isArray(raw.remove) ? raw.remove : [])
      .map((value) => text(value, 64))
      .filter(Boolean);
    const add = (Array.isArray(raw.add) ? raw.add : []).map((entry) => {
      const line = (entry ?? {}) as Record<string, unknown>;
      const title = text(line.title, 300);
      if (!title) throw new OrderEditError("TITLE_REQUIRED", "Вкажіть назву нової позиції.");
      return {
        productId: text(line.productId, 64) || null,
        variantId: text(line.variantId, 64) || null,
        productSlug: text(line.productSlug, 300) || null,
        sku: text(line.sku, 120) || null,
        title,
        image: text(line.image, 2000) || null,
        quantity: quantityOf(line.quantity),
        price: priceOf(line.price),
      };
    });
    if (update.length || remove.length || add.length) items = { update, remove, add };
  }

  return { expectedUpdatedAt, contact, shippingAddress, items, note: text(input.note, 1000) };
}

/** `total` is the stored line total — unchanged lines keep exactly what was charged. */
type CurrentItem = { id: string; title: string; quantity: number; price: number; total: number };

export type OrderItemsPlan = {
  update: OrderItemUpdate[];
  remove: string[];
  add: OrderItemAdd[];
  itemsTotalBefore: number;
  itemsTotalAfter: number;
  delta: number;
  lines: string[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatOrderMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

/** Only real changes survive; the totals move by the items difference only. */
export function planOrderItemsEdit(
  current: CurrentItem[],
  edit: NonNullable<OrderEditRequest["items"]>,
  currency: string
): OrderItemsPlan {
  const byId = new Map(current.map((item) => [item.id, item]));
  const remove = Array.from(new Set(edit.remove));
  for (const id of [...remove, ...edit.update.map((line) => line.id)])
    if (!byId.has(id))
      throw new OrderEditError("ITEM_NOT_FOUND", "Позицію не знайдено. Оновіть сторінку.", 409);

  const lines: string[] = [];
  const update = edit.update.filter((line) => {
    if (remove.includes(line.id)) return false;
    const before = byId.get(line.id)!;
    const changed = before.quantity !== line.quantity || round2(before.price) !== line.price;
    if (!changed) return false;
    const parts = [];
    if (before.quantity !== line.quantity) parts.push(`${before.quantity} → ${line.quantity} шт.`);
    if (round2(before.price) !== line.price)
      parts.push(`ціна ${formatOrderMoney(before.price, currency)} → ${formatOrderMoney(line.price, currency)}`);
    lines.push(`«${before.title}»: ${parts.join(", ")}`);
    return true;
  });
  for (const id of remove) lines.push(`видалено «${byId.get(id)!.title}»`);
  for (const line of edit.add)
    lines.push(`додано «${line.title}» × ${line.quantity} по ${formatOrderMoney(line.price, currency)}`);

  const itemsTotalBefore = round2(current.reduce((sum, item) => sum + item.total, 0));
  const updated = new Map(update.map((line) => [line.id, line]));
  const itemsTotalAfter = round2(
    current
      .filter((item) => !remove.includes(item.id))
      .reduce((sum, item) => {
        const line = updated.get(item.id);
        return sum + (line ? line.price * line.quantity : item.total);
      }, 0) + edit.add.reduce((sum, line) => sum + line.price * line.quantity, 0)
  );
  if (current.length - remove.length + edit.add.length < 1)
    throw new OrderEditError(
      "NO_ITEMS_LEFT",
      "У замовленні має лишитися хоча б один товар. Якщо замовлення не потрібне — скасуйте його."
    );
  return {
    update,
    remove,
    add: edit.add,
    itemsTotalBefore,
    itemsTotalAfter,
    delta: round2(itemsTotalAfter - itemsTotalBefore),
    lines,
  };
}

export function describeContactChanges(
  before: { customerName: string; email: string; phone: string | null },
  after: OrderContactEdit
) {
  const lines: string[] = [];
  if (before.customerName !== after.customerName)
    lines.push(`ім’я «${before.customerName}» → «${after.customerName}»`);
  if (before.email !== after.email) lines.push(`email ${before.email} → ${after.email}`);
  if ((before.phone ?? "") !== (after.phone ?? ""))
    lines.push(`телефон ${before.phone || "—"} → ${after.phone || "—"}`);
  return lines;
}

export function addressRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Known fields are replaced; anything else the checkout stored (e.g. carrier data) is kept. */
export function mergeOrderAddress(
  before: unknown,
  edit: Partial<Record<OrderAddressKey, string>>
): { address: Record<string, unknown>; changed: boolean } {
  const current = addressRecord(before);
  const address: Record<string, unknown> = { ...current };
  let changed = false;
  for (const { key } of ORDER_ADDRESS_FIELDS) {
    const next = edit[key] ?? "";
    const previous = typeof current[key] === "string" ? (current[key] as string).trim() : "";
    if (next === previous) continue;
    changed = true;
    if (next) address[key] = next;
    else delete address[key];
  }
  return { address, changed };
}

/** Added lines get a snapshot entry so the order shows their SKU like checkout lines. */
export function appendOrderSnapshotItems(
  snapshot: unknown,
  added: Array<OrderItemAdd & { productSlug: string }>,
  currency: string
) {
  const record = addressRecord(snapshot);
  const items = Array.isArray(record.items) ? record.items : [];
  return {
    ...record,
    items: [
      ...items,
      ...added.map((line) => ({
        slug: line.productSlug,
        variantId: line.variantId,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.price,
        total: round2(line.price * line.quantity),
        currency,
        addedByAdmin: true,
      })),
    ],
  };
}
