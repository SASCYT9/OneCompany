import { isRacechipRow, resolveRacechipModelGroupKey } from "@/lib/seoRacechipConsolidation";
import {
  buildShopStorefrontProductPath,
  resolveShopStorefrontSegment,
} from "@/lib/shopStorefrontRouting";
import { getStorefrontRoute } from "@/lib/storefrontRouteRegistry";

export type RevalidationProduct = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
};

export function buildShopStorefrontRevalidationPlan(
  products: readonly RevalidationProduct[],
  detailOnly = false
) {
  const paths = new Map<string, { path: string; type?: "page" }>();
  const tags = new Set<string>();
  const add = (path: string, type?: "page") => paths.set(`${type ?? ""}:${path}`, { path, type });
  for (const product of products) {
    const segment = resolveShopStorefrontSegment(product);
    for (const locale of ["ua", "en"] as const) {
      add(buildShopStorefrontProductPath(locale, product));
      add(`/${locale}/shop/${product.slug}`);
      if (detailOnly || !segment) continue;
      const route = getStorefrontRoute(segment);
      const basePath = `/${locale}/shop/${segment}/${route.listingSurface}`;
      add(basePath);
      if (route.paginated) add(`${basePath}/page/[page]`, "page");
    }
    if (!detailOnly) {
      tags.add("shop-products");
      if (segment) tags.add(`shop-products:${segment}`);
    }
  }
  return { paths: [...paths.values()], tags: [...tags] };
}

/** `make|model` keys of the RaceChip groups a mutation can change. */
function collectRacechipGroupKeys(products: readonly RevalidationProduct[]): Set<string> {
  const keys = new Set<string>();
  for (const product of products) {
    if (!isRacechipRow(product)) continue;
    const key = resolveRacechipModelGroupKey(product);
    if (key) keys.add(key);
  }
  return keys;
}

/** True when the batch touches a RaceChip product that belongs to a model group. */
export function affectsRacechipGroups(products: readonly RevalidationProduct[]): boolean {
  return collectRacechipGroupKeys(products).size > 0;
}

/**
 * PDP paths of every other member of the RaceChip model groups the mutated
 * products belong to.
 *
 * Exactly one variant per group stays indexable (see seoRacechipConsolidation),
 * so publishing, archiving or re-tagging one product can flip the robots
 * metadata of a sibling. PDPs are ISR pages, so without this a sibling that
 * just became the representative would keep answering `noindex` until its own
 * 24-hour window ended. `catalogRows` is the current published catalog; paths
 * already in `alreadyPlanned` are skipped.
 */
export function buildRacechipSiblingRevalidationPaths(
  products: readonly RevalidationProduct[],
  catalogRows: readonly RevalidationProduct[],
  alreadyPlanned: ReadonlySet<string> = new Set()
): string[] {
  const keys = collectRacechipGroupKeys(products);
  if (keys.size === 0) return [];

  const paths = new Set<string>();
  for (const row of catalogRows) {
    if (!row.slug || !isRacechipRow(row)) continue;
    const key = resolveRacechipModelGroupKey(row);
    if (!key || !keys.has(key)) continue;
    for (const locale of ["ua", "en"] as const) {
      for (const path of [
        buildShopStorefrontProductPath(locale, row),
        `/${locale}/shop/${row.slug}`,
      ]) {
        if (!alreadyPlanned.has(path)) paths.add(path);
      }
    }
  }
  return [...paths];
}
