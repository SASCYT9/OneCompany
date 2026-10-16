export function googleProductAvailability(
  stock: "inStock" | "preOrder",
  sourceDate?: string | null
) {
  let availabilityDate: string | null = null;
  if (sourceDate && /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(sourceDate)) {
    const day = sourceDate.slice(0, 10);
    const date = new Date(`${day}T00:00:00Z`);
    const timestamp = sourceDate.length === 10 ? `${day}T00:00:00Z` : sourceDate;
    if (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === day &&
      Number.isFinite(new Date(timestamp).getTime())
    )
      availabilityDate = timestamp;
  }
  return {
    availability: stock === "inStock" ? ("in_stock" as const) : ("backorder" as const),
    availabilityDate: stock === "preOrder" ? availabilityDate : null,
  };
}

/**
 * Owner-approved average supplier lead time (2026-10-16) for items on order
 * that are not made individually. Made-to-order items carry a longer lead-time
 * text or an explicit date, and both win over this default.
 */
export const DEFAULT_BACKORDER_LEAD_DAYS = 21;
const MAX_BACKORDER_LEAD_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const LEAD_TIME_UNIT_DAYS: Array<[RegExp, number]> = [
  [/^(?:дн|ден|доб|day)/, 1],
  [/^(?:тиж|нед|week)/, 7],
  [/^(?:міс|мес|month)/, 30],
];

/**
 * Upper bound, in calendar days, of a lead-time text such as "4–6 тижнів",
 * "30 днів", "2-3 weeks" or "10-14 робочих днів"; null when it names no
 * number of days, weeks or months (e.g. "Під замовлення").
 */
export function parseLeadTimeDays(text?: string | null): number | null {
  if (!text) return null;
  const match = text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .match(/(\d+)(?:\s*-\s*(\d+))?\s*((?:робоч\S*|working|business)\s+)?([a-zа-яіїєґ]+)/u);
  if (!match) return null;
  const amount = Number(match[2] ?? match[1]);
  const unit = LEAD_TIME_UNIT_DAYS.find(([pattern]) => pattern.test(match[4]));
  if (!unit || !Number.isFinite(amount) || amount <= 0) return null;
  const days = match[3] ? Math.ceil((amount * unit[1] * 7) / 5) : amount * unit[1];
  return Math.min(days, MAX_BACKORDER_LEAD_DAYS);
}

/**
 * Availability for Google surfaces (Merchant feed, Product structured data).
 * Google requires an availability date for `backorder` items and rejects them
 * without one, so when there is no explicit supplier/manager date it is
 * estimated from the product's lead-time text, else from
 * DEFAULT_BACKORDER_LEAD_DAYS. The storefront keeps using
 * `googleProductAvailability`, which shows a date only when an explicit one
 * exists.
 */
export function googleMerchantAvailability(
  stock: "inStock" | "preOrder",
  sourceDate: string | null | undefined,
  leadTime: { ua?: string | null; en?: string | null } | null | undefined,
  now: Date = new Date()
) {
  const result = googleProductAvailability(stock, sourceDate);
  if (result.availability !== "backorder" || result.availabilityDate) return result;
  const days =
    parseLeadTimeDays(leadTime?.ua) ??
    parseLeadTimeDays(leadTime?.en) ??
    DEFAULT_BACKORDER_LEAD_DAYS;
  const day = new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10);
  return { ...result, availabilityDate: `${day}T00:00:00Z` };
}
