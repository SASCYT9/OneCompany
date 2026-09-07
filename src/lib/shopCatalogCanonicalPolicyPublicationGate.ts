import {
  validateLosslessPolicyContract,
  type CanonicalPolicyImportResult,
} from "./shopCatalogCanonicalPolicyContract";

export type CanonicalPolicyPublicationGateDecision = Readonly<{
  status: "READY" | "BLOCKED";
  errors: readonly string[];
  excludedClauseCount: number;
}>;

/**
 * Pure pre-publication gate for source adapters. Publication is allowed only
 * when every source clause is represented by a validated canonical policy.
 * Review clauses remain publishable as review state; excluded clauses do not,
 * because activating them would publish an incomplete compatibility view.
 */
export function evaluateCanonicalPolicyPublication(
  result: CanonicalPolicyImportResult
): CanonicalPolicyPublicationGateDecision {
  const errors = validateLosslessPolicyContract(result);
  const excludedClauseCount = result.excludedClauses.length;
  if (excludedClauseCount > 0) {
    errors.push(
      `canonical policy publication requires resolving ${excludedClauseCount} excluded clause${excludedClauseCount === 1 ? "" : "s"}`
    );
  }
  if (result.completeness.complete !== (excludedClauseCount === 0)) {
    errors.push("completeness.complete must be true exactly when no clauses are excluded");
  }
  return Object.freeze({
    status: errors.length ? "BLOCKED" : "READY",
    errors: Object.freeze(errors),
    excludedClauseCount,
  });
}
