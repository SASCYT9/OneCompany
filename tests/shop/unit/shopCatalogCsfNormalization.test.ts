import assert from "node:assert/strict";
import test from "node:test";
import { buildCsfSourceRecordDraft, normalizeCsfSnapshotProduct, type CsfSnapshotProduct } from "../../../src/lib/shopCatalogCsfNormalization";
function product(title: string, tags: string[] = []): CsfSnapshotProduct { return { id: "csf-product", slug: "csf-product", sku: "7088", scope: "auto", title: { ua: title, en: title }, category: { ua: "Радіатори та аксесуари", en: "Radiators" }, stock: "inStock", tags,
  variants: [{ id: "csf-variant", sku: "7088", isDefault: true }] }; }
test("CSF correlates title models with their chassis", () => { const result = normalizeCsfSnapshotProduct(product("CSF Radiator for BMW M3 (E36) / M4 (E46)")); assert.deepEqual(result.applications.map((app) => `${app.model}:${app.generation}`), ["M3:E36", "M4:E46"]); });
test("CSF preserves exact manual transmission evidence", () => { const input = product("CSF Radiator for PORSCHE 944 Turbo (951) 1985-1991"); input.longDescription = { en: "Applications: Manual Transmission Only" }; const result = normalizeCsfSnapshotProduct(input);
  assert.equal(result.transmissionRelevant, true); assert.equal(result.applications[0]?.transmission, "MANUAL"); assert.ok(!result.issues.includes("transmission_constraint_unmodeled")); });
test("CSF legacy-only candidates stay quarantined", () => { const result = normalizeCsfSnapshotProduct(product("Broken pressure tests title", ["fits-make:subaru", "fits-model:subaru:wrx", "fits-trim:subaru:wrx:vb"]));
  assert.ok(result.issues.includes("legacy_fitment_only")); assert.equal(result.applications[0]?.generation, "VB"); });
test("CSF draft is lossless", () => { const input = product("CSF Radiator for SUBARU WRX (VB) 2022+"); const draft = buildCsfSourceRecordDraft({ product: input, sourceRevision: "v1" }); assert.ok(draft.provenance.length); assert.ok(draft.provenance.every((entry) => entry.mappingStatus === "MAPPED")); });
