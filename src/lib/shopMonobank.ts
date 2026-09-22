import { createHash, createPublicKey, verify } from "node:crypto";

const API_URL = "https://api.monobank.ua";
export const MONOBANK_CCY = 980;
export const MONOBANK_VALIDITY_SECONDS = 24 * 60 * 60;
const INVOICE_STATUSES = [
  "created",
  "processing",
  "hold",
  "success",
  "failure",
  "reversed",
  "expired",
] as const;

export type MonobankStatus = (typeof INVOICE_STATUSES)[number];
export type MonobankInvoiceStatus = {
  invoiceId: string;
  status: MonobankStatus;
  amount: number;
  ccy: number;
  finalAmount?: number;
  modifiedDate: string;
  reference?: string;
};

export class MonobankError extends Error {
  constructor(
    public readonly code: string,
    public readonly definitive = false
  ) {
    super(code);
    this.name = "MonobankError";
  }
}

export function getMonobankConfig() {
  const token = process.env.MONOBANK_TOKEN?.trim();
  const publicUrl = process.env.MONOBANK_PUBLIC_URL?.trim();
  if (!token || !publicUrl) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
  let url: URL;
  try {
    url = new URL(publicUrl);
  } catch {
    throw new MonobankError("MONOBANK_INVALID_PUBLIC_URL", true);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new MonobankError("MONOBANK_INVALID_PUBLIC_URL", true);
  }
  return { token, publicUrl: url.origin };
}

export function isMonobankEnabled() {
  if (process.env.MONOBANK_ENABLED !== "1") return false;
  try {
    getMonobankConfig();
    return true;
  } catch {
    return false;
  }
}

/** Monetary input must come from the persisted, server-calculated quote. */
export function monobankMinorUnits(value: number | { toString(): string }) {
  const amount = Number(value.toString());
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(minor) ||
    minor > 2_147_483_647
  ) {
    throw new MonobankError("MONOBANK_INVALID_AMOUNT", true);
  }
  return minor;
}

export function monobankCheckoutKey(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new MonobankError("MONOBANK_CHECKOUT_KEY_REQUIRED", true);
  }
  return createHash("sha256").update(value).digest("hex");
}

export function monobankRequestHash(body: unknown, customerId: string | null) {
  return createHash("sha256").update(JSON.stringify({ body, customerId })).digest("hex");
}

export function monobankReturnUrl(
  publicUrl: string,
  locale: string,
  orderNumber: string,
  viewToken: string
) {
  const url = new URL(`/${locale === "ua" ? "ua" : "en"}/shop/checkout/success`, publicUrl);
  url.searchParams.set("order", orderNumber);
  url.searchParams.set("token", viewToken);
  return url.toString();
}

