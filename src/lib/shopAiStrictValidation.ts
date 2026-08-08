import {
  getShopKnowledgeCategoryEvidencePolicy,
  SHOP_KNOWLEDGE_CLAIM_FLAG_PREFIX,
  SHOP_KNOWLEDGE_FITMENT_FLAG_PREFIX,
  SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY,
} from "@/lib/shopKnowledgeV2/policy";
import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

const LEGACY_MISSING_HARD_PREFIX = "missing_hard_attribute:";
const TRUSTED_APPLICATION_SOURCES = new Set(["MANAGER", "MANUAL_OVERRIDE", "SUPPLIER"]);

export type ShopAiApplicationProvenance = {
  applicationVerificationStatus: string | null;
  applicationSource: string | null;
  trustedApplicationEvidence: boolean;
};

export function hasTrustedShopAiApplicationProvenance(input: ShopAiApplicationProvenance): boolean {
  return (
    input.applicationVerificationStatus === "VERIFIED" &&
    input.trustedApplicationEvidence &&
    Boolean(input.applicationSource && TRUSTED_APPLICATION_SOURCES.has(input.applicationSource))
  );
}

export function resolveTrustedShopAiProductKind(
  input: ShopAiApplicationProvenance & {
    applicationProductKind: string | null;
    knowledgeProductKind: string | null;
    trustedProductKindEvidence: boolean;
  }
): { value: string | null; verified: boolean } {
  if (hasTrustedShopAiApplicationProvenance(input) && input.applicationProductKind) {
    return { value: input.applicationProductKind, verified: true };
  }
  if (input.trustedProductKindEvidence && input.knowledgeProductKind) {
    return { value: input.knowledgeProductKind, verified: true };
  }
  return { value: null, verified: false };
}

function validCategoryGroup(value: string | null | undefined): ShopStockCategoryGroupId | null {
  return value && Object.hasOwn(SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY, value)
    ? (value as ShopStockCategoryGroupId)
    : null;
}

function factsWithPrefix(qualityFlags: string[], prefix: string) {
  return qualityFlags
    .filter((flag) => flag.startsWith(prefix))
    .map((flag) => flag.slice(prefix.length))
    .filter(Boolean);
}

export function getMissingShopAiFitmentFacts(
  qualityFlags: string[],
  categoryGroup?: string | null
) {
  const current = factsWithPrefix(qualityFlags, SHOP_KNOWLEDGE_FITMENT_FLAG_PREFIX);
  const legacy = factsWithPrefix(qualityFlags, LEGACY_MISSING_HARD_PREFIX);
  const category = validCategoryGroup(categoryGroup);
  const compatibleLegacy = category
    ? legacy.filter((fact) =>
        getShopKnowledgeCategoryEvidencePolicy(category).fitmentCritical.includes(fact)
      )
    : legacy;
  return Array.from(new Set([...current, ...compatibleLegacy]));
}

export function getMissingShopAiClaimFacts(qualityFlags: string[]) {
  return Array.from(new Set(factsWithPrefix(qualityFlags, SHOP_KNOWLEDGE_CLAIM_FLAG_PREFIX)));
}

/** @deprecated Use getMissingShopAiFitmentFacts for new code. */
export function getMissingShopAiHardFacts(qualityFlags: string[], categoryGroup?: string | null) {
  return getMissingShopAiFitmentFacts(qualityFlags, categoryGroup);
}

export function isShopAiExactMatchEligible(input: {
  exactSkuWithoutVehicle: boolean;
  merchWithoutVehicle: boolean;
  hasApplication: boolean;
  trustedApplication: boolean;
  applicationConfirmsRequestedFacts: boolean;
  qualityFlags: string[];
  categoryGroup?: string | null;
}) {
  if (input.exactSkuWithoutVehicle || input.merchWithoutVehicle) return true;
  return (
    input.hasApplication &&
    input.trustedApplication &&
    input.applicationConfirmsRequestedFacts &&
    getMissingShopAiFitmentFacts(input.qualityFlags, input.categoryGroup).length === 0
  );
}

export function resolveShopAiStrictCandidateCount(input: {
  eligibleCount: number;
  postBudgetCount: number;
  hasBudgetConstraint: boolean;
}) {
  return input.hasBudgetConstraint ? input.postBudgetCount : input.eligibleCount;
}
