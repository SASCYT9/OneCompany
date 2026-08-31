import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrabusSourceRecordDraft,
  normalizeBrabusSnapshotProduct,
  type BrabusSnapshotProduct,
} from "../../../src/lib/shopCatalogBrabusNormalization";

function product(input: { title: string; tags: string[] }): BrabusSnapshotProduct {
  return {
    id: "brabus-product",
    slug: "brabus-product",
    sku: "BRABUS-SKU",
    scope: "SHOP",
    title: { ua: input.title, en: input.title },
    tags: input.tags,
    gallery: [],
    variants: [{ id: "brabus-variant", sku: "BRABUS-SKU", isDefault: true }],
  };
}

test("Brabus Mercedes chassis is authoritative and maps to a correlated model", () => {
  const result = normalizeBrabusSnapshotProduct(product({
    title: "Carbon parts for Mercedes – X 167 – Maybach GLS 600",
    tags: ["Brabus", "fits-make:mercedes-benz", "fits-model:mercedes-benz:gls"],
  }));
  assert.equal(result.verification, "VERIFIED");
  assert.deepEqual(result.applications, [{ make: "Mercedes-Benz", model: "GLS", generation: "X167" }]);
  assert.equal(result.engineRelevant, false);
});

test("Brabus non-Mercedes title does not trust a conflicting legacy Mercedes tag", () => {
  const result = normalizeBrabusSnapshotProduct(product({
    title: "Monoblock F BRABUS based on Rolls-Royce Ghost",
    tags: ["Brabus", "Rolls-Royce Ghost", "fits-make:mercedes-benz"],
  }));
  assert.deepEqual(result.applications, [{ make: "Rolls-Royce", model: "Ghost", generation: null }]);
  assert.equal(result.verification, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("legacy_fit_make_conflict"));
});

test("Brabus power products require engine evidence and cannot become broad exact fitment", () => {
  const result = normalizeBrabusSnapshotProduct(product({
    title: "PowerXtra B40S-800 for Mercedes – X 167 – Maybach GLS 600",
    tags: ["Brabus", "fits-make:mercedes-benz"],
  }));
  assert.equal(result.engineRelevant, true);
  assert.equal(result.verification, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("engine_identity_missing"));
});

test("Brabus source draft preserves every raw field and audits legacy scope", () => {
  const draft = buildBrabusSourceRecordDraft({
    product: product({ title: "Part for Mercedes – W 465 – G 63", tags: ["fits-make:mercedes-benz"] }),
    sourceRevision: "brabus-v1",
  });
  assert.ok(draft.provenance.length > 0);
  assert.ok(draft.provenance.some((entry) => entry.fieldPath === "scope" && entry.reason));
});
