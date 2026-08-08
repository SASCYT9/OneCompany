import assert from "node:assert/strict";
import test from "node:test";

import {
  getMissingShopAiHardFacts,
  hasTrustedShopAiApplicationProvenance,
  isShopAiExactMatchEligible,
  resolveTrustedShopAiProductKind,
  resolveShopAiStrictCandidateCount,
} from "../../../src/lib/shopAiStrictValidation";
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../../../src/lib/shopAiV2FeatureFlags";
import { SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY } from "../../../src/lib/shopKnowledgeV2/policy";

test("missing category hard facts keep a fitment in verification tier", () => {
  const qualityFlags = [
    "missing_description_en",
    "missing_hard_attribute:opfGpf",
    "missing_hard_attribute:market",
  ];

  assert.deepEqual(getMissingShopAiHardFacts(qualityFlags), ["opfGpf", "market"]);
  assert.equal(
    isShopAiExactMatchEligible({
      exactSkuWithoutVehicle: false,
      merchWithoutVehicle: false,
      hasApplication: true,
      trustedApplication: true,
      applicationConfirmsRequestedFacts: true,
      qualityFlags,
    }),
    false
  );
});

test("verified complete applications and non-fitment SKU baselines can be exact", () => {
  assert.equal(
    isShopAiExactMatchEligible({
      exactSkuWithoutVehicle: false,
      merchWithoutVehicle: false,
      hasApplication: true,
      trustedApplication: true,
      applicationConfirmsRequestedFacts: true,
      qualityFlags: ["missing_description_en"],
    }),
    true
  );
  assert.equal(
    isShopAiExactMatchEligible({
      exactSkuWithoutVehicle: true,
      merchWithoutVehicle: false,
      hasApplication: false,
      trustedApplication: false,
      applicationConfirmsRequestedFacts: false,
      qualityFlags: ["missing_hard_attribute:productKind"],
    }),
    true
  );
});

test("unrequested exhaust claim gaps do not block trusted fitment", () => {
  const qualityFlags = [
    "missing_claim_attribute:material",
    "missing_claim_attribute:valves",
    "missing_claim_attribute:homologation",
    "missing_description_en",
  ];

  assert.deepEqual(getMissingShopAiHardFacts(qualityFlags, "exhaust"), []);
  assert.equal(
    isShopAiExactMatchEligible({
      exactSkuWithoutVehicle: false,
      merchWithoutVehicle: false,
      hasApplication: true,
      trustedApplication: true,
      applicationConfirmsRequestedFacts: true,
      qualityFlags,
      categoryGroup: "exhaust",
    }),
    true
  );
});

test("all 13 rollout categories separate fitment blockers from claim-only gaps", () => {
  assert.equal(SHOP_AI_V2_ROLLOUT_CATEGORIES.length, 13);
  for (const categoryGroup of SHOP_AI_V2_ROLLOUT_CATEGORIES) {
    const policy = SHOP_KNOWLEDGE_CATEGORY_EVIDENCE_POLICY[categoryGroup];
    assert.ok(policy, `missing policy for ${categoryGroup}`);

    const claimGap = policy.claimCritical[0];
    assert.equal(
      isShopAiExactMatchEligible({
        exactSkuWithoutVehicle: false,
        merchWithoutVehicle: false,
        hasApplication: true,
        trustedApplication: true,
        applicationConfirmsRequestedFacts: true,
        qualityFlags: claimGap ? [`missing_claim_attribute:${claimGap}`] : [],
        categoryGroup,
      }),
      true,
      `${categoryGroup} claim gap must not block fitment`
    );

    const fitmentGap = policy.fitmentCritical[0];
    if (fitmentGap) {
      assert.equal(
        isShopAiExactMatchEligible({
          exactSkuWithoutVehicle: false,
          merchWithoutVehicle: false,
          hasApplication: true,
          trustedApplication: true,
          applicationConfirmsRequestedFacts: true,
          qualityFlags: [`missing_fitment_attribute:${fitmentGap}`],
          categoryGroup,
        }),
        false,
        `${categoryGroup} fitment gap must remain reviewable`
      );
    }
  }
});

test("budgeted strict retrieval never reports candidates removed after price hydration", () => {
  assert.equal(
    resolveShopAiStrictCandidateCount({
      eligibleCount: 80,
      postBudgetCount: 6,
      hasBudgetConstraint: true,
    }),
    6
  );
  assert.equal(
    resolveShopAiStrictCandidateCount({
      eligibleCount: 80,
      postBudgetCount: 6,
      hasBudgetConstraint: false,
    }),
    80
  );
});

test("legacy MANAGER rows without linked admin evidence fail closed", () => {
  assert.equal(
    hasTrustedShopAiApplicationProvenance({
      applicationVerificationStatus: "VERIFIED",
      applicationSource: "MANAGER",
      trustedApplicationEvidence: false,
    }),
    false
  );
});

test("trusted application never promotes a productKind fallback from knowledge facts", () => {
  const result = resolveTrustedShopAiProductKind({
    applicationVerificationStatus: "VERIFIED",
    applicationSource: "MANAGER",
    trustedApplicationEvidence: true,
    applicationProductKind: null,
    knowledgeProductKind: "downpipe",
    trustedProductKindEvidence: false,
  });

  assert.deepEqual(result, { value: null, verified: false });
});

test("productKind facts require either application-local or value-bound evidence", () => {
  assert.deepEqual(
    resolveTrustedShopAiProductKind({
      applicationVerificationStatus: "VERIFIED",
      applicationSource: "MANUAL_OVERRIDE",
      trustedApplicationEvidence: true,
      applicationProductKind: "system",
      knowledgeProductKind: "downpipe",
      trustedProductKindEvidence: false,
    }),
    { value: "system", verified: true }
  );
  assert.deepEqual(
    resolveTrustedShopAiProductKind({
      applicationVerificationStatus: "VERIFIED",
      applicationSource: "MANAGER",
      trustedApplicationEvidence: false,
      applicationProductKind: "system",
      knowledgeProductKind: "downpipe",
      trustedProductKindEvidence: true,
    }),
    { value: "downpipe", verified: true }
  );
});
