import { Prisma } from "@prisma/client";

import type { ShopCurrencyCode } from "@/lib/shopAdminSettings";
import { isEuropePricingCountry } from "@/lib/shopEuropePricing";
import { resolveCheckoutAudience, type ShopViewerPricingContext } from "@/lib/shopPricingAudience";

export type ShopCatalogEffectivePriceContext = Readonly<{
  audience: "b2c" | "b2b";
  useEuropeBase: boolean;
  currency: ShopCurrencyCode;
  currencyRates: Readonly<{
    EUR: number | null;
    USD: number | null;
    UAH: number | null;
  }>;
  customerB2BDiscountPercent: number | null;
  defaultB2BDiscountPercent: number | null;
  customerBrandDiscounts: Readonly<Record<string, number>>;
  systemBrandDiscounts: Readonly<Record<string, number>>;
}>;

type CurrencyRates = Readonly<Record<ShopCurrencyCode, number>>;

function safeRate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function serializableDiscountMap(map: ReadonlyMap<string, number> | undefined) {
  const result: Record<string, number> = Object.create(null);
  for (const [brand, value] of map ?? []) {
    const key = brand.trim().toLowerCase();
    if (!key) continue;
    const number = Number(value);
    // The audience resolver treats an invalid present value as a zero discount,
    // which still suppresses lower-priority tiers.
    result[key] = Number.isFinite(number) ? number : 0;
  }
  return result;
}

/**
 * Creates the scalar context needed to evaluate the same effective card price
 * inside a projection SQL query. The existing request-scoped viewer context
 * already owns any B2B brand-map reads.
 */
export function buildShopCatalogEffectivePriceContext(input: {
  viewer: ShopViewerPricingContext;
  currency: ShopCurrencyCode;
  currencyRates: CurrencyRates;
}): ShopCatalogEffectivePriceContext {
  return Object.freeze({
    audience: resolveCheckoutAudience(input.viewer),
    useEuropeBase: isEuropePricingCountry(input.viewer.priceCountry),
    currency: input.currency,
    currencyRates: Object.freeze({
      EUR: safeRate(input.currencyRates.EUR),
      USD: safeRate(input.currencyRates.USD),
      UAH: safeRate(input.currencyRates.UAH),
    }),
    customerB2BDiscountPercent: input.viewer.customerB2BDiscountPercent,
    defaultB2BDiscountPercent: input.viewer.defaultB2BDiscountPercent,
    customerBrandDiscounts: Object.freeze(
      serializableDiscountMap(input.viewer.customerBrandDiscountMap)
    ),
    systemBrandDiscounts: Object.freeze(
      serializableDiscountMap(input.viewer.systemBrandDiscountMap)
    ),
  });
}

/**
 * Builds a scalar effective price expression correlated to `projection."productId"`.
 * It deliberately has no projection-price fallback: filters and ordering must use
 * the same fresh canonical product/default-variant data as card rendering.
 */
