/**
 * Validation for the two presentation tools. The model may only show products
 * it actually received from the catalog in this conversation; everything else
 * is dropped before it reaches the customer.
 */
import type { OneAiCard, OneAiComparison, OneAiConversationState, OneAiProduct } from "./types";

export const ONE_AI_MAX_CARDS = 6;
const MAX_COMPARISON_ROWS = 8;
const MAX_REPLIES = 4;

function cleanLine(value: unknown, maxLength: number) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

export function buildOneAiCards(
  rawArgs: unknown,
  state: Pick<OneAiConversationState, "products">
):
  | {
      ok: true;
      layout: "cards" | "compare";
      cards: OneAiCard[];
      comparison: OneAiComparison | null;
    }
  | { ok: false; error: string } {
  const source = rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};
  // Models occasionally rename the list ("products", "refs") or pass bare refs.
  const rawItems = [source.items, source.products, source.refs].find(Array.isArray) ?? [];
  const items = rawItems.map((item) => (typeof item === "string" ? { ref: item } : item));
  const seen = new Set<string>();
  const cards: OneAiCard[] = [];
  const keptIndexes: number[] = [];
  items.forEach((item, index) => {
    const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const ref = String(entry.ref ?? "").trim();
    const product = state.products[ref];
    if (!product || seen.has(ref) || cards.length >= ONE_AI_MAX_CARDS) return;
    seen.add(ref);
    keptIndexes.push(index);
    cards.push(toOneAiCard(product, cleanLine(entry.reason, 180)));
  });
  if (!cards.length) {
    return { ok: false, error: "No valid refs. Show only products returned by search_products." };
  }

  const layout = source.layout === "compare" && cards.length >= 2 ? "compare" : "cards";
  let comparison: OneAiComparison | null = null;
  if (layout === "compare" && Array.isArray(source.rows)) {
    const rows = source.rows
      .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : {}))
      .map((row) => {
        const values = Array.isArray(row.values) ? row.values : [];
        return {
          label: cleanLine(row.label, 40) ?? "",
          // Values stay aligned with the cards that survived validation.
          values: keptIndexes.map((index) => cleanLine(values[index], 80) ?? "—"),
        };
      })
      .filter((row) => row.label)
      .slice(0, MAX_COMPARISON_ROWS);
    comparison = rows.length ? { rows } : null;
  }
  return { ok: true, layout, cards, comparison };
}

/** The supplier summary is for the model only and never reaches the page. */
export function toOneAiCard(product: OneAiProduct, reason: string | null): OneAiCard {
  return {
    ref: product.ref,
    id: product.id,
    slug: product.slug,
    href: product.href,
    brand: product.brand,
    name: product.name,
    sku: product.sku,
    image: product.image,
    priceSet: product.priceSet,
    compareAtSet: product.compareAtSet,
    availability: product.availability,
    category: product.category,
    reason,
  };
}

/** Internal product refs ("p3") mean nothing to a customer. */
const INTERNAL_REF_PATTERN = /\bp\d{1,3}\b/i;

export function cleanOneAiReplies(rawArgs: unknown) {
  const source = rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};
  const options = [source.options, source.replies, source.chips].find(Array.isArray) ?? [];
  return options
    .map((option) => cleanLine(option, 60))
    .filter(
      (option): option is string => Boolean(option) && !INTERNAL_REF_PATTERN.test(option ?? "")
    )
    .filter((option, index, all) => all.indexOf(option) === index)
    .slice(0, MAX_REPLIES);
}

/** Drops internal refs ("(p17)", "p3") the model sometimes writes into its text. */
export function stripOneAiRefs(text: string) {
  return text.replace(/\s?\((?:p\d{1,3}(?:,\s*)?)+\)/g, "").replace(/\bp\d{1,3}\b/g, "");
}
