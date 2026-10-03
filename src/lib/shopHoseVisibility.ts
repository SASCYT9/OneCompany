import { expandShopPrices } from "@/lib/shopPriceConversion";
import type { ShopCurrencyCode } from "@/lib/shopCurrencyDefaults";

type PricedRecord = { priceEur?: unknown; priceUsd?: unknown; priceUah?: unknown };
export type HoseVisibilityProduct = PricedRecord & {
  titleEn: string; titleUa: string; categoryEn?: string | null; categoryUa?: string | null;
  productType?: string | null; variants?: PricedRecord[];
};

export function classifySmallHoseProduct(product: HoseVisibilityProduct, rates: Record<ShopCurrencyCode, number>) {
  const title = `${product.titleEn} ${product.titleUa}`;
  const category = `${product.categoryEn ?? ""} ${product.categoryUa ?? ""} ${product.productType ?? ""}`;
  const hoseCategory = /Hoses\s*&\s*Couplers|Clamp Kits|Hose Clamps|Хомути|Силіконові шланги/i.test(category);
  const namedHose = /\b(?:hoses?|clamps?)\b|шланг|хомут/i.test(title);
  if (!hoseCategory && !namedHose) return { hide: false, reason: "not_hose_or_clamp", maximumUsd: null };
  if (!hoseCategory && /\b(?:intake kit|intake system|complete intercooler|bigpack|water pump assembly)\b|комплект впуску|система впуску|радіатор у зборі|насос у зборі/i.test(title)) {
    return { hide: false, reason: "mixed_product_review", maximumUsd: null };
  }
  const money = (record: PricedRecord) => ({ eur: Number(record.priceEur ?? 0), usd: Number(record.priceUsd ?? 0), uah: Number(record.priceUah ?? 0) });
  const base = money(product);
  const prices = [base, ...(product.variants ?? []).map((variant) => ({
    eur: variant.priceEur == null ? base.eur : Number(variant.priceEur),
    usd: variant.priceUsd == null ? base.usd : Number(variant.priceUsd),
    uah: variant.priceUah == null ? base.uah : Number(variant.priceUah),
  }))].map((price) => expandShopPrices(price, rates).usd);
  if (prices.some((price) => !Number.isFinite(price) || price <= 0)) return { hide: false, reason: "price_unknown_review", maximumUsd: null };
  const maximumUsd = Math.max(...prices);
  return { hide: maximumUsd <= 200, reason: maximumUsd <= 200 ? "hose_or_clamp_up_to_200_usd" : "above_200_usd", maximumUsd };
}
