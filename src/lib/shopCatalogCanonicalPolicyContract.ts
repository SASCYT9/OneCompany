import {
  validateShopCatalogV2CompatibilityPolicy,
  type ShopCatalogV2CompatibilityClause,
  type ShopCatalogV2CompatibilityPolicy,
} from "./shopCatalogV2Compatibility";

/** A source clause kept out of the active projection without dropping evidence. */
export type CanonicalPolicyExcludedClause = Readonly<{
  id: string;
  reason:
    | "NULL_MAKE"
    | "MULTI_CHASSIS"
    | "INFERRED"
    | "MISSING_REQUIRED_DIMENSION"
    | "UNSUPPORTED_VERIFIED_ENGINE";
  verification: "VERIFIED" | "INFERRED" | "NEEDS_REVIEW";
  sourceRef: string | null;
  evidenceHash: string | null;
  /** Original source clause/application, retained verbatim by the adapter. */
  rawClause: unknown;
}>;

export type CanonicalPolicyCompleteness = Readonly<{
  source: string;
  totalClauses: number;
  includedClauses: number;
  excludedClauses: number;
  verification: Readonly<Record<"VERIFIED" | "INFERRED" | "NEEDS_REVIEW", number>>;
  complete: boolean;
}>;

/**
 * Boundary result for source adapters. `excludedClauses` is part of the
 * contract: callers cannot claim complete coverage by silently dropping a
 * clause that the shared nullable VehiclePolicyApplication cannot represent.
 */
export type CanonicalPolicyImportResult = Readonly<{
  policies: readonly ShopCatalogV2CompatibilityPolicy[];
  excludedClauses: readonly CanonicalPolicyExcludedClause[];
  completeness: CanonicalPolicyCompleteness;
}>;

function isCanonicalPowertrain(value: unknown): value is {
  kind: "powertrain";
  powertrainId: string;
  code: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "powertrain" &&
    typeof (value as { powertrainId?: unknown }).powertrainId === "string" &&
    Boolean((value as { powertrainId: string }).powertrainId.trim()) &&
    typeof (value as { code?: unknown }).code === "string" &&
    Boolean((value as { code: string }).code.trim())
  );
}

function validateClause(clause: ShopCatalogV2CompatibilityClause, path: string): string[] {
  const errors: string[] = [];
  for (const [index, constraint] of clause.constraints.entries()) {
    const constraintPath = `${path}.constraints.${index}`;
    if (constraint.state !== "EXACT") continue;

    if (constraint.dimension === "make") {
      for (const value of constraint.values) {
        if (typeof value !== "string" || !value.trim()) {
          errors.push(`${constraintPath} EXACT make cannot contain null or an empty value`);
        }
      }
    }

    if (constraint.dimension === "engine" && clause.verification === "VERIFIED") {
      for (const value of constraint.values) {
        if (!isCanonicalPowertrain(value)) {
          errors.push(
            `${constraintPath} VERIFIED engine requires canonical powertrain identity (raw engine text is unresolved)`
          );
        }
      }
    }
  }
  return errors;
}

function validatePolicy(policy: ShopCatalogV2CompatibilityPolicy): string[] {
  const errors = validateShopCatalogV2CompatibilityPolicy(policy);
  policy.clauses.forEach((clause, index) => {
    errors.push(...validateClause(clause, `clauses.${index}`));
  });
  return errors;
}

function isImportResult(
  value: ShopCatalogV2CompatibilityPolicy | CanonicalPolicyImportResult
): value is CanonicalPolicyImportResult {
  return "policies" in value && Array.isArray(value.policies);
}

/**
 * Validates the lossless boundary before persistence/publication.
 *
 * Explicit UNKNOWN constraints and NEEDS_REVIEW clauses are valid: they retain
 * uncertainty instead of turning it into an exact match. The validator only
 * rejects an UNKNOWN/null make when the policy has already encoded it as EXACT,
 * and rejects raw engine text under VERIFIED status.
 */
export function validateLosslessPolicyContract(
  policyOrResult: ShopCatalogV2CompatibilityPolicy | CanonicalPolicyImportResult
): string[] {
  if (!isImportResult(policyOrResult)) return validatePolicy(policyOrResult);
  const result = policyOrResult;
  const errors: string[] = result.policies.flatMap((policy, index) =>
    validatePolicy(policy).map((error) => `policies.${index}: ${error}`)
  );
  {
    if (
      result.completeness.totalClauses !==
      result.completeness.includedClauses + result.completeness.excludedClauses
    ) {
      errors.push("completeness clause counts do not reconcile");
    }
    if (result.excludedClauses.length !== result.completeness.excludedClauses) {
      errors.push("completeness.excludedClauses does not match excludedClauses.length");
    }
    for (const [index, clause] of result.excludedClauses.entries()) {
      if (!clause.id.trim()) errors.push(`excludedClauses.${index}.id is required`);
      if (clause.rawClause === undefined)
        errors.push(`excludedClauses.${index}.rawClause is required`);
    }
  }
  return errors;
}