export function isMonobankPaymentUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["pay.mbnk.biz", "pay.monobank.ua"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

type InvoiceOrder = {
  orderNumber: string;
  viewToken: string;
  currency: string;
  total: number | { toString(): string };
  shippingCost: number | { toString(): string };
  taxAmount: number | { toString(): string };
  items: Array<{
    title: string;
    productSlug: string;
    variantId?: string | null;
    quantity: number;
    price: number | { toString(): string };
    total: number | { toString(): string };
    image?: string | null;
  }>;
};

function monobankBasketIcon(value: string | null | undefined, publicUrl: string) {
  const raw = value?.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
    const url = new URL(normalized, publicUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildMonobankInvoice(
  order: InvoiceOrder,
  reference: string,
  locale: string,
  publicUrl: string
) {
  const amount = monobankMinorUnits(order.total);
  if (order.currency !== "UAH" || amount <= 0 || !order.items.length) {
    throw new MonobankError("MONOBANK_REQUIRES_UAH_QUOTE", true);
  }
  const basketOrder = order.items.map((item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new MonobankError("MONOBANK_INVALID_QUANTITY", true);
    }
    const sum = monobankMinorUnits(item.price);
    const total = monobankMinorUnits(item.total);
    if (sum <= 0 || !Number.isSafeInteger(sum * item.quantity) || sum * item.quantity !== total) {
      throw new MonobankError("MONOBANK_INVALID_BASKET_TOTAL", true);
    }
    const icon = monobankBasketIcon(item.image, publicUrl);
    return {
      name: item.title.slice(0, 256),
      qty: item.quantity,
      sum,
      total,
      unit: "шт.",
      code: (item.variantId || item.productSlug).slice(0, 128),
      ...(icon ? { icon } : {}),
    };
  });
  for (const [code, name, value] of [
    ["shipping", locale === "ua" ? "Доставка" : "Shipping", order.shippingCost],
    ["tax", locale === "ua" ? "Податки" : "Taxes", order.taxAmount],
  ] as const) {
    const sum = monobankMinorUnits(value);
    if (sum) basketOrder.push({ name, qty: 1, sum, total: sum, unit: "шт.", code });
  }
  const adjustment = amount - basketOrder.reduce((sum, item) => sum + item.total, 0);
  if (adjustment > 0) {
    basketOrder.push({
      name: locale === "ua" ? "Коригування вартості замовлення" : "Order price adjustment",
      qty: 1,
      sum: adjustment,
      total: adjustment,
      unit: "шт.",
      code: "adjustment",
    });
  }
  return {
    amount,
    ccy: MONOBANK_CCY,
    merchantPaymInfo: {
      reference,
      destination: `OneCompany ${order.orderNumber}`,
      basketOrder,
      ...(adjustment < 0
        ? {
            discounts: [
              { type: "DISCOUNT", mode: "VALUE", value: Number((-adjustment / 100).toFixed(2)) },
            ],
          }
        : {}),
    },
    redirectUrl: monobankReturnUrl(publicUrl, locale, order.orderNumber, order.viewToken),
    webHookUrl: new URL("/api/shop/monobank/callback", publicUrl).toString(),
    validity: MONOBANK_VALIDITY_SECONDS,
    paymentType: "debit",
  };
}

async function monobankRequest(path: string, body?: unknown) {
  const { token } = getMonobankConfig();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-Token": token, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // A timeout does not prove that invoice creation failed at the bank.
    throw new MonobankError("MONOBANK_REQUEST_UNCERTAIN");
  }
  if (!response.ok) {
    throw new MonobankError(
      `MONOBANK_HTTP_${response.status}`,
      [400, 403, 404, 405, 429].includes(response.status)
    );
  }
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new MonobankError("MONOBANK_INVALID_RESPONSE");
  }
}

export async function createMonobankInvoice(body: ReturnType<typeof buildMonobankInvoice>) {
  const data = await monobankRequest("/api/merchant/invoice/create", body);
  if (
    typeof data.invoiceId !== "string" ||
    !data.invoiceId ||
    !isMonobankPaymentUrl(data.pageUrl)
  ) {
    throw new MonobankError("MONOBANK_INVALID_RESPONSE");
  }
  return { invoiceId: data.invoiceId, pageUrl: data.pageUrl };
}

export function parseMonobankStatus(data: unknown): MonobankInvoiceStatus {
  if (!data || typeof data !== "object") throw new MonobankError("MONOBANK_INVALID_STATUS", true);
  const value = data as Record<string, unknown>;
  if (
    typeof value.invoiceId !== "string" ||
    !value.invoiceId ||
    value.invoiceId.length > 128 ||
    !INVOICE_STATUSES.includes(value.status as MonobankStatus) ||
    !Number.isSafeInteger(value.amount) ||
    Number(value.amount) <= 0 ||
    !Number.isSafeInteger(value.ccy) ||
    typeof value.modifiedDate !== "string" ||
    !Number.isFinite(Date.parse(value.modifiedDate)) ||
    (value.finalAmount !== undefined &&
      (!Number.isSafeInteger(value.finalAmount) ||
        Number(value.finalAmount) < 0 ||
        Number(value.finalAmount) > Number(value.amount))) ||
    (value.reference !== undefined && typeof value.reference !== "string")
  ) {
    throw new MonobankError("MONOBANK_INVALID_STATUS", true);
  }
  return {
    invoiceId: value.invoiceId,
    status: value.status as MonobankStatus,
    amount: value.amount as number,
    ccy: value.ccy as number,
    modifiedDate: value.modifiedDate,
    ...(value.finalAmount === undefined ? {} : { finalAmount: value.finalAmount as number }),
    ...(value.reference === undefined ? {} : { reference: value.reference as string }),
  };
}

