import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

export type ShopKnowledgeCategoryEvidencePolicy = {
  /** Facts that must be known to make a category-level fitment claim. */
  fitmentCritical: readonly string[];
  /** Facts required only when OneAI makes the corresponding product claim. */
  claimCritical: readonly string[];
  /** Useful merchandising facts whose absence never creates review work. */
  optionalMerchandising: readonly string[];
};

export const SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY: Record<
  ShopStockCategoryGroupId,
  ShopKnowledgeCategoryEvidencePolicy
> = {
  chipTuning: {
    fitmentCritical: ["engine", "fuel"],
    claimCritical: [
      "productKind",
      "stockPowerHp",
      "stockTorqueNm",
      "powerGainHp",
      "torqueGainNm",
      "tuningFamily",
    ],
    optionalMerchandising: ["appControl", "warranty"],
  },
  exhaust: {
    fitmentCritical: ["engine", "market", "opfGpf"],
    claimCritical: ["productKind", "material", "valves", "homologation"],
    optionalMerchandising: ["weightKg", "soundProfile"],
  },
  brakes: {
    fitmentCritical: ["axle", "brakeSystem", "diameterMm"],
    claimCritical: ["productKind", "setPosition"],
    optionalMerchandising: ["color", "weightKg"],
  },
  suspension: {
    fitmentCritical: ["axle", "edcCompatibility"],
    claimCritical: ["productKind", "loweringMinMm", "loweringMaxMm"],
    optionalMerchandising: ["finish", "comfortMode"],
  },
  cooling: {
    fitmentCritical: ["engine", "transmission", "circuit"],
    claimCritical: ["productKind", "dimensionsMm"],
    optionalMerchandising: ["finish"],
  },
  performance: {
    fitmentCritical: ["engine", "transmission"],
    claimCritical: ["productKind", "dimensionsMm"],
    optionalMerchandising: ["finish"],
  },
  motoCarbon: {
    fitmentCritical: ["make", "model", "generation", "yearFrom"],
    claimCritical: ["productKind", "position", "finish", "roadUse"],
    optionalMerchandising: ["color"],
  },
  carbonAero: {
    fitmentCritical: ["chassisCode", "facelift", "bodyStyle", "packageDependency"],
    claimCritical: ["productKind", "position", "finish"],
    optionalMerchandising: ["color", "weightKg"],
  },
  wheels: {
    fitmentCritical: ["pcd", "centerBoreMm", "diameterIn", "widthIn", "offsetEt", "loadKg", "axle"],
    claimCritical: ["productKind", "setPosition"],
    optionalMerchandising: ["finish", "color", "weightKg"],
  },
  lighting: {
    fitmentCritical: [],
    claimCritical: ["productKind", "position"],
    optionalMerchandising: ["colorTemperature", "finish"],
  },
  interior: {
    fitmentCritical: ["chassisCode", "facelift", "bodyStyle", "packageDependency"],
    claimCritical: ["productKind", "position", "finish"],
    optionalMerchandising: ["color"],
  },
  accessories: {
    fitmentCritical: ["parentProduct"],
    claimCritical: ["productKind"],
    optionalMerchandising: ["finish", "color"],
  },
  merch: {
    fitmentCritical: [],
    claimCritical: ["productKind"],
    optionalMerchandising: ["size", "color", "material"],
  },
  other: {
    fitmentCritical: [],
    claimCritical: [],
    optionalMerchandising: [],
  },
};

/**
 * Compatibility export for extraction code and older callers. It is the union
 * of actionable facts, not a statement that every fact blocks fitment.
 */
export const SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES = Object.fromEntries(
  Object.entries(SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY).map(([category, policy]) => [
    category,
    [...policy.fitmentCritical, ...policy.claimCritical],
  ])
) as unknown as Record<ShopStockCategoryGroupId, readonly string[]>;

export function getShopKnowledgeCategoryEvidencePolicy(category: ShopStockCategoryGroupId) {
  return SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY[category];
}

export const SHOP_KNOWLEDGE_FITMENT_FLAG_PREFIX = "missing_fitment_attribute:";
export const SHOP_KNOWLEDGE_CLAIM_FLAG_PREFIX = "missing_claim_attribute:";

export function isShopKnowledgeHighPriorityFlag(flag: string) {
  return (
    flag === "missing_fitment" ||
    flag === "fitment_needs_review" ||
    flag === "fitment_correlation_needs_review" ||
    flag === "category_other" ||
    flag.startsWith(SHOP_KNOWLEDGE_FITMENT_FLAG_PREFIX) ||
    flag.startsWith("conflict:") ||
    flag.startsWith("blocked_strict:")
  );
}

export function isShopKnowledgeClaimReviewFlag(flag: string) {
  return flag.startsWith(SHOP_KNOWLEDGE_CLAIM_FLAG_PREFIX);
}

export function isShopKnowledgeActionableReviewFlag(flag: string) {
  return isShopKnowledgeHighPriorityFlag(flag) || isShopKnowledgeClaimReviewFlag(flag);
}

export function shopKnowledgeReviewPriorityForFlags(
  flags: string[]
): "CRITICAL" | "HIGH" | "MEDIUM" {
  if (flags.some((flag) => flag.startsWith("conflict:") || flag.startsWith("blocked_strict:"))) {
    return "CRITICAL";
  }
  return flags.some(isShopKnowledgeHighPriorityFlag) ? "HIGH" : "MEDIUM";
}
