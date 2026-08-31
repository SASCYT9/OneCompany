import assert from "node:assert/strict";
import test from "node:test";
import { buildOhlinsSourceRecordDraft, normalizeOhlinsSnapshotProduct, type OhlinsSnapshotProduct } from "../../../src/lib/shopCatalogOhlinsNormalization";

function product(input: { title: string; tags: string[]; sku?: string }): OhlinsSnapshotProduct {
  const sku = input.sku ?? "BMV GX01";
  return { id: `product-${sku}`, slug: `ohlins-${sku.toLowerCase().replaceAll(" ", "-")}`, sku, scope: "auto",
    title: { en: input.title, ua: input.title }, shortDescription: { en: "", ua: "" }, tags: input.tags,
    variants: [{ id: `variant-${sku}`, sku, isDefault: true }] };
}

test("Ohlins maps correlated BMW chassis through the existing catalog vocabulary", () => {
  const result = normalizeOhlinsSnapshotProduct(product({ title: "OHLINS BMV GX01 kit for BMW M2 (G87) / M3 (G80) / M4 (G82)", tags: ["fits-make:bmw"] }));
  assert.equal(result.mode, "VEHICLE_SPECIFIC");
  assert.deepEqual(result.applications.map((entry) => entry.generation).sort(), ["G80", "G82", "G87"]);
});

test("Ohlins universal hardware is verified without fabricated vehicle clauses", () => {
  const result = normalizeOhlinsSnapshotProduct(product({ title: "OHLINS 25608-01 Rubber Bushing 16/37/37", tags: ["fits-make:universal"], sku: "25608-01" }));
  assert.equal(result.mode, "UNIVERSAL"); assert.equal(result.verification, "VERIFIED"); assert.deepEqual(result.applications, []);
});

test("Ohlins drivetrain-qualified products remain review-only", () => {
  const result = normalizeOhlinsSnapshotProduct(product({ title: "OHLINS BMW M3 (G80) / M4 (G82) RWD Only", tags: ["fits-make:bmw"] }));
  assert.equal(result.mode, "NEEDS_REVIEW"); assert.ok(result.issues.includes("drivetrain_constraint_unmodeled"));
});

test("Ohlins draft preserves every raw leaf with provenance", () => {
  const input = product({ title: "OHLINS Lotus Emira", tags: ["fits-make:lotus"], sku: "LOV GY10" });
  const draft = buildOhlinsSourceRecordDraft({ product: input, sourceRevision: "ohlins-v1" });
  assert.ok(draft.provenance.length > 0); assert.ok(draft.provenance.every((entry) => entry.mappingStatus === "MAPPED"));
});
