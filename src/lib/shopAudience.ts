/**
 * Audience-gating tags for ShopProduct.
 *
 * Mirrors the tag-prefix convention used by `shopProductStorefront.ts`
 * (`store:*`), but for visibility rather than storefront grouping.
 *
 *   - `audience:b2b`   — visible ONLY at `/shop/stock` (B2B dealer portal).
 *                        Hidden from every public listing (brand-shops,
 *                        main catalog, search, sitemap, structured data).
 *                        Toggle by adding/removing the tag — no schema
 *                        change required.
 *
 * The B2B portal (`/api/shop/stock/search`) intentionally does NOT
 * filter on this tag — it's the one place these products are surfaced.
 * Every other catalog read goes through `shopCatalogServer.ts` helpers
 * that merge `b2bOnlyExcludeWhere()` into the Prisma `where`.
 */

export const AUDIENCE_TAG_PREFIX = "audience:";
export const B2B_ONLY_TAG = "audience:b2b";

function normalize(tag: string | null | undefined): string {
  return String(tag ?? "")
    .trim()
    .toLowerCase();
}

export function isB2bOnly(tags: readonly string[] | null | undefined): boolean {
  if (!tags) return false;
  for (const t of tags) {
    if (normalize(t) === B2B_ONLY_TAG) return true;
  }
  return false;
}

export function stripAudienceTags(tags: readonly string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => String(tag ?? "").trim())
        .filter((tag) => tag && !tag.toLowerCase().startsWith(AUDIENCE_TAG_PREFIX))
    )
  );
}

export function withB2bOnlyTag(tags: readonly string[] | null | undefined): string[] {
  return Array.from(new Set([...stripAudienceTags(tags), B2B_ONLY_TAG]));
}

/**
 * Prisma `where` fragment that excludes products tagged `audience:b2b`.
 * Spread it into any public-facing catalog query:
 *
 *   prisma.shopProduct.findMany({
 *     where: { isPublished: true, ...b2bOnlyExcludeWhere() },
 *   });
 *
 * `NOT { tags: { has: ... } }` translates to a Postgres `NOT (tags @> ARRAY[...])`
 * predicate against the `text[]` column — index-friendly because GIN
 * indexes on text[] support array containment.
 */
export function b2bOnlyExcludeWhere() {
  return { NOT: { tags: { has: B2B_ONLY_TAG } } } as const;
}