export async function getMonobankInvoiceStatus(invoiceId: string) {
  return parseMonobankStatus(
    await monobankRequest(`/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`)
  );
}

export function verifyMonobankSignature(
  rawBody: string,
  signature: string,
  publicKeyBase64: string
) {
  if (!signature || signature.length > 256 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))
    return false;
  try {
    const key = createPublicKey(Buffer.from(publicKeyBase64, "base64"));
    return (
      key.asymmetricKeyType === "ec" &&
      verify("sha256", Buffer.from(rawBody), key, Buffer.from(signature, "base64"))
    );
  } catch {
    return false;
  }
}

let cachedKey: { tokenHash: string; key: string; fetchedAt: number } | undefined;
let keyRequest: Promise<string> | undefined;

async function getPublicKey(force = false) {
  const tokenHash = createHash("sha256").update(getMonobankConfig().token).digest("hex");
  if (cachedKey?.tokenHash === tokenHash && (!force || Date.now() - cachedKey.fetchedAt < 60_000))
    return cachedKey.key;
  if (!keyRequest) {
    keyRequest = monobankRequest("/api/merchant/pubkey")
      .then((data) => {
        if (typeof data.key !== "string") throw new MonobankError("MONOBANK_INVALID_PUBLIC_KEY");
        cachedKey = { tokenHash, key: data.key, fetchedAt: Date.now() };
        return data.key;
      })
      .finally(() => {
        keyRequest = undefined;
      });
  }
  return keyRequest;
}

export async function authenticateMonobankWebhook(rawBody: string, signature: string) {
  if (!signature || signature.length > 256 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))
    return false;
  const key = await getPublicKey();
  if (verifyMonobankSignature(rawBody, signature, key)) return true;
  // Bounded refresh supports key rotation without one API call per forged request.
  const refreshed = await getPublicKey(true);
  return refreshed !== key && verifyMonobankSignature(rawBody, signature, refreshed);
}

type PaymentSnapshot = {
  id: string;
  invoiceId: string | null;
  amount: number;
  ccy: number;
  status: string;
  providerModifiedAt: Date | null;
};
type OrderSnapshot = {
  paymentMethod: string;
  currency: string;
  total: number | { toString(): string };
  paymentStatus: string;
};

export function resolveMonobankStatusUpdate(
  payment: PaymentSnapshot,
  order: OrderSnapshot,
  event: MonobankInvoiceStatus
) {
  if (
    order.paymentMethod !== "MONOBANK" ||
    order.currency !== "UAH" ||
    monobankMinorUnits(order.total) !== payment.amount ||
    event.amount !== payment.amount ||
    event.ccy !== payment.ccy ||
    (payment.invoiceId && event.invoiceId !== payment.invoiceId) ||
    (event.reference !== undefined && event.reference !== payment.id) ||
    (!payment.invoiceId &&
      (event.reference !== payment.id ||
        !["creating", "creation_unknown"].includes(payment.status)))
  ) {
    throw new MonobankError("MONOBANK_PAYMENT_MISMATCH", true);
  }
  const modifiedAt = new Date(event.modifiedDate);
  if (payment.providerModifiedAt && modifiedAt <= payment.providerModifiedAt) return null;
  const financiallySettled = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(
    order.paymentStatus
  );
  if (financiallySettled && !["success", "reversed"].includes(event.status)) return null;
  // A debit invoice is settled only by success, never by hold/processing/redirect.
  if (event.status === "success" || event.status === "reversed") {
    if (event.status === "success" && event.finalAmount === undefined) {
      throw new MonobankError("MONOBANK_FINAL_AMOUNT_REQUIRED", true);
    }
    const paid = event.finalAmount ?? 0;
    return {
      modifiedAt,
      paymentStatus:
        paid === payment.amount ? "PAID" : paid === 0 ? "REFUNDED" : "PARTIALLY_REFUNDED",
      amountPaid: paid / 100,
    };
  }
  return {
    modifiedAt,
    paymentStatus: ["failure", "expired"].includes(event.status) ? "FAILED" : "PENDING",
    amountPaid: 0,
  };
}
