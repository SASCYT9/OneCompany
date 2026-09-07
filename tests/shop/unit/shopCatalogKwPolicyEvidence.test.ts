import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildKwCompatibilityPolicy,
  type KwProductNormalization,
} from "../../../src/lib/shopCatalogKwNormalization";
import {
  buildKwPolicyEvidence,
  KW_POLICY_EVIDENCE_MAPPER_VERSION,
} from "../../../src/lib/shopCatalogKwPolicyEvidence";
import type { ShopifySnapshotProduct } from "../../../src/lib/shopifyCatalogSnapshot";

function product(id: string): ShopifySnapshotProduct {
  return {
    id,
    vendor: "KW",
    title: "KW Variant 3",
    tags: ["brand:BMW", "veh:3 (G20 G80) 11/2018-", "eng:B48"],
    variants: [],
    media: [],
    metafields: [],
  };
}

function normalization(id: string): KwProductNormalization {
  return {
    externalProductId: id,
    canonicalBrand: "KW Suspensions",
    categoryKey: "coilovers",
    issues: ["engine_taxonomy_unresolved"],
    applications: [
      {
        rawVehicleTag: "3 (G20 G80) 11/2018-",
        make: null,
        model: "3 Series",
        chassisCodes: ["G20", "G80"],
        yearFrom: 2018,
        yearTo: null,
        engines: ["B48"],
        verification: "INFERRED",
      },
    ],
  };
}

test("KW evidence preserves null make, multi-chassis, inferred status, and unchanged policy", () => {
  const raw = product("kw-source-1");
  const normalized = normalization(raw.id);
  const evidence = buildKwPolicyEvidence({
    product: raw,
    normalization: normalized,
    productId: "local-product-1",
  });

  assert.equal(evidence.mapperVersion, KW_POLICY_EVIDENCE_MAPPER_VERSION);
  assert.equal(evidence.sourceRecord.rawPayload.mapperVersion, KW_POLICY_EVIDENCE_MAPPER_VERSION);
  assert.equal(evidence.sourceRecord.rawPayload.product.id, raw.id);
  assert.equal(evidence.sourceRecord.rawPayload.normalization.applications[0]!.make, null);
  assert.deepEqual(evidence.sourceRecord.rawPayload.normalization.applications[0]!.chassisCodes, [
    "G20",
    "G80",
  ]);
  assert.equal(
    evidence.sourceRecord.rawPayload.normalization.applications[0]!.verification,
    "INFERRED"
  );
  assert.deepEqual(evidence.policy, buildKwCompatibilityPolicy("local-product-1", normalized));
  assert.equal(evidence.policy.mode, "NEEDS_REVIEW");
  assert.ok(Object.isFrozen(evidence));
  assert.ok(Object.isFrozen(evidence.sourceRecord.rawPayload.normalization.applications));
});

test("KW evidence identity changes with either raw product or normalized correlations", () => {
  const raw = product("kw-source-2");
  const normalized = normalization(raw.id);
  const original = buildKwPolicyEvidence({
    product: raw,
    normalization: normalized,
    productId: "local-product-2",
  });
  const rawChanged = buildKwPolicyEvidence({
    product: { ...raw, tags: [...(raw.tags ?? []), "source-revision:2"] },
    normalization: normalized,
    productId: "local-product-2",
  });
  const normalizedChanged = buildKwPolicyEvidence({
    product: raw,
    normalization: {
      ...normalized,
      applications: [{ ...normalized.applications[0]!, make: "BMW", verification: "NEEDS_REVIEW" }],
    },
    productId: "local-product-2",
  });

  assert.notEqual(original.evidenceHash, rawChanged.evidenceHash);
  assert.notEqual(original.evidenceHash, normalizedChanged.evidenceHash);
  assert.equal(original.sourceRecord.payloadHash, original.evidenceHash);
  assert.equal(
    original.evidenceHash,
    createHash("sha256").update(JSON.stringify(original.sourceRecord.rawPayload)).digest("hex")
  );
  assert.equal(
    original.sourceRecord.sourceRevision,
    `${KW_POLICY_EVIDENCE_MAPPER_VERSION}:${original.evidenceHash}`
  );
  assert.equal(original.sourceRecord.recordKey, raw.id);
});

test("KW evidence rejects mismatched external source identity", () => {
  assert.throws(
    () =>
      buildKwPolicyEvidence({
        product: product("kw-source-3"),
        normalization: normalization("different-source-id"),
        productId: "local-product-3",
      }),
    /product identity mismatch/
  );
});
