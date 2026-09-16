export type DraftCurrency = "EUR" | "USD" | "UAH";
export type DraftPrices = Partial<
  Record<
    "priceEur" | "priceUsd" | "priceUah" | "priceEurB2b" | "priceUsdB2b" | "priceUahB2b",
    number | null
  >
>;

/** Null variant prices inherit from the product, never from a sibling variant. */
export function draftCatalogPrice(
  product: DraftPrices,
  variant: DraftPrices | null,
  currency: DraftCurrency,
  approvedB2b: boolean
) {
  const key = { EUR: "priceEur", USD: "priceUsd", UAH: "priceUah" }[currency] as
    "priceEur" | "priceUsd" | "priceUah";
  const b2bKey = `${key}B2b` as "priceEurB2b" | "priceUsdB2b" | "priceUahB2b";
  const regular = variant?.[key] ?? product[key] ?? null;
  const price = approvedB2b ? (variant?.[b2bKey] ?? product[b2bKey] ?? regular) : regular;
  return typeof price === "number" && Number.isFinite(price) && price >= 0 ? price : null;
}

export const draftMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
export function draftTotals(
  items: { price: number; quantity: number }[],
  shippingCost = 0,
  taxAmount = 0
) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(draftMoney(item.price) * 100) * item.quantity,
    0
  );
  return {
    subtotal: subtotalCents / 100,
    total: (subtotalCents + Math.round(shippingCost * 100) + Math.round(taxAmount * 100)) / 100,
  };
}

export type DraftItem = {
  productSlug: string;
  productId?: string | null;
  variantId?: string | null;
  title: string;
  quantity: number;
  price: number;
  image?: string | null;
  sku?: string | null;
};
export type CreateDraftBody = {
  customerId?: string | null;
  email: string;
  customerName: string;
  phone?: string | null;
  currency: DraftCurrency;
  shippingAddress?: Record<string, string>;
  items: DraftItem[];
  shippingCost?: number;
  taxAmount?: number;
  internalNote?: string | null;
  validUntil?: string | null;
};

/** Shared client/server contract; validate untrusted JSON before any DB write. */
export function validateDraftBody(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "Некоректні дані проформи.";
  const body = value as Record<string, unknown>;
  const text = (v: unknown, max = 500) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const optionalText = (v: unknown, max = 500) =>
    v == null || (typeof v === "string" && v.length <= max);
  const money = (v: unknown) =>
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 9999999999.99 &&
    Math.abs(v * 100 - Math.round(v * 100)) < 0.0001;
  if (!text(body.customerName, 200)) return "Вкажіть ім’я або назву клієнта (до 200 символів).";
  if (!text(body.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim()))
    return "Вкажіть коректний email клієнта.";
  if (!["EUR", "USD", "UAH"].includes(String(body.currency)))
    return "Оберіть валюту: EUR, USD або UAH.";
  if (
    !optionalText(body.customerId) ||
    !optionalText(body.phone, 80) ||
    !optionalText(body.internalNote, 10000)
  )
    return "Перевірте дані клієнта та примітку.";
  if (
    body.validUntil != null &&
    (typeof body.validUntil !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(body.validUntil) ||
      !Number.isFinite(Date.parse(body.validUntil)))
  )
    return "Вкажіть коректну дату дії проформи.";
  if (
    body.shippingAddress != null &&
    (typeof body.shippingAddress !== "object" ||
      Array.isArray(body.shippingAddress) ||
      Object.values(body.shippingAddress).some((v) => !optionalText(v, 500)))
  )
    return "Перевірте адресу доставки.";
  if (!money(body.shippingCost ?? 0) || !money(body.taxAmount ?? 0))
    return "Доставка та податки мають бути невід’ємними сумами з точністю до копійок.";
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 200)
    return "Додайте від 1 до 200 позицій.";
  for (const [index, entry] of body.items.entries()) {
    if (!entry || typeof entry !== "object") return `Перевірте позицію ${index + 1}.`;
    const item = entry as Record<string, unknown>;
    if (
      !text(item.title, 1000) ||
      !text(item.productSlug) ||
      !optionalText(item.productId) ||
      !optionalText(item.variantId) ||
      !optionalText(item.image, 4000) ||
      !optionalText(item.sku)
    )
      return `Перевірте дані товару в позиції ${index + 1}.`;
    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10000
    )
      return `Позиція ${index + 1}: кількість має бути цілим числом від 1 до 10 000.`;
    if (!money(item.price))
      return `Позиція ${index + 1}: вкажіть ціну з точністю до копійок (не менше нуля).`;
  }
  const { total } = draftTotals(
    body.items as DraftItem[],
    Number(body.shippingCost ?? 0),
    Number(body.taxAmount ?? 0)
  );
  if (!money(total)) return "Загальна сума проформи перевищує допустиме значення.";
  return null;
}
