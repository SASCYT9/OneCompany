export type ShopCatalogLiveShadowPageComparison = {
  parity: boolean;
  comparisonCompleteness: "complete_result_set" | "bounded_window";
  legacyCount: number;
  projectionCount: number;
  legacyHasMore: boolean;
  projectionHasMore: boolean;
  missingProductIds: readonly string[];
  unexpectedProductIds: readonly string[];
  orderMismatchCount: number;
};

const DIFFERENCE_SAMPLE_LIMIT = 25;

export function compareShopCatalogLiveShadowPage(input: {
  legacyProductIds: readonly string[];
  projectionProductIds: readonly string[];
  legacyHasMore: boolean;
  projectionHasMore: boolean;
}): ShopCatalogLiveShadowPageComparison {
  const legacySet = new Set(input.legacyProductIds);
  const projectionSet = new Set(input.projectionProductIds);
  const missingProductIds = input.legacyProductIds.filter((id) => !projectionSet.has(id));
  const unexpectedProductIds = input.projectionProductIds.filter((id) => !legacySet.has(id));
  const maxLength = Math.max(input.legacyProductIds.length, input.projectionProductIds.length);
  let orderMismatchCount = 0;
  for (let index = 0; index < maxLength; index += 1) {
    if (input.legacyProductIds[index] !== input.projectionProductIds[index]) {
      orderMismatchCount += 1;
    }
  }
  const comparisonCompleteness =
    !input.legacyHasMore && !input.projectionHasMore ? "complete_result_set" : "bounded_window";
  // Ranking is deliberately allowed to evolve in Catalog V2. When both
  // readers returned the complete result set, compare identities without
  // treating a different (and potentially better) order as data loss. For a
  // truncated window, only continuation and page cardinality are knowable:
  // different first-page identities can be caused solely by ranking.
  const parity =
    input.legacyHasMore === input.projectionHasMore &&
    input.legacyProductIds.length === input.projectionProductIds.length &&
    (comparisonCompleteness === "bounded_window" ||
      (missingProductIds.length === 0 && unexpectedProductIds.length === 0));

  return Object.freeze({
    parity,
    comparisonCompleteness,
    legacyCount: input.legacyProductIds.length,
    projectionCount: input.projectionProductIds.length,
    legacyHasMore: input.legacyHasMore,
    projectionHasMore: input.projectionHasMore,
    missingProductIds: Object.freeze(missingProductIds.slice(0, DIFFERENCE_SAMPLE_LIMIT)),
    unexpectedProductIds: Object.freeze(unexpectedProductIds.slice(0, DIFFERENCE_SAMPLE_LIMIT)),
    orderMismatchCount,
  });
}
