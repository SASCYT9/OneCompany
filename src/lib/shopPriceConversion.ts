import type { ShopMoneySet } from "@/lib/shopCatalog";
import type { ShopCurrencyCode } from "@/lib/shopAdminSettings";

type Rates = Record<ShopCurrencyCode, number>;

/**
 * Expand a partially-populated ShopMoneySet into a fully populated set by
 * converting from whichever currency is non-zero through the given rate
 * table. The store typically lists ONE source currency per product (USD for
 * iPE, EUR for Brabus, UAH for some accessories) and relies on this same
 * conversion path to render every other currency at runtime.
 *
 * Priority of source currency: any non-zero value, in order USD → EUR → UAH.
 * If all three are zero, returns zeros (caller decides what to do).
 */
export function expandShopPrices(price: ShopMoneySet | null | undefined, rates: Rates): ShopMoneySet {
  const usd = price?.usd ?? 0;
  const eur = price?.eur ?? 0;
  const uah = price?.uah ?? 0;
  const out: ShopMoneySet = { usd, eur, uah };

  const safe = (n: number) => typeof n === 'number' && Number.isFinite(n) && n > 0;

  let source: 'usd' | 'eur' | 'uah' | null = null;
  if (safe(usd)) source = 'usd';
  else if (safe(eur)) source = 'eur';
  else if (safe(uah)) source = 'uah';

  if (!source || !rates) return out;

  const r = { USD: rates.USD, EUR: rates.EUR, UAH: rates.UAH };
  if (!safe(r.USD) || !safe(r.EUR) || !safe(r.UAH)) return out;

  if (source === 'usd') {
    if (!safe(out.eur)) out.eur = (usd / r.USD) * r.EUR;
    if (!safe(out.uah)) out.uah = (usd / r.USD) * r.UAH;
  } else if (source === 'eur') {
    if (!safe(out.usd)) out.usd = (eur / r.EUR) * r.USD;
    if (!safe(out.uah)) out.uah = (eur / r.EUR) * r.UAH;
  } else {
    if (!safe(out.usd)) out.usd = (uah / r.UAH) * r.USD;
    if (!safe(out.eur)) out.eur = (uah / r.UAH) * r.EUR;
  }

  return out;
}

export function pickPrimaryCurrency(locale: 'ua' | 'en'): ShopCurrencyCode {
  return locale === 'ua' ? 'UAH' : 'USD';
}
