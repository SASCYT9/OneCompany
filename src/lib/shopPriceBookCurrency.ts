import type { ShopCurrencyCode } from "./shopCurrencyDefaults";
import type { ShopProduct, ShopMoneySet } from "./shopCatalog";

export const ATOMIC_EUR_SOURCE_BRANDS = ["akrapovic", "ohlins", "csf", "adro"] as const;
export const ATOMIC_SOURCE_PRICE_ROUNDING_TOLERANCE_UAH = 0.27;

export type ShopPriceBookRates = Record<ShopCurrencyCode, number> & {
  _uahReserve?: number;
  _rawUsdToUah?: number;
};

export type ShopSourceMoney = {
  eur: number;
  usd: number;
  uah: number;
  sourceCurrency?: ShopCurrencyCode;
  sourceUnitAmount?: number;
  sourceQuantity?: number;
};

function roundMoney(value: number) {
  const cents = value * 100;
  const adjustment = Math.sign(cents) * Number.EPSILON * Math.max(1, Math.abs(cents));
  return Math.round(cents + adjustment) / 100;
}

export function shopUahSaleRate(currency: ShopCurrencyCode, rates: ShopPriceBookRates) {
  if (currency === "UAH") return 1;
  const raw =
    currency === "EUR" ? rates.UAH / rates.EUR : (rates._rawUsdToUah ?? rates.UAH / rates.USD);
  const reserve = rates._uahReserve ?? 0;
  if (!Number.isFinite(raw) || raw <= 0 || !Number.isFinite(reserve) || reserve < 0)
    throw new Error("INVALID_SHOP_PRICE_BOOK_RATE");
  return raw + reserve;
}

export function repriceShopSourceMoney(
  price: ShopSourceMoney,
  rates: ShopPriceBookRates
): ShopSourceMoney {
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  const available = (["EUR", "USD", "UAH"] as const).filter((currency) =>
    positive(price[currency.toLowerCase() as "eur" | "usd" | "uah"])
  );
  const source = price.sourceCurrency ?? (available.length === 1 ? available[0] : undefined);
  if (!source || !available.includes(source)) throw new Error("SHOP_PRICE_SOURCE_REQUIRED");
  const quantity = price.sourceQuantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error("INVALID_PRICE_SOURCE_QUANTITY");
  const amount =
    price.sourceUnitAmount ?? price[source.toLowerCase() as "eur" | "usd" | "uah"] / quantity;
  if (!positive(amount)) throw new Error("INVALID_PRICE_SOURCE_AMOUNT");
  if (![rates.EUR, rates.USD, rates.UAH].every(positive))
    throw new Error("INVALID_SHOP_PRICE_BOOK_RATE");
  const eur =
    source === "EUR" ? amount : source === "USD" ? amount / rates.USD : amount / rates.UAH;
  const total = (unit: number) => roundMoney(unit) * quantity;
  return {
    eur: total(eur),
    usd: total(source === "USD" ? amount : eur * rates.USD),
    uah: total(source === "UAH" ? amount : amount * shopUahSaleRate(source, rates)),
    sourceCurrency: source,
    ...(quantity > 1 ? { sourceUnitAmount: amount, sourceQuantity: quantity } : {}),
  };
}

/** Runtime never infers a currency from a brand or a global default. */
export function tagShopMoneySource(price: ShopSourceMoney): ShopSourceMoney {
  if (price.sourceCurrency) return price;
  const currencies = (["EUR", "USD", "UAH"] as const).filter(
    (currency) => Number(price[currency.toLowerCase() as "eur" | "usd" | "uah"]) > 0
  );
  const sourceCurrency = currencies.length === 1 ? currencies[0] : undefined;
  return sourceCurrency ? { ...price, sourceCurrency } : price;
}

export function withShopPriceSource<T extends ShopSourceMoney>(price: T, currency: unknown): T {
  return ["EUR", "USD", "UAH"].includes(String(currency))
    ? { ...price, sourceCurrency: currency as ShopCurrencyCode }
    : price;
}

export function shopDbPriceSource(
  row: Record<string, unknown>,
  variant: Record<string, unknown> | undefined,
  band: "price" | "compareAt" | "b2bPrice" | "b2bCompareAt"
) {
  const fields = {
    price: ["priceEur", "priceUsd", "priceUah", "priceSourceCurrency"],
    compareAt: ["compareAtEur", "compareAtUsd", "compareAtUah", "compareAtSourceCurrency"],
    b2bPrice: ["priceEurB2b", "priceUsdB2b", "priceUahB2b", "b2bPriceSourceCurrency"],
    b2bCompareAt: [
      "compareAtEurB2b",
      "compareAtUsdB2b",
      "compareAtUahB2b",
      "b2bCompareAtSourceCurrency",
    ],
  }[band];
  const source = fields.slice(0, 3).some((field) => Number(row[field]) > 0) ? row : variant;
  if (!source) return undefined;
  if (source[fields[3]]) return source[fields[3]];
  const present = fields
    .slice(0, 3)
    .map((field, index) =>
      Number(source[field]) > 0 ? (["EUR", "USD", "UAH"] as const)[index] : null
    )
    .filter(Boolean);
  return present.length === 1 ? present[0] : undefined;
}

export function tagShopProductMoneySources(product: ShopProduct): ShopProduct {
  const tag = (money: ShopMoneySet | undefined) => (money ? tagShopMoneySource(money) : money);
  return {
    ...product,
    price: tagShopMoneySource(product.price),
    compareAt: tag(product.compareAt),
    europePrice: tag(product.europePrice),
    b2bPrice: tag(product.b2bPrice),
    b2bCompareAt: tag(product.b2bCompareAt),
    variants: product.variants?.map((variant) => ({
      ...variant,
      price: variant.price ? tagShopMoneySource(variant.price) : variant.price,
      compareAt: tag(variant.compareAt),
      europePrice: tag(variant.europePrice),
      b2bPrice: tag(variant.b2bPrice),
      b2bCompareAt: tag(variant.b2bCompareAt),
    })),
  };
}
