import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdroSourceRecordDraft,
  normalizeAdroSnapshotProduct,
  type AdroSnapshotProduct,
} from "../../../src/lib/shopCatalogAdroNormalization";

function product(title: string): AdroSnapshotProduct {
  return {
    id: "adro-product",
    slug: "adro-test",
    sku: "A14A11-1201",
    scope: "SHOP",
    title: { ua: title, en: title },
    gallery: [],
    tags: [],
    variants: [{ id: "adro-variant", sku: "A14A11-1201", isDefault: true }],
  };
}

test("ADRO normalization creates correlated clauses for every explicit BMW chassis", () => {
  const result = normalizeAdroSnapshotProduct(
    product("ADRO part for BMW M3 (G80 / G81) / M4 (G82 / G83) 2021+")
  );
  assert.equal(result.verification, "VERIFIED");
  assert.deepEqual(
    result.applications.map((application) => [application.model, application.generation]),
    [["M3", "G80"], ["M3", "G81"], ["M4", "G82"], ["M4", "G83"]]
  );
  assert.ok(result.applications.every((application) => application.yearFrom === 2021));
});

test("ADRO multi-make clauses stay separate and ambiguous chassis correlation requires review", () => {
  const result = normalizeAdroSnapshotProduct(
    product("ADRO wing for TOYOTA GR86 / SUBARU BRZ 2022- / BMW M2 (F87)")
  );
  assert.deepEqual(result.applications.map(({ make, model }) => [make, model]), [
    ["Toyota", "GR86"],
    ["Subaru", "BRZ"],
    ["BMW", "M2"],
  ]);
  assert.equal(result.verification, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("application_generation_correlation_ambiguous"));
});

test("ADRO source draft is lossless and audits legacy scope without inventing engine data", () => {
  const raw = product("ADRO splitter for HONDA Civic Type R 2023-");
  const draft = buildAdroSourceRecordDraft({ product: raw, sourceRevision: "adro-v1" });
  assert.equal(draft.normalization.verification, "VERIFIED");
  assert.deepEqual(draft.normalization.applications[0], {
    make: "Honda",
    model: "Civic Type R",
    generation: null,
    yearFrom: 2023,
    yearTo: null,
  });
  assert.ok(draft.provenance.length > 0);
  assert.ok(draft.provenance.some((entry) => entry.fieldPath === "scope" && entry.reason));
  assert.equal(JSON.stringify(draft.normalization).includes("engine"), false);
});
