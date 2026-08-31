import assert from "node:assert/strict";
import test from "node:test";
import { buildUrbanSourceRecordDraft, normalizeUrbanSnapshotProduct, type UrbanSnapshotProduct } from "../../../src/lib/shopCatalogUrbanNormalization";

function product(title: string, tags: string[]): UrbanSnapshotProduct {
  return { id: "urban-product", slug: "urban-product", sku: "URB-SKU", scope: "SHOP", title: { ua: title, en: title }, tags,
    gallery: [], variants: [{ id: "urban-variant", sku: "URB-SKU", isDefault: true }] };
}
test("Urban multi-chassis wheel becomes correlated Range Rover model clauses", () => {
  const result = normalizeUrbanSnapshotProduct(product('24" wheel (L405/L494)', ["urban-family:wheels", "urban-vehicle-brand:range-rover"]));
  assert.equal(result.verification, "VERIFIED");
  assert.deepEqual(result.applications, [
    { make: "Range Rover", model: "Range Rover", generation: "L405" },
    { make: "Range Rover", model: "Range Rover Sport", generation: "L494" },
  ]);
  assert.equal(result.engineRelevant, false);
});
test("Urban Defender wheel ignores wheel-name legacy model and uses L663", () => {
  const result = normalizeUrbanSnapshotProduct(product('22" WX5 wheel (L663)', ["urban-family:wheels", "urban-vehicle-brand:land-rover", "fits-model:land-rover:22-wx5"]));
  assert.deepEqual(result.applications, [{ make: "Land Rover", model: "Defender", generation: "L663" }]);
});
test("Urban exhaust stays review-only without engine identity", () => {
  const result = normalizeUrbanSnapshotProduct(product("Bentley Continental GT exhaust", ["urban-family:exhaust", "urban-vehicle-brand:bentley"]));
  assert.equal(result.verification, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("engine_identity_missing"));
});
test("Urban draft is lossless and audits scope", () => {
  const draft = buildUrbanSourceRecordDraft({ product: product("Audi RS3 8Y splitter", ["urban-family:exterior", "urban-vehicle-brand:audi"]), sourceRevision: "urban-v1" });
  assert.ok(draft.provenance.some((entry) => entry.fieldPath === "scope" && entry.reason));
});
