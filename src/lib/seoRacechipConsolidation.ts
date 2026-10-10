import { resolveShopStorefrontSegment } from "@/lib/shopStorefrontRouting";

/**
 * RaceChip consolidation.
 *
 * RaceChip is one product line sold per engine variant: ~5,200 pages, in ~925
 * make/model-generation groups, whose copy differs only by a few numbers. Search
 * Console reports most of them as "crawled, not indexed", and thousands of
 * near-identical pages drag down how Google rates the whole site.
 *
 * Rule: inside each make + model group one variant (the most powerful engine)
 * stays indexable; the others answer `noindex, follow` and are left out of the
 * sitemap. They remain fully usable for customers (filter, catalog and
 * pagination links still reach them), and `follow` keeps link equity flowing.
 */

/** Variants per make/model group that stay in the index. */
export const RACECHIP_INDEXED_VARIANTS_PER_MODEL = 1;

export type RacechipConsolidationRow = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: readonly string[] | null;
};

function tagValue(tags: readonly string[] | null | undefined, prefix: string): string | null {
  const found = tags?.find((tag) => tag.startsWith(prefix));
  const value = found?.slice(prefix.length).trim().toLowerCase();
  return value ? value : null;
}

/** `make|model` of a RaceChip variant, or null when its tags are incomplete. */
export function resolveRacechipModelGroupKey(row: RacechipConsolidationRow): string | null {
  const make = tagValue(row.tags, "car_make:");
  const model = tagValue(row.tags, "car_model:");
  if (!make || !model) return null;
  return `${make}|${model}`;
}

/** Engine output in hp from the slug (`...-177hp-130kw-380nm`), 0 when absent. */
export function resolveRacechipPower(row: RacechipConsolidationRow): number {
  const engine = tagValue(row.tags, "car_engine:") ?? "";
  const match = /(\d{2,4})hp/.exec(engine) ?? /(\d{2,4})hp/.exec(row.slug);
  return match ? Number(match[1]) : 0;
}

export function isRacechipRow(row: RacechipConsolidationRow): boolean {
  return (
    resolveShopStorefrontSegment({
      brand: row.brand,
      vendor: row.vendor,
      tags: row.tags ? [...row.tags] : [],
    }) === "racechip"
  );
}

/**
 * Slugs that must be `noindex`. Anything that cannot be grouped (incomplete
 * tags, not RaceChip) is never in the set, so the default is "indexable".
 */
export function computeRacechipNoindexSlugs(
  rows: readonly RacechipConsolidationRow[],
  options: { indexedPerModel?: number } = {}
): Set<string> {
  const keep = Math.max(1, options.indexedPerModel ?? RACECHIP_INDEXED_VARIANTS_PER_MODEL);

  const groups = new Map<string, RacechipConsolidationRow[]>();
  for (const row of rows) {
    if (!row.slug || !isRacechipRow(row)) continue;
    const key = resolveRacechipModelGroupKey(row);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const noindex = new Set<string>();
  for (const bucket of groups.values()) {
    if (bucket.length <= keep) continue;
    const ranked = [...bucket].sort(
      (a, b) => resolveRacechipPower(b) - resolveRacechipPower(a) || a.slug.localeCompare(b.slug)
    );
    for (const row of ranked.slice(keep)) noindex.add(row.slug);
  }
  return noindex;
}
