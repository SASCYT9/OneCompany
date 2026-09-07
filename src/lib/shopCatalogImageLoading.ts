/**
 * Loading policy for catalog card media.
 *
 * A catalog is a single-column list on small screens, so preloading several
 * cards wastes bandwidth before the customer can see them. Keep exactly one
 * image eager for the LCP candidate and let the browser schedule the rest
 * with native lazy loading as the user approaches them.
 */
export function getShopCatalogImageLoading(index: number) {
  const isFirstCard = Number.isInteger(index) && index === 0;

  return {
    preload: isFirstCard,
    loading: isFirstCard ? ("eager" as const) : ("lazy" as const),
  };
}
