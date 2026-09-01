import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemusSourceRecordDraft,
  normalizeRemusSnapshotProduct,
  type RemusSnapshotProduct,
} from "../../../src/lib/shopCatalogRemusNormalization";
function product(title: string, tags: string[]): RemusSnapshotProduct {
  return {
    id: "remus-product",
    slug: "remus-product",
    sku: "REM-1",
    scope: "auto",
    brand: "Remus",
    title: { ua: title, en: title },
    tags,
    variants: [],
  };
}
test("Remus maps make/model/year and OPF evidence", () => {
  const result = normalizeRemusSnapshotProduct(
    product("GPF-Back Exhaust for VW Golf", [
      "fits-make:vw",
      "fits-model:vw:golf-7",
      "fits-year:2018",
    ])
  );
  assert.deepEqual(result.applications, [
    {
      make: "Volkswagen",
      model: "Golf 7",
      generation: null,
      yearFrom: 2018,
      yearTo: 2018,
      opfGpf: "OPF/GPF",
    },
  ]);
  assert.equal(result.opfGpfRelevant, true);
});
test("Remus quarantines missing fitment", () => {
  const result = normalizeRemusSnapshotProduct(product("Exhaust for T-Roc", []));
  assert.equal(result.mode, "NEEDS_REVIEW");
});
test("Remus recognizes explicit universal rows", () => {
  const result = normalizeRemusSnapshotProduct(
    product("Universal exhaust tip", ["fits-make:universal"])
  );
  assert.equal(result.mode, "UNIVERSAL");
  assert.equal(result.engineRelevant, false);
});
test("Remus keeps multi-make models correlated by namespaced tags", () => {
  const result = normalizeRemusSnapshotProduct(
    product("Exhaust for shared platform", [
      "fits-make:vw",
      "fits-model:vw:golf-8",
      "fits-make:audi",
      "fits-model:audi:a3-8y",
      "fits-year:2021",
    ])
  );
  assert.deepEqual(
    result.applications.map((entry) => `${entry.make}:${entry.model}`),
    ["Volkswagen:Golf 8", "Audi:A3 8Y"]
  );
});
test("Remus preserves ordered make/model/year groups", () => {
  const result = normalizeRemusSnapshotProduct(
    product("Golf and Leon exhaust", [
      "fits-make:seat",
      "fits-model:seat:leon",
      "fits-year:2013",
      "fits-year:2014",
      "fits-make:vw",
      "fits-model:vw:golf-7",
      "fits-year:2012",
    ])
  );
  assert.deepEqual(
    result.applications.map((entry) => `${entry.make}:${entry.model}:${entry.yearFrom}`),
    ["SEAT:Leon:2013", "SEAT:Leon:2014", "Volkswagen:Golf 7:2012"]
  );
});
test("Remus quarantines corrupt supplier year expansions without inventing a year", () => {
  const result = normalizeRemusSnapshotProduct(
    product("BMW exhaust", [
      "fits-make:bmw",
      "fits-model:bmw:3-series",
      "fits-year:1000",
      "fits-year:2007",
    ])
  );
  assert.equal(result.mode, "NEEDS_REVIEW");
  assert.deepEqual(result.issues, ["invalid_year_evidence"]);
  assert.deepEqual(
    result.applications.map((entry) => entry.yearFrom),
    [null]
  );
});
test("Remus subset draft preserves every leaf", () => {
  const input = product("Exhaust for BMW M3", ["fits-make:bmw", "fits-model:bmw:m3"]),
    draft = buildRemusSourceRecordDraft({ product: input, sourceRevision: "v1" });
  assert.ok(
    draft.provenance.every(
      (entry) => entry.mappingStatus === "MAPPED" && entry.canonicalEntityType === "PRODUCT"
    )
  );
});
