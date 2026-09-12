import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { resolveLocale } from "@/lib/seo";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { searchShopStock } from "@/lib/shopStockSearch.server";
import {
  buildStockInitialSearch,
  stockPageSearchParams,
  stockSearchCacheKey,
  type StockPageSearchParams,
} from "@/lib/shopStockInitialSearch";
import type { StockSearchResponse } from "@/lib/shopStockSearchTypes";
import StockCatalogClient from "./StockCatalogClient";

export { generateMetadata } from "../catalog/metadata";

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<StockPageSearchParams>;
}) {
  // Only this catalog becomes request-rendered. Customer prices must never be
  // stored in a shared HTML/ISR cache; other storefront routes keep their ISR.
  await connection();
  const [{ locale }, query, settings, session] = await Promise.all([
    params,
    searchParams,
    getPublicShopSettingsRuntime(),
    getCurrentShopCustomerSession(),
  ]);
  const resolvedLocale = resolveLocale(locale);
  const request = buildStockInitialSearch(
    stockPageSearchParams(query),
    resolvedLocale,
    settings.defaultCurrency
  );
  // Reuse the API's exact reader, session and pricing pipeline in-process.
  // Do not perform an HTTP fetch back into this deployment.
  const response = await searchShopStock({
    url: `https://onecompany.global/api/shop/stock/search?${request}`,
  });
  if (!response.ok) throw new Error("Catalog initial search unavailable");
  const data = (await response.json()) as StockSearchResponse;
  if (!Array.isArray(data.data)) throw new Error("Catalog initial search response invalid");
  if (Number(request.get("page")) > (data.meta?.totalPages || 1)) notFound();

  const audienceKey = JSON.stringify([session?.email ?? "", session?.group ?? ""]);
  return (
    <StockCatalogClient
      initialData={{
        response: data,
        requestKey: `${audienceKey}|${stockSearchCacheKey(request)}`,
        audienceKey,
        isB2B: session?.group === "B2B_APPROVED",
      }}
    />
  );
}