export function buildShopCatalogEffectivePriceSql(
  context: ShopCatalogEffectivePriceContext
): Prisma.Sql {
  const customerBrandDiscounts = JSON.stringify(context.customerBrandDiscounts);
  const systemBrandDiscounts = JSON.stringify(context.systemBrandDiscounts);
  const customerDiscount = finiteOrZero(context.customerB2BDiscountPercent);
  const defaultDiscount = finiteOrZero(context.defaultB2BDiscountPercent);
  const eurRate = context.currencyRates.EUR;
  const usdRate = context.currencyRates.USD;
  const uahRate = context.currencyRates.UAH;
  // expandShopPrices declines every conversion when any configured rate is invalid.
  const canConvert = eurRate != null && usdRate != null && uahRate != null;
  const audienceIsB2B = context.audience === "b2b";
  const useEuropeBase = context.useEuropeBase;

  const requestedAmount =
    context.currency === "EUR"
      ? Prisma.sql`CASE
          WHEN effective."eur" > 0 THEN effective."eur"
          WHEN effective."usd" > 0 AND ${canConvert} THEN (effective."usd" / ${usdRate}) * ${eurRate}
          WHEN effective."uah" > 0 AND ${canConvert} THEN (effective."uah" / ${uahRate}) * ${eurRate}
          ELSE 0
        END`
      : context.currency === "UAH"
        ? Prisma.sql`CASE
            WHEN effective."uah" > 0 THEN effective."uah"
            WHEN effective."usd" > 0 AND ${canConvert}
              THEN (effective."usd" / ${usdRate}) * ${uahRate}
            WHEN effective."eur" > 0 AND ${canConvert} THEN (effective."eur" / ${eurRate}) * ${uahRate}
            ELSE 0
          END`
        : Prisma.sql`CASE
            WHEN effective."usd" > 0 THEN effective."usd"
            WHEN effective."eur" > 0 AND ${canConvert} THEN (effective."eur" / ${eurRate}) * ${usdRate}
            WHEN effective."uah" > 0 AND ${canConvert}
              THEN (effective."uah" / ${uahRate}) * ${usdRate}
            ELSE 0
          END`;

  return Prisma.sql`(
    SELECT CASE WHEN requested."amount" > 0 THEN requested."amount" ELSE NULL END
    FROM "ShopProduct" canonical_product
    LEFT JOIN LATERAL (
      SELECT
        variant."priceEur", variant."priceEurEurope", variant."priceUsd", variant."priceUah",
        variant."priceEurB2b", variant."priceUsdB2b", variant."priceUahB2b"
      FROM "ShopProductVariant" variant
      WHERE variant."productId" = canonical_product."id"
      ORDER BY variant."isDefault" DESC, variant."position" ASC
      LIMIT 1
    ) canonical_variant ON true
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(canonical_product."priceEur", canonical_variant."priceEur", 0)::numeric AS "rawEur",
        COALESCE(canonical_product."priceUsd", canonical_variant."priceUsd", 0)::numeric AS "rawUsd",
        COALESCE(canonical_product."priceUah", canonical_variant."priceUah", 0)::numeric AS "rawUah",
        COALESCE(canonical_product."priceEurEurope", canonical_variant."priceEurEurope", 0)::numeric AS "rawEuropeEur",
        COALESCE(canonical_product."priceEurB2b", canonical_variant."priceEurB2b", 0)::numeric AS "rawB2bEur",
        COALESCE(canonical_product."priceUsdB2b", canonical_variant."priceUsdB2b", 0)::numeric AS "rawB2bUsd",
        COALESCE(canonical_product."priceUahB2b", canonical_variant."priceUahB2b", 0)::numeric AS "rawB2bUah",
        lower(trim(CASE
          WHEN lower(trim(COALESCE(canonical_product."vendor", ''))) IN ('urban', 'urban automotive')
            THEN 'Urban Automotive'
          ELSE COALESCE(canonical_product."brand", canonical_product."vendor", '')
        END)) AS "brandKey"
    ) raw
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN ${useEuropeBase} AND raw."rawEuropeEur" > 0 THEN raw."rawEuropeEur" ELSE raw."rawEur" END AS "eur",
        CASE WHEN ${useEuropeBase} AND raw."rawEuropeEur" > 0 THEN 0::numeric ELSE raw."rawUsd" END AS "usd",
        CASE WHEN ${useEuropeBase} AND raw."rawEuropeEur" > 0 THEN 0::numeric ELSE raw."rawUah" END AS "uah"
    ) base
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN NOT ${audienceIsB2B} THEN 0::numeric
        WHEN ${customerBrandDiscounts}::jsonb ? raw."brandKey"
          THEN LEAST(GREATEST(((${customerBrandDiscounts}::jsonb ->> raw."brandKey")::numeric), 0), 100)
        WHEN ${systemBrandDiscounts}::jsonb ? raw."brandKey"
          THEN LEAST(GREATEST(((${systemBrandDiscounts}::jsonb ->> raw."brandKey")::numeric), 0), 100)
        WHEN LEAST(GREATEST(${customerDiscount}::numeric, 0), 100) > 0
          THEN LEAST(GREATEST(${customerDiscount}::numeric, 0), 100)
        ELSE LEAST(GREATEST(${defaultDiscount}::numeric, 0), 100)
      END AS "percent"
    ) discount
    CROSS JOIN LATERAL (
      SELECT
        ${audienceIsB2B} AND (
          raw."rawB2bEur" > 0 OR raw."rawB2bUsd" > 0 OR raw."rawB2bUah" > 0 OR discount."percent" > 0
        ) AS "useB2b"
    ) mode
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN mode."useB2b" THEN CASE
          WHEN raw."rawB2bEur" > 0 THEN raw."rawB2bEur"
          WHEN discount."percent" > 0 THEN floor(((base."eur"::double precision * (1 - discount."percent"::double precision / 100)) + 2.220446049250313e-16) * 100 + 0.5) / 100
          ELSE base."eur"
        END ELSE base."eur" END AS "eur",
        CASE WHEN mode."useB2b" THEN CASE
          WHEN raw."rawB2bUsd" > 0 THEN raw."rawB2bUsd"
          WHEN discount."percent" > 0 THEN floor(((base."usd"::double precision * (1 - discount."percent"::double precision / 100)) + 2.220446049250313e-16) * 100 + 0.5) / 100
          ELSE base."usd"
        END ELSE base."usd" END AS "usd",
        CASE WHEN mode."useB2b" THEN CASE
          WHEN raw."rawB2bUah" > 0 THEN raw."rawB2bUah"
          WHEN discount."percent" > 0 THEN floor(((base."uah"::double precision * (1 - discount."percent"::double precision / 100)) + 2.220446049250313e-16) * 100 + 0.5) / 100
          ELSE base."uah"
        END ELSE base."uah" END AS "uah"
    ) effective
    CROSS JOIN LATERAL (SELECT ${requestedAmount} AS "amount") requested
    WHERE canonical_product."id" = projection."productId"
      AND canonical_product."isPublished" = true
      AND canonical_product."status" = 'ACTIVE'
  )`;
}
