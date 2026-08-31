export type ShopCatalogLiveShadowPageComparison = {
  parity: boolean;
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
  const parity =
    missingProductIds.length === 0 &&
    unexpectedProductIds.length === 0 &&
    orderMismatchCount === 0 &&
    input.legacyHasMore === input.projectionHasMore;

  return Object.freeze({
    parity,
    legacyCount: input.legacyProductIds.length,
    projectionCount: input.projectionProductIds.length,
    legacyHasMore: input.legacyHasMore,
    projectionHasMore: input.projectionHasMore,
    missingProductIds: Object.freeze(missingProductIds.slice(0, DIFFERENCE_SAMPLE_LIMIT)),
    unexpectedProductIds: Object.freeze(unexpectedProductIds.slice(0, DIFFERENCE_SAMPLE_LIMIT)),
    orderMismatchCount,
  });
}
