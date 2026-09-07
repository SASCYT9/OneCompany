import type { ShopCatalogStorefrontQuery } from "./shopCatalogStorefrontQuery";
import type { ShopCatalogProjectionQueryResult } from "./shopCatalogProjectionQuery.server";

export function nextPageHref(
  locale: "ua" | "en",
  query: ShopCatalogStorefrontQuery,
  result: ShopCatalogProjectionQueryResult
) {
  if (!result.hasMore) return null;
  if (query.order === "default" && !result.nextCursor) return null;
  // The public query parser caps page numbers at 10,000.
  if (query.order !== "default" && query.page >= 10_000) return null;
  const params = new URLSearchParams();
  const strings: Array<[string, string | null | undefined]> = [
    ["q", query.text],
    ["scope", query.scope],
    ["category", query.category],
    ["make", query.make],
    ["model", query.model],
    ["generation", query.generation],
    ["engine", query.engine],
    ["fuel", query.fuel],
    ["opfGpf", query.opfGpf],
    ["stock", query.stock],
    ["productType", query.productType],
    ["productKind", query.productKind],
    ["sort", query.order],
    ["currency", query.priceCurrency],
    ["facetMode", query.facetMode],
    ["country", query.country],
    ["limit", query.limit == null ? null : String(query.limit)],
  ];
  const brands = query.brands ?? [];
  if (brands.length) {
    for (const brand of brands) params.append("brand", brand);
  } else if (query.brand) {
    params.set("brand", query.brand);
  }
  if (query.useEuropePrice) params.set("europePrice", "1");
  if (query.strict) params.set("strict", "1");
  if (query.minPrice != null) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice != null) params.set("maxPrice", String(query.maxPrice));
  for (const [key, value] of strings) if (value) params.set(key, value);
  if (query.year != null) params.set("year", String(query.year));
  if (query.order === "default" && result.nextCursor) {
    params.set("afterRank", result.nextCursor.stableRank);
    params.set("afterProduct", result.nextCursor.productId);
  } else {
    params.set("page", String(query.page + 1));
  }
  return `/${locale}/shop/catalog?${params.toString()}`;
}
