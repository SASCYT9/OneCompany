import assert from "node:assert/strict";
import test from "node:test";
import { buildIpeSourceRecordDraft, normalizeIpeSnapshotProduct, type IpeSnapshotProduct } from "../../../src/lib/shopCatalogIpeNormalization";
function product(input: { title: string; tags: string[]; variantTitle: string; sku?: string }): IpeSnapshotProduct { const sku = input.sku ?? "IPE-1"; return { id: `product-${sku}`, slug: `ipe-${sku}`, sku, scope: "auto",
  title: { ua: input.title, en: input.title }, collection: { ua: "Audi", en: "Audi" }, tags: input.tags,
  variants: [{ id: `variant-${sku}`, sku, title: input.variantTitle, optionValues: [input.variantTitle, "Tip"], isDefault: true }] }; }
test("iPE splits canonical model and chassis", () => { const result = normalizeIpeSnapshotProduct(product({ title: "Audi RS4 (B9) Exhaust System", tags: ["Audi", "RS4 (B9)", "2019", "2020"], variantTitle: "Tips" }));
  assert.equal(result.applications[0]?.model, "RS4"); assert.equal(result.applications[0]?.generation, "B9"); });
test("iPE default variant overrides broad product OPF tag", () => { const result = normalizeIpeSnapshotProduct(product({ title: "Audi RS4 (B9) Exhaust System", tags: ["Audi", "RS4 (B9)", "opf"], variantTitle: "Downpipe (Non-OPF)" }));
  assert.equal(result.applications[0]?.opfGpf, "NON_OPF"); assert.ok(!result.issues.includes("opf_gpf_value_ambiguous")); });
test("iPE duplicate SKU identity includes immutable product id", () => { const left = product({ title: "Audi RS4 (B9) Exhaust System", tags: ["Audi", "RS4 (B9)"], variantTitle: "Tips", sku: "DUP" }); const right = { ...left, id: "other-product" };
  assert.notEqual(normalizeIpeSnapshotProduct(left).recordKey, normalizeIpeSnapshotProduct(right).recordKey); });
test("iPE draft accounts for nested option leaves", () => { const input = product({ title: "Audi RS4 (B9) Exhaust System", tags: ["Audi", "RS4 (B9)"], variantTitle: "Tips" }); const draft = buildIpeSourceRecordDraft({ product: input, sourceRevision: "v1" });
  assert.ok(draft.provenance.some((entry) => entry.fieldPath === "variants.optionValues")); assert.ok(draft.provenance.every((entry) => entry.mappingStatus === "MAPPED")); });
