export type ShopCatalogReadOperation = "listing" | "facets" | "suggestions";

export type ShopCatalogReadMetric = Readonly<{
  event: "catalog_v2_read";
  operation: ShopCatalogReadOperation;
  outcome: "success" | "error";
  durationMs: number;
  locale: "ua" | "en";
  filterDimensions: readonly string[];
  rowsReturned: number | null;
  databaseQueriesUpperBound: number;
  errorType: string | null;
}>;

export function shopCatalogFilterDimensions(input: Record<string, unknown>) {
  return Object.freeze(
    ["text", "scope", "brand", "category", "make", "model", "generation", "year", "engine", "fuel", "after"]
      .filter((key) => input[key] !== null && input[key] !== undefined && input[key] !== "" && input[key] !== false)
  );
}

export async function observeShopCatalogRead<T>(input: {
  operation: ShopCatalogReadOperation;
  locale: "ua" | "en";
  filters: Record<string, unknown>;
  databaseQueriesUpperBound: number;
  rows: (value: T) => number;
  execute: () => Promise<T>;
  now?: () => number;
  log?: (metric: ShopCatalogReadMetric) => void;
}) {
  const now = input.now ?? (() => performance.now());
  const startedAt = now();
  const dimensions = shopCatalogFilterDimensions(input.filters);
  try {
    const value = await input.execute();
    const metric: ShopCatalogReadMetric = Object.freeze({
      event: "catalog_v2_read",
      operation: input.operation,
      outcome: "success",
      durationMs: Math.max(0, Math.round((now() - startedAt) * 1000) / 1000),
      locale: input.locale,
      filterDimensions: dimensions,
      rowsReturned: input.rows(value),
      databaseQueriesUpperBound: input.databaseQueriesUpperBound,
      errorType: null,
    });
    (input.log ?? console.info)(metric);
    return Object.freeze({ value, metric });
  } catch (error) {
    const metric: ShopCatalogReadMetric = Object.freeze({
      event: "catalog_v2_read",
      operation: input.operation,
      outcome: "error",
      durationMs: Math.max(0, Math.round((now() - startedAt) * 1000) / 1000),
      locale: input.locale,
      filterDimensions: dimensions,
      rowsReturned: null,
      databaseQueriesUpperBound: input.databaseQueriesUpperBound,
      errorType: error instanceof Error ? error.name.slice(0, 80) : "UnknownError",
    });
    (input.log ?? console.error)(metric);
    throw error;
  }
}

export function shopCatalogServerTiming(metric: ShopCatalogReadMetric) {
  return `catalog-v2-${metric.operation};dur=${metric.durationMs.toFixed(3)}`;
}
