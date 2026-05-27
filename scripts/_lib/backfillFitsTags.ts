/**
 * Shared util for back-filling `fits-*` vehicle-fitment tags on
 * ShopProduct rows. Mirrors REMUS importer (`scripts/import-remus-catalog.ts`)
 * so the B2B portal's /shop/stock filter sees a uniform tag-shape across
 * every brand.
 *
 * Tag forms emitted:
 *   fits-make:<makeSlug>                       e.g. fits-make:bmw
 *   fits-model:<makeSlug>:<modelSlug>          e.g. fits-model:bmw:m2
 *   fits-trim:<makeSlug>:<modelSlug>:<trim>    e.g. fits-trim:bmw:m2:competition
 *   fits-year:<yyyy>                           e.g. fits-year:2024
 *   fits:<make>-<model>                        back-compat flat tag
 *
 * Caller hands us a `VehicleFitment[]` (one product may fit multiple
 * vehicles) — we expand into a flat Set<string>.
 */

export type VehicleFitment = {
  make: string;
  model?: string | null;
  /** Body / chassis / trim variant — e.g. "F87", "Competition", "GTI". */
  trim?: string | null;
  /** Single year, or omit. */
  year?: number | null;
};

/**
 * Lower-case + strip diacritics + replace non-alnum runs with `-`.
 * Mirrors `slugify()` in `scripts/import-remus-catalog.ts`. Tags are
 * compared by string equality so even small drift between brands would
 * break filtering.
 */
export function slugify(input: string | null | undefined): string {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

/**
 * Build the complete set of `fits-*` tags for one product from its list
 * of compatible vehicles. De-duped automatically via Set.
 *
 * Empty fitments → empty set (caller can skip writing).
 */
export function buildFitsTagSet(fitments: readonly VehicleFitment[]): Set<string> {
  const out = new Set<string>();
  for (const f of fitments) {
    const make = slugify(f.make);
    if (!make) continue;
    out.add(`fits-make:${make}`);

    const model = slugify(f.model);
    if (model) {
      out.add(`fits-model:${make}:${model}`);
      out.add(`fits:${make}-${model}`); // back-compat flat
    }

    const trim = slugify(f.trim);
    if (model && trim) {
      out.add(`fits-trim:${make}:${model}:${trim}`);
    }

    if (typeof f.year === "number" && f.year > 1900 && f.year < 2100) {
      out.add(`fits-year:${f.year}`);
    }
  }
  return out;
}

/**
 * Returns a new tags array that:
 *   1. Preserves every existing tag verbatim (other prefixes like
 *      `car_make:`, `chassis:`, `store:`, `audience:` stay intact).
 *   2. Adds every tag in `newFits` that isn't already present.
 *
 * If nothing was added, returns the original reference (caller may
 * compare by identity to skip the UPDATE).
 */
export function mergeFitsTagsIntoExisting(
  existing: readonly string[],
  newFits: ReadonlySet<string>
): string[] {
  const existingSet = new Set(existing);
  let added = 0;
  for (const t of newFits) {
    if (!existingSet.has(t)) {
      existingSet.add(t);
      added++;
    }
  }
  if (added === 0) return existing as string[];
  // Preserve original ordering, append additions deterministically.
  const additions: string[] = [];
  for (const t of newFits) {
    if (!existing.includes(t)) additions.push(t);
  }
  return [...existing, ...additions];
}

/**
 * Inverse: scan an existing tags array, return the subset that look like
 * `fits-*` tags (for diff/audit logging).
 */
export function pickExistingFitsTags(tags: readonly string[]): string[] {
  return tags.filter(
    (t) =>
      t.startsWith("fits-make:") ||
      t.startsWith("fits-model:") ||
      t.startsWith("fits-trim:") ||
      t.startsWith("fits-year:") ||
      t.startsWith("fits:")
  );
}
