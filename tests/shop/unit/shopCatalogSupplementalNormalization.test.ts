import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupplementalCatalogSourceRecordDraft,
  normalizeSupplementalCatalogSnapshotProduct,
} from "../../../src/lib/shopCatalogSupplementalNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../../../src/lib/shopCatalogSourceCoverage";

const product = {
  id: "product-fi-rsq8",
  slug: "fi-exhaust-audi-rsq8",
  sku: "AD-Q8RS-CBOE",
  scope: "auto",
  brand: "Fi EXHAUST",
  title: { ua: "Fi EXHAUST для Audi RSQ8", en: "Fi EXHAUST for Audi RSQ8" },
  tags: ["Fi Exhaust", "AUDI"],
  variants: [{ id: "variant-fi-rsq8", sku: "AD-Q8RS-CBOE", isDefault: true }],
};

test("supplemental sources preserve products without inventing verified fitment", () => {
  const normalization = normalizeSupplementalCatalogSnapshotProduct(product, "fi-exhaust");
  assert.equal(normalization.productId, product.id);
  assert.equal(normalization.variantId, null);
  assert.equal(normalization.verification, "NEEDS_REVIEW");
  assert.equal(normalization.mode, "NEEDS_REVIEW");
  assert.deepEqual(normalization.applications, []);
  assert.deepEqual(normalization.issues, ["compatibility_evidence_requires_review"]);
});

test("supplemental evidence accounts for every immutable raw field", () => {
  const draft = buildSupplementalCatalogSourceRecordDraft({
    product,
    sourceRevision: "fixture-v1",
    expectedSource: "fi-exhaust",
  });
  const coverage = buildShopCatalogSourceRecordCoverage({
    recordKey: draft.sourceRecord.recordKey,
    rawPayload: draft.sourceRecord.rawPayload,
    sourceRevision: draft.sourceRecord.sourceRevision,
    payloadHash: draft.sourceRecord.payloadHash,
    provenance: draft.provenance,
  });
  assert.equal(coverage.coveragePercent, 100);
  assert.equal(coverage.missing.length, 0);
  assert.equal(coverage.invalid.length, 0);
  assert.equal(coverage.payloadHashMatches, true);
});

test("supplemental adapters fail closed when a partition receives another brand", () => {
  assert.throws(
    () => normalizeSupplementalCatalogSnapshotProduct(product, "kw-suspensions"),
    /Supplemental source mismatch/
  );
});
