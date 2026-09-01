import { connection } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import {
  queryShopCatalogProjection,
  queryShopCatalogProjectionFacets,
} from "@/lib/shopCatalogProjectionQuery.server";
import {
  resolveShopCatalogReaderFlag,
  isShopCatalogReaderRequestEnabled,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import {
  parseShopCatalogStorefrontQuery,
  type CatalogSearchParams,
} from "@/lib/shopCatalogStorefrontQuery";
import { resolveLocale } from "@/lib/seo";
import { observeShopCatalogRead } from "@/lib/shopCatalogReadTelemetry";
import { getShopCatalogCardPricingByIds } from "@/lib/shopCatalogCardPricing.server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { prisma } from "@/lib/prisma";
import CatalogV2Server from "./CatalogV2Server";

export { generateMetadata } from "./metadata";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
};

export default async function CatalogPage({ params, searchParams }: Props) {
  const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
  const requestHeaders = reader.mode === "canary" ? await headers() : null;
  if (!isShopCatalogReaderRequestEnabled(reader, requestHeaders?.get(SHOP_CATALOG_CANARY_REQUEST_HEADER))) {
    // Normal requests are internally rewritten by next.config. This is a
    // fail-closed fallback for direct route-module invocation only.
    redirect(`/${(await params).locale}/shop/stock`);
  }

  // Opt into request-time rendering only for the explicit V2 reader. The
  // flag-off legacy branch remains eligible for its existing static caching.
  await connection();
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const resolvedLocale = resolveLocale(locale);
  const query = parseShopCatalogStorefrontQuery(resolvedLocale, filters);
  const [listingRead, facetRead, session] = await Promise.all([
    observeShopCatalogRead({
      operation: "listing", locale: resolvedLocale, filters: query, databaseQueriesUpperBound: 1,
      rows: (value) => value.items.length, execute: () => queryShopCatalogProjection(query),
    }),
    observeShopCatalogRead({
      operation: "facets", locale: resolvedLocale, filters: query, databaseQueriesUpperBound: 1,
      rows: (value) => Object.values(value.facets).reduce((sum, rows) => sum + rows.length, 0),
      execute: () => queryShopCatalogProjectionFacets(query),
    }),
    getCurrentShopCustomerSession(),
  ]);
  const result = listingRead.value;
  const facetResult = facetRead.value;
  // Projection rows keep discovery fast, while this single bounded canonical
  // read makes admin price edits visible immediately and preserves regional /
  // B2B bands that deliberately do not belong in the public search index.
  const pricingRead = await observeShopCatalogRead({
    operation: "pricing",
    locale: resolvedLocale,
    filters: query,
    // Canonical products (1), settings read/create (up to 2), system rules
    // (1), and authenticated customer rules (1).
    databaseQueriesUpperBound: 5,
    rows: (value) => value[0].length,
    execute: () =>
      Promise.all([
        getShopCatalogCardPricingByIds(result.items.map((item) => item.productId)),
        getOrCreateShopSettings(prisma),
        prisma.shopBrandB2bDiscount.findMany({ select: { brand: true, discountPct: true } }),
        session
          ? prisma.shopCustomerBrandDiscount.findMany({
              where: { customerId: session.customerId },
              select: { brand: true, discountPct: true },
            })
          : Promise.resolve([]),
      ]),
  });
  const [canonicalProducts, settingsRecord, systemBrandDiscounts, customerBrandDiscounts] =
    pricingRead.value;
  const pricingContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null,
    {
      systemBrandDiscountMap: new Map(
        systemBrandDiscounts.map((row) => [row.brand.trim().toLowerCase(), Number(row.discountPct)])
      ),
      customerBrandDiscountMap: new Map(
        customerBrandDiscounts.map((row) => [row.brand.trim().toLowerCase(), Number(row.discountPct)])
      ),
    }
  );
  const cardPrices = Object.fromEntries(
    canonicalProducts.map((product) => [
      product.productId,
      {
        price: product.price,
        europePrice: product.europePrice ?? null,
        b2bPrice: product.b2bPrice ?? null,
        compareAt: product.compareAt ?? null,
        b2bCompareAt: product.b2bCompareAt ?? null,
        brand: product.brand,
      },
    ])
  );

  return (
    <CatalogV2Server
      locale={resolvedLocale}
      result={result}
      facets={facetResult.facets}
      query={query}
      cardPrices={cardPrices}
      pricingContext={pricingContext}
    />
  );
}
