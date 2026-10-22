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
  const lookup = clean.match(/^(?:наличие|наявність|товар|артикул)\s+(\S.{1,60})$/i);
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
 * The webhook's instant answer to a price message instead of «подготовлю
 * задачи». Null when the text is not about prices.
 */
export function priceMessageAck(text: string | null | undefined) {
  const command = parsePriceCommand(String(text ?? ""));
  if (command && command.kind !== "lookup") return "✏️ Считаю, что изменится…";
  if (command || looksLikeSku(String(text ?? ""))) return "🔎 Смотрю товар…";
  return null;
}
