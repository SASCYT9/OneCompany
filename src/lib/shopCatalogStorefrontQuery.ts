import type { ShopCatalogProjectionQueryInput } from "./shopCatalogProjectionQuery.server";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bounded(value: string | string[] | undefined, max = 320) {
  const normalized = first(value)?.trim() ?? "";
  return normalized && normalized.length <= max ? normalized : null;
}

export function parseShopCatalogStorefrontQuery(
  locale: "ua" | "en",
  params: CatalogSearchParams
): ShopCatalogProjectionQueryInput {
  const yearValue = bounded(params.year, 4);
  const year = yearValue && /^\d{4}$/.test(yearValue) ? Number(yearValue) : null;
  const afterRank = bounded(params.afterRank, 64);
  const afterProduct = bounded(params.afterProduct, 191);
  const after =
    afterRank && afterProduct && /^-?\d+(?:\.\d+)?$/.test(afterRank)
      ? { stableRank: afterRank, productId: afterProduct }
      : null;

  return Object.freeze({
    locale,
    limit: 24,
    after,
    text: bounded(params.q, 256),
    scope: bounded(params.scope),
    brand: bounded(params.brand),
    category: bounded(params.category),
    make: bounded(params.make),
    model: bounded(params.model),
    generation: bounded(params.generation),
    year: year && year >= 1886 && year <= 2200 ? year : null,
    engine: bounded(params.engine),
    fuel: bounded(params.fuel),
  });
}
