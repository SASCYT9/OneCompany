import assert from "node:assert/strict";
import test from "node:test";

import {
  getMissingShopAiHardFacts,
  hasTrustedShopAiApplicationProvenance,
  isShopAiExactMatchEligible,
  resolveTrustedShopAiProductKind,
} from "../../../src/lib/shopAiStrictValidation";

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
