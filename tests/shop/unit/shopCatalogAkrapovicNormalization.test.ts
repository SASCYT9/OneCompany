import assert from "node:assert/strict";
import test from "node:test";
import { buildAkrapovicSourceRecordDraft, normalizeAkrapovicSnapshotProduct, type AkrapovicSnapshotProduct } from "../../../src/lib/shopCatalogAkrapovicNormalization";
function product(input: { title: string; tags: string[]; scope?: "auto" | "moto"; sku?: string }): AkrapovicSnapshotProduct {
  const sku = input.sku ?? "S-BM/T/1"; return { id: `product-${sku}`, slug: `akrapovic-${sku}`, sku, scope: input.scope ?? "auto", brand: "AKRAPOVIC",
    title: { ua: input.title, en: input.title }, tags: input.tags, variants: [{ id: `variant-${sku}`, sku, isDefault: true }] };
}
test("Akrapovic keeps shared BMW chassis correlated by marketing model", () => {
  const result = normalizeAkrapovicSnapshotProduct(product({ title: "AKRAPOVIC Rear Diffuser for BMW M3 (G80/G81) / M4 (G82/G83)", tags: ["fits-make:bmw"] }));
  assert.deepEqual(result.applications.map((app) => `${app.model}:${app.generation}`).sort(), ["M3:G80", "M3:G81", "M4:G82", "M4:G83"]);
});
test("Akrapovic motorcycle taxonomy retains moto scope", () => {
  const result = normalizeAkrapovicSnapshotProduct(product({ title: "Akrapovic exhaust for Ducati Panigale V4 2025+", tags: ["fits-make:ducati", "fits-year:2025"], scope: "moto" }));
  assert.equal(result.scope, "moto"); assert.equal(result.applications[0]?.scope, "moto"); assert.equal(result.applications[0]?.model, "Panigale V4");
});
test("Akrapovic exhaust and OPF evidence stays review-only without exact dimensions", () => {
  const result = normalizeAkrapovicSnapshotProduct(product({ title: "AKRAPOVIC Slip-On Exhaust for AUDI RS6 (C8) OPF", tags: ["fits-make:audi"] }));
  assert.equal(result.mode, "NEEDS_REVIEW"); assert.ok(result.issues.includes("engine_identity_missing")); assert.ok(result.issues.includes("opf_gpf_constraint_unmodeled"));
});
test("Akrapovic draft is lossless", () => {
  const input = product({ title: "AKRAPOVIC diffuser for BMW M3 (G80)", tags: ["fits-make:bmw"] }); const draft = buildAkrapovicSourceRecordDraft({ product: input, sourceRevision: "v1" });
  assert.ok(draft.provenance.length); assert.ok(draft.provenance.every((entry) => entry.mappingStatus === "MAPPED"));
});
