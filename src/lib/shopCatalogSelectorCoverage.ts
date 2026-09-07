import type {
  ShopCatalogProjectionBuild,
  ShopCatalogProjectionConstraintValue,
} from "./shopCatalogProjection.server";
import type {
  ShopCatalogV2CompatibilityPolicy as Policy,
  ShopCatalogV2CompatibilityValue as Value,
  ShopCatalogV2CompatibilityConstraint as Constraint,
} from "./shopCatalogV2Compatibility";

/** Offline evidence only. Compare whole clauses, never independent dimension sets. */
export function compareSelectorCoverage(
  expected: readonly Policy[],
  actual: readonly Policy[],
  options: { canonicalIdentity?: boolean; policyRules?: boolean; clauseIdentity?: boolean } = {}
) {
  function valueKey(value: Value): string {
    if (typeof value === "string") return JSON.stringify(value.trim());
    if (typeof value !== "object") return JSON.stringify(value);
    if ("kind" in value)
      return options.canonicalIdentity
        ? JSON.stringify(["powertrain", value.powertrainId, value.code.trim()])
        : JSON.stringify(value.code.trim());
    return JSON.stringify(["year", value.from, value.to]);
  }
  function signatures(policies: readonly Policy[]) {
    return policies.flatMap((policy) => {
      const owner = [policy.target.productId, policy.target.variantId ?? null];
      const metadata = JSON.stringify([
        owner,
        policy.mode,
        policy.parentTarget
          ? [policy.parentTarget.productId, policy.parentTarget.variantId ?? null]
          : null,
        options.policyRules ? [...policy.requiredDimensions].sort() : null,
        options.policyRules ? Object.entries(policy.dimensionDefaults ?? {}).sort() : null,
      ]);
      return [
        metadata,
        ...policy.clauses.map((clause) =>
          JSON.stringify([
            owner,
            clause.verification,
            clause.sourceRef ?? null,
            options.clauseIdentity ? clause.id : null,
            clause.constraints
              .map((constraint) =>
                JSON.stringify([
                  constraint.dimension,
                  constraint.state,
                  constraint.state === "EXACT" ? constraint.values.map(valueKey).sort() : [],
                ])
              )
              .sort(),
          ])
        ),
      ];
    });
  }
  const missing = new Map<string, number>();
  for (const signature of signatures(expected))
    missing.set(signature, (missing.get(signature) ?? 0) + 1);
  const extra: string[] = [];
  for (const signature of signatures(actual)) {
    const remaining = missing.get(signature) ?? 0;
    if (remaining) missing.set(signature, remaining - 1);
    else extra.push(signature);
  }
  const lost = [...missing].flatMap(([signature, count]) => Array<string>(count).fill(signature));
  return {
    passed: lost.length === 0 && extra.length === 0,
    missingCount: lost.length,
    extraCount: extra.length,
    // Reports stay bounded even when an entire source is damaged.
    missing: lost.slice(0, 10),
    extra: extra.slice(0, 10),
  };
}

function fromProjectionValue(value: ShopCatalogProjectionConstraintValue): Value {
  switch (value.kind) {
    case "text":
      return value.text;
    case "powertrain":
      return { kind: "powertrain", powertrainId: value.powertrainId, code: value.text };
    case "number":
      return value.number;
    case "boolean":
      return value.boolean;
    case "year_range":
      return { from: value.yearFrom, to: value.yearTo };
  }
}

/** Reconstructs the actual builder output, checking owner/version and orphan rows. */
export function selectorPoliciesFromProjection(build: ShopCatalogProjectionBuild): Policy[] {
  const targetKey = (row: { productId: string; variantId: string | null }) =>
    JSON.stringify([row.productId, row.variantId]);
  const clauseKey = (row: { productId: string; variantId: string | null; clauseId: string }) =>
    JSON.stringify([row.productId, row.variantId, row.clauseId]);
  for (const row of [
    ...build.compatibilityPolicies,
    ...build.compatibilityClauses,
    ...build.compatibilityConstraints,
  ]) {
    if (row.productId !== build.productId || row.sourceVersion !== build.sourceVersion)
      throw new Error("Selector projection owner/version mismatch");
  }
  const policies = new Map<string, Policy>();
  const clauses = new Map<string, Policy["clauses"][number]>();
  for (const row of build.compatibilityPolicies) {
    if (policies.has(targetKey(row))) throw new Error("Duplicate selector projection policy");
    const owned = build.compatibilityClauses.filter(
      (clause) => targetKey(clause) === targetKey(row)
    );
    if (owned.length !== row.clauseCount)
      throw new Error("Selector projection clause count mismatch");
    policies.set(targetKey(row), {
      version: 2,
      mode: row.mode,
      target: { productId: row.productId, variantId: row.variantId },
      parentTarget: row.parentProductId
        ? { productId: row.parentProductId, variantId: row.parentVariantId }
        : null,
      requiredDimensions: row.requiredDimensions,
      dimensionDefaults: Object.fromEntries(
        row.dimensionDefaults.map(({ dimension, state }) => [dimension, state])
      ),
      clauses: owned.map((clause) => {
        if (clauses.has(clauseKey(clause))) throw new Error("Duplicate selector projection clause");
        const constraints = new Map<string, (typeof build.compatibilityConstraints)[number][]>();
        for (const value of build.compatibilityConstraints.filter(
          (value) => clauseKey(value) === clauseKey(clause)
        )) {
          const group = constraints.get(value.dimension) ?? [];
          group.push(value);
          constraints.set(value.dimension, group);
        }
        const result = {
          id: clause.clauseId,
          verification: clause.verification,
          sourceRef: clause.sourceRef,
          constraints: [...constraints.values()].map((values): Constraint => {
            const first = values[0];
            if (values.some((value) => value.state !== first.state))
              throw new Error("Mixed selector constraint states");
            if (first.state !== "EXACT") {
              if (values.length !== 1 || first.value !== null)
                throw new Error("Invalid non-exact selector constraint");
              return { dimension: first.dimension, state: first.state };
            }
            const ordered = [...values].sort(
              (left, right) => left.valueOrdinal - right.valueOrdinal
            );
            return {
              dimension: first.dimension,
              state: "EXACT",
              values: ordered.map((value, index) => {
                if (value.value === null || value.valueOrdinal !== index)
                  throw new Error("Invalid exact selector value/ordinal");
                return fromProjectionValue(value.value);
              }),
            };
          }),
        };
        clauses.set(clauseKey(clause), result);
        return result;
      }),
    });
  }
  if (
    clauses.size !== build.compatibilityClauses.length ||
    build.compatibilityConstraints.some((row) => !clauses.has(clauseKey(row)))
  )
    throw new Error("Orphan selector projection row");
  return [...policies.values()];
}
