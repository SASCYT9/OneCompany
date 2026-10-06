import { expandShopPrices } from "@/lib/shopPriceConversion";
import { tagShopMoneySource } from "@/lib/shopPriceBookCurrency";
import type { ShopMoneySet } from "./shopCatalog";
import type { ShopCurrencyCode } from "@/lib/shopCurrencyDefaults";

type PricedRecord = { priceEur?: unknown; priceUsd?: unknown; priceUah?: unknown };
type SourcedPricedRecord = PricedRecord & { priceSourceCurrency?: unknown };
export type HoseVisibilityProduct = PricedRecord & {
  titleEn: string;
  titleUa: string;
  categoryEn?: string | null;
  categoryUa?: string | null;
  productType?: string | null;
  priceSourceCurrency?: unknown;
  variants?: SourcedPricedRecord[];
};

export function classifySmallHoseProduct(
  product: HoseVisibilityProduct,
  rates: Record<ShopCurrencyCode, number>
) {
  const title = `${product.titleEn} ${product.titleUa}`;
  const category = `${product.categoryEn ?? ""} ${product.categoryUa ?? ""} ${product.productType ?? ""}`;
  const hoseCategory = /Hoses\s*&\s*Couplers|Clamp Kits|Hose Clamps|Хомути|Силіконові шланги/i.test(
    category
  );
  const namedHose = /\b(?:hoses?|clamps?)\b|шланг|хомут/i.test(title);
  if (!hoseCategory && !namedHose)
    return { hide: false, reason: "not_hose_or_clamp", maximumUsd: null };
  if (
    !hoseCategory &&
    /\b(?:intake kit|intake system|complete intercooler|bigpack|water pump assembly)\b|комплект впуску|система впуску|радіатор у зборі|насос у зборі/i.test(
      title
    )
  ) {
    return { hide: false, reason: "mixed_product_review", maximumUsd: null };
  }
  const money = (record: PricedRecord) => ({
    eur: Number(record.priceEur ?? 0),
    usd: Number(record.priceUsd ?? 0),
    uah: Number(record.priceUah ?? 0),
  });
  const resolveUsd = (
    values: { eur: number; usd: number; uah: number },
    declaredSource?: unknown
  ) => {
    const declared = ["EUR", "USD", "UAH"].includes(String(declaredSource))
      ? (String(declaredSource) as ShopCurrencyCode)
      : undefined;
    const price: ShopMoneySet = {
      ...tagShopMoneySource({ ...values, ...(declared ? { sourceCurrency: declared } : {}) }),
    };
    if (!price.sourceCurrency) return Number.NaN;
    try {
      return expandShopPrices(price, rates).usd;
    } catch {
      return Number.NaN;
    }
  };
  const base = money(product);
  const prices = [resolveUsd(base, product.priceSourceCurrency)];
  for (const variant of product.variants ?? []) {
    const variantMoney = money(variant);
    const variantOwnsPrice = [variantMoney.eur, variantMoney.usd, variantMoney.uah].some(
      (value) => value > 0
    );
    const effectiveMoney = {
      eur: variant.priceEur == null ? base.eur : variantMoney.eur,
      usd: variant.priceUsd == null ? base.usd : variantMoney.usd,
      uah: variant.priceUah == null ? base.uah : variantMoney.uah,
    };
    prices.push(
      resolveUsd(
        effectiveMoney,
        variantOwnsPrice ? variant.priceSourceCurrency : product.priceSourceCurrency
      )
    );
  }
  if (prices.some((price) => !Number.isFinite(price) || price <= 0))
    return { hide: false, reason: "price_unknown_review", maximumUsd: null };
  const maximumUsd = Math.max(...prices);
  return {
    hide: maximumUsd <= 200,
    reason: maximumUsd <= 200 ? "hose_or_clamp_up_to_200_usd" : "above_200_usd",
    maximumUsd,
  };
}
