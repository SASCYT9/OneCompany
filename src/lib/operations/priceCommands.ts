/**
 * Price commands of the ops bot, pure: the webhook reads them to answer at
 * once, priceChanges.ts acts on them.
 */

export type PriceCommandCurrency = "EUR" | "USD" | "UAH";

export type PriceCommand =
  | { kind: "set"; target: string; amount: number; currency: PriceCommandCurrency | null }
  | { kind: "percent"; target: string; percent: number }
  | { kind: "formula"; target: string }
  | { kind: "lookup"; target: string };

function parseAmount(value: string) {
  return Number(value.replace(/[\s ]/g, "").replace("−", "-").replace(",", "."));
}

function currencyOf(value: string | undefined): PriceCommandCurrency | null {
  const text = String(value ?? "").toLowerCase();
  if (!text) return null;
  if (/€|eur|евро|євро/.test(text)) return "EUR";
  if (/\$|usd|дол/.test(text)) return "USD";
  if (/₴|грн|uah/.test(text)) return "UAH";
  return null;
}

/**
 * «цена V167-678-63 9005.92», «цена V167-678-63 9 005,92 €» — one product;
 * «цена Brabus +5%» — a brand or a product by percent; «цена Brabus по формуле»;
 * «цена V167-678-63», «наличие …», «товар …» — the product card.
 */
export function parsePriceCommand(text: string): PriceCommand | null {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const lookup = clean.match(/^(?:наличие|наявність|товар|артикул)\s+(\S.{1,80})$/i);
  if (lookup) return { kind: "lookup", target: lookup[1].trim() };
  const command = clean.match(/^(?:цена|ціна|price)\s+(\S.{0,80})$/i);
  if (!command) return null;
  const rest = command[1].trim();
  let match = rest.match(/^(.+?)\s+(?:по|за)\s+формул\S*$/i);
  if (match) return { kind: "formula", target: match[1].trim() };
  match = rest.match(/^(.+?)\s+([+\-−]?\d+(?:[.,]\d+)?)\s*%$/);
  if (match) {
    const percent = parseAmount(match[2]);
    return Number.isFinite(percent) ? { kind: "percent", target: match[1].trim(), percent } : null;
  }
  match = rest.match(
    /^(.+?)\s+(\d[\d\s ]*(?:[.,]\d{1,2})?)\s*(€|eur|евро|євро|\$|usd|дол\S*|₴|грн|uah)?\.?$/i
  );
  if (match) {
    const amount = parseAmount(match[2]);
    if (Number.isFinite(amount) && amount > 0) {
      return { kind: "set", target: match[1].trim(), amount, currency: currencyOf(match[3]) };
    }
  }
  return { kind: "lookup", target: rest };
}

/** A bare SKU sent to the bot opens the product card (checked against the catalog). */
export function looksLikeSku(text: string) {
  const clean = String(text ?? "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._\-/+]{2,40}$/.test(clean) && /\d/.test(clean);
}

/**
 * «🔎 Товар», «📦 Заказ» and «🚚 Доставка» ask with a reply prompt; the answer
 * to it is read as «товар …» / «заказ …» / «доставка …». The prompts start
 * with these words.
 */
export const OPS_PRODUCT_PROMPT = "🔎 Пришлите артикул, название или ссылку на товар";
export const OPS_ORDER_PROMPT = "📦 Пришлите номер заказа";
export const OPS_DELIVERY_PROMPT = "🚚 Пришлите артикул и город";

/** «🚚 Доставка в город» under a product card: the answer is the city. */
export function deliveryPromptFor(sku: string) {
  return `🚚 Доставка ${sku} — пришлите город`;
}

const DELIVERY_FOR_SKU = /^🚚 Доставка (.+?) — пришлите город/;

/** A reply to one of the bot's prompts, as the command it answers. */
export function promptedCommandText(replyToText: string | null | undefined, text: string) {
  const prompt = String(replyToText ?? "");
  if (prompt.startsWith(OPS_PRODUCT_PROMPT)) return `товар ${text}`;
  if (prompt.startsWith(OPS_ORDER_PROMPT)) return `заказ ${text}`;
  if (prompt.startsWith(OPS_DELIVERY_PROMPT)) return `доставка ${text}`;
  const forSku = DELIVERY_FOR_SKU.exec(prompt);
  if (forSku) return `доставка ${forSku[1]} ${text}`;
  return text;
}

const SLASH_WORDS: Record<string, string> = {
  product: "товар",
  find: "товар",
  order: "заказ",
  delivery: "доставка",
};

/** «/product Akrapovic M3», «/order OC-2026-00033», «/delivery 1021000B Одесса». */
export function slashCommandText(text: string) {
  const match = text.match(/^\/(product|find|order|delivery)(?:@[A-Za-z0-9_]+)?\s+(\S[\s\S]*)$/i);
  if (!match) return text;
  return `${SLASH_WORDS[match[1].toLowerCase()]} ${match[2].trim()}`;
}

/**
 * «доставка 1021000B Одесса»: Nova Poshta's price for a product to a city (the
 * city may be left out). The words after «доставка»; the SKU is found among
 * them against the catalog.
 */
export function parseDeliveryCommand(text: string | null | undefined) {
  const match = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(?:доставка|delivery)\s+(\S.{0,120})$/i);
  return match ? match[1].trim() : null;
}

/**
 * «OC-2026-00033», «заказ OC-2026-00033», «#OC-2026-00033»: the order card.
 * Only the number alone — a message about an order stays a task.
 */
export function parseOrderCommand(text: string | null | undefined) {
  const match = String(text ?? "")
    .trim()
    .match(/^(?:(?:заказ|замовлення|order)\s*)?(?:№|#)?\s*((?:OC|ORD)-[A-Z0-9-]{3,40})$/i);
  return match ? match[1].toUpperCase() : null;
}

/** A product page of our site («…/shop/…/slug»), alone or after «товар»: its slug. */
export function parseProductLink(text: string | null | undefined) {
  const match = String(text ?? "")
    .trim()
    .match(/^(?:(?:товар|наличие|наявність)\s+)?(https?:\/\/(?:www\.)?onecompany\.global\/\S+)$/i);
  if (!match) return null;
  try {
    const path = new URL(match[1]).pathname.split("/").filter(Boolean);
    const shop = path.indexOf("shop");
    const slug = shop >= 0 && path.length > shop + 1 ? path[path.length - 1] : null;
    return slug ? decodeURIComponent(slug) : null;
  } catch {
    return null;
  }
}

/**
 * The webhook's instant answer to a price message instead of «подготовлю
 * задачи». Null when the text is not about prices.
 */
export function priceMessageAck(text: string | null | undefined) {
  if (parseOrderCommand(text)) return "📦 Смотрю заказ…";
  const delivery = parseDeliveryCommand(text);
  if (delivery && looksLikeSku(delivery.split(" ")[0])) return "🚚 Считаю доставку…";
  if (parseProductLink(text)) return "🔎 Смотрю товар…";
  const command = parsePriceCommand(String(text ?? ""));
  if (command && command.kind !== "lookup") return "✏️ Считаю, что изменится…";
  if (command || looksLikeSku(String(text ?? ""))) return "🔎 Смотрю товар…";
  return null;
}
