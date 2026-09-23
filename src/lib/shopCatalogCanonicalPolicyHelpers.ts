import type {
  ShopCatalogV2CompatibilityClause,
  ShopCatalogV2CompatibilityPolicy,
} from "./shopCatalogV2Compatibility";

const TAXONOMY_ALTERNATIVES = ["make", "model", "generation"] as const;
const MAX_CANONICAL_ALTERNATIVES = 4_096;

function requiresIdentityExpansion(clause: ShopCatalogV2CompatibilityClause, dimension: string) {
  const constraint = clause.constraints.find((item) => item.dimension === dimension);
  if (constraint?.state !== "EXACT" || constraint.values.length <= 1) return false;
  if (dimension !== "engine") return true;
  return constraint.values.some(
    (value) => typeof value === "object" && value !== null && "kind" in value && value.kind === "powertrain"
  );
}

/**
 * The canonical SQL schema stores one taxonomy foreign key per value row.
 * Expand alternative MAKE/MODEL/GENERATION values into equivalent OR clauses
 * so each row can retain its own canonical identity without a text/ID collision.
 */
export function expandCanonicalPolicyTaxonomyAlternatives(
  policy: ShopCatalogV2CompatibilityPolicy
): ShopCatalogV2CompatibilityPolicy {
  const clauses: ShopCatalogV2CompatibilityClause[] = [];
  for (const clause of policy.clauses) {
    const dimensions = [
      ...TAXONOMY_ALTERNATIVES,
      ...(requiresIdentityExpansion(clause, "engine") ? ["engine"] : []),
    ];
    let variants = [clause];
    for (const dimension of dimensions) {
      const constraint = clause.constraints.find((item) => item.dimension === dimension);
      if (constraint?.state !== "EXACT" || constraint.values.length <= 1) continue;
      const expanded = variants.flatMap((variant) =>
        constraint.values.map((value) => ({
          ...variant,
          constraints: variant.constraints.map((item) =>
            item.dimension === dimension && item.state === "EXACT"
              ? { ...item, values: [value] }
              : item
          ),
        }))
      );
      if (expanded.length > MAX_CANONICAL_ALTERNATIVES) {
        throw new TypeError(
          `Canonical clause ${clause.id} expands to ${expanded.length} taxonomy alternatives; split the source clause explicitly`
        );
      }
      variants = expanded;
    }
    clauses.push(
      ...variants.map((variant, index) => ({
        ...variant,
        id: variants.length === 1 ? clause.id : `${clause.id}:alternative:${index + 1}`,
      }))
    );
  }
  return { ...policy, clauses };
}
