import { Prisma } from "@prisma/client";
import type { ShopCatalogEffectivePriceContext } from "./shopCatalogEffectivePrice.server";
import { shopSaleUsdPerEur, shopUahSaleRate } from "./shopPriceBookCurrency";

export function buildShopManagedPriceSql(
  context: ShopCatalogEffectivePriceContext,
  delivery: Prisma.Sql
): Prisma.Sql {
  const rates = context.currencyRates;
  const book = { ...rates, EUR: Number(rates.EUR), USD: Number(rates.USD), UAH: Number(rates.UAH) };
  const cross = shopSaleUsdPerEur(book);
  const euroSale = shopUahSaleRate("EUR", book);
  const dollarSale = shopUahSaleRate("USD", book);
  const selectSource = (
    eur: Prisma.Sql,
    usd: Prisma.Sql,
    uah: Prisma.Sql,
    declared: Prisma.Sql
  ) => Prisma.sql`CASE
    WHEN (${declared}) = 'EUR' AND (${eur}) > 0 THEN 'EUR'
    WHEN (${declared}) = 'USD' AND (${usd}) > 0 THEN 'USD'
    WHEN (${declared}) = 'UAH' AND (${uah}) > 0 THEN 'UAH'
    WHEN (${declared}) IS NULL AND (CASE WHEN (${eur}) > 0 THEN 1 ELSE 0 END + CASE WHEN (${usd}) > 0 THEN 1 ELSE 0 END + CASE WHEN (${uah}) > 0 THEN 1 ELSE 0 END) = 1
      THEN CASE WHEN (${eur}) > 0 THEN 'EUR' WHEN (${usd}) > 0 THEN 'USD' ELSE 'UAH' END
    ELSE NULL END`;
  const retailSource = selectSource(
    Prisma.sql`raw.eur`,
    Prisma.sql`raw.usd`,
    Prisma.sql`raw.uah`,
    Prisma.sql`raw."retailSource"`
  );
  const wholesaleSource = selectSource(
    Prisma.sql`raw."b2bEur"`,
    Prisma.sql`raw."b2bUsd"`,
    Prisma.sql`raw."b2bUah"`,
    Prisma.sql`raw."wholesaleSource"`
  );
  const canonicalSource = (eur: string, usd: string, uah: string, declared: string) => {
    const p = (field: string) => Prisma.raw(`canonical_product."${field}"`);
    const v = (field: string) => Prisma.raw(`canonical_variant."${field}"`);
    return Prisma.sql`CASE WHEN COALESCE(${p(eur)},0)>0 OR COALESCE(${p(usd)},0)>0 OR COALESCE(${p(uah)},0)>0 THEN ${selectSource(p(eur), p(usd), p(uah), p(declared))} ELSE ${selectSource(v(eur), v(usd), v(uah), v(declared))} END`;
  };
  const retailDeclared = canonicalSource("priceEur", "priceUsd", "priceUah", "priceSourceCurrency");
  const wholesaleDeclared = canonicalSource(
    "priceEurB2b",
    "priceUsdB2b",
    "priceUahB2b",
    "b2bPriceSourceCurrency"
  );
  const selected =
    context.currency === "EUR"
      ? Prisma.sql`CASE WHEN source.currency = 'EUR' THEN source.amount WHEN source.currency = 'USD' THEN source.amount / ${cross} ELSE source.amount / ${euroSale} END`
      : context.currency === "USD"
        ? Prisma.sql`CASE WHEN source.currency = 'USD' THEN source.amount WHEN source.currency = 'EUR' THEN source.amount * ${cross} ELSE source.amount / ${dollarSale} END`
        : Prisma.sql`CASE WHEN source.currency = 'UAH' THEN source.amount WHEN source.currency = 'USD' THEN source.amount * ${dollarSale} ELSE source.amount * ${euroSale} END`;
  return Prisma.sql`(
    SELECT CASE WHEN source.amount > 0 THEN round((${selected})::numeric, 2) *
      CASE WHEN lower(trim(COALESCE(canonical_product."brand", ''))) = 'wheelforce' AND (canonical_product."tags" @> ARRAY['wheels']::text[] OR lower(trim(COALESCE(canonical_product."productType", ''))) IN ('wheel','wheels')) THEN 4 ELSE 1 END ELSE NULL END
    FROM "ShopProduct" canonical_product
    LEFT JOIN LATERAL (SELECT variant.* FROM "ShopProductVariant" variant WHERE variant."productId" = canonical_product.id ORDER BY variant."isDefault" DESC, variant.position ASC, variant.id ASC LIMIT 1) canonical_variant ON true
    CROSS JOIN LATERAL (SELECT ${retailDeclared} "retailSource", ${wholesaleDeclared} "wholesaleSource", COALESCE(canonical_product."priceEur", canonical_variant."priceEur", 0)::numeric eur,
      COALESCE(canonical_product."priceUsd", canonical_variant."priceUsd", 0)::numeric usd, COALESCE(canonical_product."priceUah", canonical_variant."priceUah", 0)::numeric uah,
      COALESCE(canonical_product."priceEurEurope", canonical_variant."priceEurEurope", 0)::numeric "europeEur",
      COALESCE(canonical_product."priceEurB2b", canonical_variant."priceEurB2b", 0)::numeric "b2bEur", COALESCE(canonical_product."priceUsdB2b", canonical_variant."priceUsdB2b", 0)::numeric "b2bUsd", COALESCE(canonical_product."priceUahB2b", canonical_variant."priceUahB2b", 0)::numeric "b2bUah",
      lower(trim(CASE WHEN lower(trim(COALESCE(canonical_product.vendor,''))) IN ('urban','urban automotive') THEN 'Urban Automotive' ELSE COALESCE(canonical_product.brand,canonical_product.vendor,'') END)) "brandKey") raw
    CROSS JOIN LATERAL (SELECT CASE WHEN ${context.useEuropeBase} AND raw."europeEur" > 0 THEN 'EUR' ELSE (${retailSource}) END currency,
      CASE WHEN ${context.useEuropeBase} AND raw."europeEur" > 0 THEN raw."europeEur" ELSE CASE (${retailSource}) WHEN 'EUR' THEN raw.eur WHEN 'USD' THEN raw.usd + COALESCE((${delivery}),0) WHEN 'UAH' THEN raw.uah ELSE NULL END END amount) base
    CROSS JOIN LATERAL (SELECT CASE WHEN ${JSON.stringify(context.customerBrandDiscounts)}::jsonb ? raw."brandKey" THEN (${JSON.stringify(context.customerBrandDiscounts)}::jsonb ->> raw."brandKey")::numeric WHEN ${JSON.stringify(context.systemBrandDiscounts)}::jsonb ? raw."brandKey" THEN (${JSON.stringify(context.systemBrandDiscounts)}::jsonb ->> raw."brandKey")::numeric WHEN ${Number(context.customerB2BDiscountPercent ?? 0)} > 0 THEN ${Number(context.customerB2BDiscountPercent ?? 0)} ELSE ${Number(context.defaultB2BDiscountPercent ?? 0)} END percent) discount
    CROSS JOIN LATERAL (SELECT CASE WHEN ${context.audience === "b2b"} AND (raw."b2bEur" > 0 OR raw."b2bUsd" > 0 OR raw."b2bUah" > 0) THEN (${wholesaleSource}) ELSE base.currency END currency,
      CASE WHEN ${context.audience === "b2b"} AND (raw."b2bEur" > 0 OR raw."b2bUsd" > 0 OR raw."b2bUah" > 0) THEN CASE (${wholesaleSource}) WHEN 'EUR' THEN raw."b2bEur" WHEN 'USD' THEN raw."b2bUsd" ELSE raw."b2bUah" END
        WHEN ${context.audience === "b2b"} AND discount.percent > 0 THEN round((base.amount * (1 - LEAST(GREATEST(discount.percent,0),100) / 100))::numeric,2) ELSE base.amount END amount) source
    WHERE canonical_product.id = projection."productId" AND canonical_product."isPublished" = true AND canonical_product.status = 'ACTIVE'
  )`;
}
