export type PremiumCatalogEligibilityParams = Pick<URLSearchParams, "get" | "getAll">;

export type PremiumCatalogEligibilityReason =
  "supported" | "product_type" | "product_kind" | "strict" | "facet_mode" | "multiple_brands";

export type PremiumCatalogEligibility = {
  eligible: boolean;
  reason: PremiumCatalogEligibilityReason;
};

/**
 * The projection reader must never turn a URL dimension into a no-op. Keep
 * legacy-only dimensions behind this explicit gate until their native,
 * versioned projection contracts are published.
 */
export function getPremiumCatalogEligibility(
  params: PremiumCatalogEligibilityParams
): PremiumCatalogEligibility {
  const productType = params.get("productType")?.trim();
  const productKind = params.get("productKind")?.trim().toLowerCase();
  const strictRaw = params.get("strict")?.trim().toLowerCase() ?? "";
  const facetMode = params.get("facetMode")?.trim() ?? "";
  const brands = params
    .getAll("brand")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (productType) return { eligible: false, reason: "product_type" };
  if (productKind && productKind !== "any") return { eligible: false, reason: "product_kind" };
  if (strictRaw && !["0", "false", "no"].includes(strictRaw)) {
    return { eligible: false, reason: "strict" };
  }
  // `facetMode=global` uses a broader population for statistics in legacy.
  // Unknown values are gated too, because the DTO otherwise normalizes them
  // to the filtered default and would silently change the requested URL.
  if (facetMode && facetMode !== "filtered") {
    return { eligible: false, reason: "facet_mode" };
  }
  if (new Set(brands).size > 1) return { eligible: false, reason: "multiple_brands" };
  return { eligible: true, reason: "supported" };
}

export function canUsePremiumCatalogProjection(params: PremiumCatalogEligibilityParams) {
  return getPremiumCatalogEligibility(params).eligible;
}
