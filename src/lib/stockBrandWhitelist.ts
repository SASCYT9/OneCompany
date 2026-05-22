/**
 * Whitelist of canonical tuning brands the B2B Склад page is allowed to
 * surface in its brand filter. Built from the curated lists in `brands.ts`
 * plus `OUR_STORES` (our active brand-shop pages).
 *
 * Excludes `brandsOem` (Ferrari, Lamborghini, McLaren, Rolls Royce,
 * Maserati, Aston Martin) — those are vehicle manufacturers, not tuning
 * brands. Dealer feedback (2026-05-20): "прибрати car-makes повністю".
 *
 * The whitelist is used by `/api/shop/stock/brands` to filter aggregated
 * brand names returned to the dropdown. `/api/shop/stock/search` is NOT
 * filtered by whitelist — if a brand value reaches search params (e.g.
 * via URL), it still works as a free-text filter.
 */
import { brandsUsa, brandsEurope, brandsRacing, brandsMoto, type LocalBrand } from "./brands";
import { OUR_STORES } from "@/app/[locale]/shop/data/ourStores";

const canonicalSources: { name: string }[] = [
  ...brandsUsa,
  ...brandsEurope,
  ...brandsRacing,
  ...brandsMoto,
  ...OUR_STORES.map((store) => ({ name: store.name })),
];

/**
 * Normalize a brand string so that "OHLINS", "Ohlins", "Öhlins", "ohlins  "
 * all collapse to the same comparison key. Strips diacritics + lowercases +
 * collapses internal whitespace.
 */
export function normalizeBrandKey(name: string | null | undefined): string {
  if (!name) return "";
  return String(name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Map from normalized-key → canonical (pretty) brand label from brands.ts. */
const canonicalLabelByKey = new Map<string, string>();
for (const source of canonicalSources) {
  const key = normalizeBrandKey(source.name);
  if (!key) continue;
  // First write wins. Order: brandsUsa → brandsEurope → brandsRacing →
  // brandsMoto → OUR_STORES. brands.ts wins over OUR_STORES if both define
  // the same brand (e.g. "Akrapovic" vs "Akrapovič").
  if (!canonicalLabelByKey.has(key)) {
    canonicalLabelByKey.set(key, source.name);
  }
}

/** Set of normalized keys that ARE allowed in the B2B brand dropdown. */
export const tuningBrandKeySet: ReadonlySet<string> = new Set(canonicalLabelByKey.keys());

export function isAllowedBrand(name: string | null | undefined): boolean {
  const key = normalizeBrandKey(name);
  if (!key) return false;
  return tuningBrandKeySet.has(key);
}

/**
 * Return the canonical pretty-cased label for a brand name. Falls back to
 * the input if the brand is not in the whitelist (caller should filter
 * those out via isAllowedBrand first).
 */
export function canonicalBrandLabel(name: string): string {
  const key = normalizeBrandKey(name);
  return canonicalLabelByKey.get(key) ?? name;
}

/**
 * Flat array of every whitelist alias lowercased (diacritics preserved).
 * Used by SQL `LOWER(column) = ANY($1::text[])` filters so the DB does
 * the heavy lifting instead of streaming all rows to the app for JS
 * filtering. Example: `"Öhlins"`, `"ohlins"` both present.
 */
export const brandAliasesLower: readonly string[] = (() => {
  const set = new Set<string>();
  for (const source of canonicalSources) {
    const raw = source.name?.toLowerCase()?.trim();
    if (raw) set.add(raw);
    // Also include diacritic-stripped form so `LOWER(db)` (which keeps
    // diacritics) and the stripped canonical "ohlins" both match.
    const stripped = normalizeBrandKey(source.name);
    if (stripped) set.add(stripped);
  }
  return [...set];
})();

// Internal: for tests / diagnostics.
export const _whitelistSize = canonicalLabelByKey.size;
export type { LocalBrand };
