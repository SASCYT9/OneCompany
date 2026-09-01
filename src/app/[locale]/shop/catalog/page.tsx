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
  const [result, facetResult] = await Promise.all([
    queryShopCatalogProjection(query),
    queryShopCatalogProjectionFacets(query),
  ]);

  return (
    <CatalogV2Server
      locale={resolvedLocale}
      result={result}
      facets={facetResult.facets}
      query={query}
    />
  );
}
