const MISSING_HARD_PREFIX = "missing_hard_attribute:";
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

export function getMissingShopAiHardFacts(qualityFlags: string[]) {
  return qualityFlags
    .filter((flag) => flag.startsWith(MISSING_HARD_PREFIX))
    .map((flag) => flag.slice(MISSING_HARD_PREFIX.length))
    .filter(Boolean);
}

export function isShopAiExactMatchEligible(input: {
  exactSkuWithoutVehicle: boolean;
  merchWithoutVehicle: boolean;
  hasApplication: boolean;
  trustedApplication: boolean;
  applicationConfirmsRequestedFacts: boolean;
  qualityFlags: string[];
}) {
  if (input.exactSkuWithoutVehicle || input.merchWithoutVehicle) return true;
  return (
    input.hasApplication &&
    input.trustedApplication &&
    input.applicationConfirmsRequestedFacts &&
    getMissingShopAiHardFacts(input.qualityFlags).length === 0
  );
}
