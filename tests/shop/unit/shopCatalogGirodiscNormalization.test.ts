import assert from "node:assert/strict";
import test from "node:test";
import { buildGirodiscSourceRecordDraft, normalizeGirodiscSnapshotProduct, type GirodiscSnapshotProduct } from "../../../src/lib/shopCatalogGirodiscNormalization";
function product(title: string, tags: string[] = []): GirodiscSnapshotProduct { return { id: "giro-product", slug: "giro-product", sku: "A1-1", scope: "SHOP", title: { ua: title, en: title }, tags,
  variants: [{ id: "giro-variant", sku: "A1-1", isDefault: true }] }; }
test("GiroDisc correlates multi-model chassis", () => { const result = normalizeGirodiscSnapshotProduct(product("GIRODISC A1 Rotor for MERCEDES CLS63 (W218)/E63 (W212) 2012-2018", ["car_make:mercedes"]));
  assert.deepEqual(result.applications.map((app) => `${app.model}:${app.generation}`), ["CLS63:W218", "E63:W212"]); });
test("GiroDisc strips piston dimensions from title-derived model", () => { const result = normalizeGirodiscSnapshotProduct(product("GIRODISC CCRK1-058 Remкомплект PORSCHE 993 C2 36mm/44mm")); assert.equal(result.applications[0]?.model, "993 C2"); });
test("GiroDisc generic hardware remains parent-review-only", () => { const result = normalizeGirodiscSnapshotProduct(product("GIRODISC HWK-8-L Hardware Kit 8 Long Pins")); assert.equal(result.mode, "NEEDS_REVIEW"); assert.ok(result.issues.includes("parent_or_vehicle_application_unresolved")); });
test("GiroDisc draft maps legacy scope and preserves every leaf", () => { const input = product("GIRODISC A1 Rotor for PORSCHE 911 (992)", ["car_make:porsche"]), draft = buildGirodiscSourceRecordDraft({ product: input, sourceRevision: "v1" });
  assert.equal(draft.provenance.find((entry) => entry.fieldPath === "scope")?.normalizedValue, "auto"); assert.ok(draft.provenance.every((entry) => entry.mappingStatus === "MAPPED")); });
