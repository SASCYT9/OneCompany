import type {
  ShopCatalogProjectionBuild,
  ShopCatalogProjectionConstraintValue,
} from "./shopCatalogProjection.server";
import type {
  ShopCatalogV2CompatibilityPolicy as Policy,
  ShopCatalogV2CompatibilityValue as Value,
  ShopCatalogV2CompatibilityConstraint as Constraint,
  ShopCatalogV2CompatibilityDimension as Dimension,
} from "./shopCatalogV2Compatibility";
import { SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS } from "./shopCatalogV2Compatibility";

type SelectorDimensionStateCounts = {
  exactClauses: number;
  verifiedExactClauses: number;
  inferredExactClauses: number;
  reviewExactClauses: number;
  anyClauses: number;
  notApplicableClauses: number;
  unknownClauses: number;
  missingClauses: number;
};

type SelectorMakeCoverage = {
  make: string;
  clauses: number;
  verifiedCoreIdentityClauses: number;
  reviewOrInferredCoreIdentityClauses: number;
  selectorEligibleCoreIdentityClauses: number;
  blockedByUnknownDimensionClauses: number;
  blockedByPolicyModeClauses: number;
  models: string[];
  generations: string[];
};

/** Summarizes which exact selector facts survive policy-level blockers. */
export function summarizeSelectorDimensionCoverage(policies: readonly Policy[]) {
  const dimensions = Object.fromEntries(
    SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension) => [
      dimension,
      {
        exactClauses: 0,
        verifiedExactClauses: 0,
        inferredExactClauses: 0,
        reviewExactClauses: 0,
        anyClauses: 0,
        notApplicableClauses: 0,
        unknownClauses: 0,
        missingClauses: 0,
      } satisfies SelectorDimensionStateCounts,
    ])
  ) as Record<Dimension, SelectorDimensionStateCounts>;
  const coreDimensions = new Set<Dimension>(["scope", "make", "model", "generation", "chassis"]);
  const makeCoverage = new Map<
    string,
    {
      clauses: number;
      verifiedCoreIdentityClauses: number;
      reviewOrInferredCoreIdentityClauses: number;
      selectorEligibleCoreIdentityClauses: number;
      blockedByUnknownDimensionClauses: number;
      blockedByPolicyModeClauses: number;
      models: Set<string>;
      generations: Set<string>;
    }
  >();
  const scopeCoverage = new Map<string, number>();
  let clauses = 0;
  let verifiedClauses = 0;
  let inferredClauses = 0;
  let reviewClauses = 0;
  let policiesWithUnknownDefaults = 0;

  for (const policy of policies) {
    const defaults = policy.dimensionDefaults ?? {};
    const hasUnknownDefault = Object.values(defaults).some((state) => state === "UNKNOWN");
    if (hasUnknownDefault) policiesWithUnknownDefaults += 1;

    for (const clause of policy.clauses) {
      clauses += 1;
      if (clause.verification === "VERIFIED") verifiedClauses += 1;
      else if (clause.verification === "INFERRED") inferredClauses += 1;
      else reviewClauses += 1;

      const constraintsByDimension = new Map<Dimension, Constraint[]>();
      for (const constraint of clause.constraints) {
        const values = constraintsByDimension.get(constraint.dimension) ?? [];
        values.push(constraint);
        constraintsByDimension.set(constraint.dimension, values);
      }

      for (const dimension of SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS) {
        const constraints = constraintsByDimension.get(dimension) ?? [];
        const states = new Set(constraints.map((constraint) => constraint.state));
        if (!states.size && defaults[dimension]) states.add(defaults[dimension]!);
        const counts = dimensions[dimension];
        if (!states.size) counts.missingClauses += 1;
        if (states.has("EXACT")) {
          counts.exactClauses += 1;
          if (clause.verification === "VERIFIED") counts.verifiedExactClauses += 1;
          else if (clause.verification === "INFERRED") counts.inferredExactClauses += 1;
          else counts.reviewExactClauses += 1;
        }
        if (states.has("ANY")) counts.anyClauses += 1;
        if (states.has("NOT_APPLICABLE")) counts.notApplicableClauses += 1;
        if (states.has("UNKNOWN")) counts.unknownClauses += 1;
      }

      const exactStrings = (dimension: Dimension) => [
        ...new Set(
          (constraintsByDimension.get(dimension) ?? [])
            .filter((constraint) => constraint.state === "EXACT")
            .flatMap((constraint) => constraint.values)
            .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
            .map((value) => value.trim())
        ),
      ];
      const makes = exactStrings("make");
      const models = exactStrings("model");
      const generations = [...new Set([...exactStrings("generation"), ...exactStrings("chassis")])];
      for (const scope of exactStrings("scope"))
        scopeCoverage.set(scope, (scopeCoverage.get(scope) ?? 0) + 1);
      const hasCoreIdentity = models.length > 0 && generations.length > 0;
      if (!hasCoreIdentity) continue;

      const hasUnknownDimension =
        hasUnknownDefault ||
        clause.constraints.some((constraint) => constraint.state === "UNKNOWN");
      const selectorMode = policy.mode === "VEHICLE_SPECIFIC" || policy.mode === "UNIVERSAL";
      const verifiedIdentity = clause.verification === "VERIFIED";
      for (const make of makes) {
        const coverage = makeCoverage.get(make) ?? {
          clauses: 0,
          verifiedCoreIdentityClauses: 0,
          reviewOrInferredCoreIdentityClauses: 0,
          selectorEligibleCoreIdentityClauses: 0,
          blockedByUnknownDimensionClauses: 0,
          blockedByPolicyModeClauses: 0,
          models: new Set<string>(),
          generations: new Set<string>(),
        };
        coverage.clauses += 1;
        for (const model of models) coverage.models.add(model);
        for (const generation of generations) coverage.generations.add(generation);
        if (verifiedIdentity) coverage.verifiedCoreIdentityClauses += 1;
        else coverage.reviewOrInferredCoreIdentityClauses += 1;
        if (verifiedIdentity && !selectorMode) coverage.blockedByPolicyModeClauses += 1;
        else if (verifiedIdentity && hasUnknownDimension)
          coverage.blockedByUnknownDimensionClauses += 1;
        else if (verifiedIdentity) coverage.selectorEligibleCoreIdentityClauses += 1;
        makeCoverage.set(make, coverage);
      }
    }
  }

  const byMake: SelectorMakeCoverage[] = [...makeCoverage.entries()]
    .map(([make, coverage]) => ({
      make,
      clauses: coverage.clauses,
      verifiedCoreIdentityClauses: coverage.verifiedCoreIdentityClauses,
      reviewOrInferredCoreIdentityClauses: coverage.reviewOrInferredCoreIdentityClauses,
      selectorEligibleCoreIdentityClauses: coverage.selectorEligibleCoreIdentityClauses,
      blockedByUnknownDimensionClauses: coverage.blockedByUnknownDimensionClauses,
      blockedByPolicyModeClauses: coverage.blockedByPolicyModeClauses,
      models: [...coverage.models].sort((left, right) => left.localeCompare(right, "en")),
      generations: [...coverage.generations].sort((left, right) =>
        left.localeCompare(right, "en", { numeric: true })
      ),
    }))
    .sort((left, right) => left.make.localeCompare(right.make, "en"));

  return {
    policies: policies.length,
    clauses,
    verifiedClauses,
    inferredClauses,
    reviewClauses,
    policiesWithUnknownDefaults,
    dimensions,
    scopes: Object.fromEntries(
      [...scopeCoverage].sort(([left], [right]) => left.localeCompare(right, "en"))
    ),
    byMake,
  };
}

/** Offline evidence only. Compare whole clauses, never independent dimension sets. */
export function compareSelectorCoverage(
  expected: readonly Policy[],
  actual: readonly Policy[],
  options: {
    canonicalIdentity?: boolean;
    policyRules?: boolean;
    clauseIdentity?: boolean;
    /** Source labels resolve through case-insensitive make/model/generation keys. */
    caseInsensitiveTaxonomy?: boolean;
  } = {}
) {
  function valueKey(value: Value, dimension: string): string {
    if (typeof value === "string") {
      const label = value.trim();
      return JSON.stringify(
        options.caseInsensitiveTaxonomy && ["make", "model", "generation"].includes(dimension)
          ? label.toLowerCase()
          : label
      );
    }
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
                  constraint.state === "EXACT"
                    ? constraint.values.map((value) => valueKey(value, constraint.dimension)).sort()
                    : [],
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
