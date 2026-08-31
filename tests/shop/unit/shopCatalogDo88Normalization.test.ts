import assert from "node:assert/strict";
import test from "node:test";
import { buildDo88SourceRecordDraft, normalizeDo88SnapshotProduct, type Do88SnapshotProduct } from "../../../src/lib/shopCatalogDo88Normalization";
function product(title: string, tags: string[]): Do88SnapshotProduct { return { id: "do88-product", slug: "do88-product", sku: "KIT-1", scope: "SHOP", title: { ua: title, en: title }, tags,
  variants: [{ id: "do88-variant", sku: "KIT-1", isDefault: true }] }; }
test("do88 maps audited human fitment and chassis", () => { const result = normalizeDo88SnapshotProduct(product("Volvo S60R hose", ["Vehicle Specific", "fits-make:volvo", "Volvo S60 V70 S80 XC70, P2 (2000-2009)"]));
  assert.equal(result.mode, "VEHICLE_SPECIFIC"); assert.deepEqual(result.applications[0], { make: "Volvo", model: "S60 V70 S80 XC70, P2", generation: "P2", yearFrom: 2000, yearTo: 2009 }); });
test("do88 generic components remain universal", () => { const result = normalizeDo88SnapshotProduct(product("Fuel Hose 10 mm", ["Hoses & Couplers", "Fuel Hose"])); assert.equal(result.mode, "UNIVERSAL"); assert.equal(result.engineRelevant, false); });
test("do88 rejects category masquerading as make", () => { const result = normalizeDo88SnapshotProduct(product("Clamp kit", ["Vehicle Specific", "fits-make:clamp-kits"])); assert.equal(result.mode, "NEEDS_REVIEW"); assert.ok(result.issues.includes("vehicle_application_unresolved")); });
test("do88 draft preserves every raw leaf and maps legacy scope", () => { const input = product("Volvo hose", ["Vehicle Specific", "fits-make:volvo", "Volvo 240, (1975-1993)"]), draft = buildDo88SourceRecordDraft({ product: input, sourceRevision: "v1" });
  assert.equal(draft.provenance.find((entry) => entry.fieldPath === "scope")?.normalizedValue, "auto"); assert.ok(draft.provenance.every((entry) => entry.mappingStatus === "MAPPED")); });
