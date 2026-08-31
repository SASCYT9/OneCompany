import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventuriSourceRecordDraft,
  normalizeEventuriSnapshotProduct,
  type EventuriSnapshotProduct,
} from "../../../src/lib/shopCatalogEventuriNormalization";

function product(input: { slug: string; title: string; tags: string[] }): EventuriSnapshotProduct {
  return {
    id: `eventuri-${input.slug}`,
    slug: input.slug,
    sku: `EVE-${input.slug}`,
    scope: "SHOP",
    brand: "Eventuri",
    title: { ua: input.title, en: input.title },
    tags: ["Eventuri", ...input.tags, "store:main"],
    gallery: [],
    variants: [{ id: `variant-${input.slug}`, sku: `EVE-${input.slug}`, isDefault: true }],
  };
}

test("Eventuri cleaning kit is verified universal and never invents vehicle fitment", () => {
  const result = normalizeEventuriSnapshotProduct(product({
    slug: "air-filter-cleaning-kit",
    title: "Air Filter Cleaning Kit",
    tags: ["category:filter-accessory"],
  }));
  assert.equal(result.mode, "UNIVERSAL");
  assert.equal(result.verification, "VERIFIED");
  assert.deepEqual(result.applications, []);
  assert.equal(result.engineRelevant, false);
});

test("Eventuri intake retains correlated models and exact explicit engine code", () => {
  const result = normalizeEventuriSnapshotProduct(product({
    slug: "g8x-m3-m4-s58-black-carbon-intake",
    title: "BMW G8X M3 M4 S58 Carbon Intake",
    tags: ["category:intake", "BMW", "M3", "G80", "G81", "M4", "G82", "G83", "S58"],
  }));
  assert.equal(result.mode, "VEHICLE_SPECIFIC");
  assert.equal(result.verification, "VERIFIED");
  assert.deepEqual(result.applications.map(({ model, generation, engineCode }) => [model, generation, engineCode]), [
    ["M3", "G80", "S58"],
    ["M3", "G81", "S58"],
    ["M4", "G82", "S58"],
    ["M4", "G83", "S58"],
  ]);
});

test("Eventuri physical intake without engine evidence remains review-only", () => {
  const result = normalizeEventuriSnapshotProduct(product({
    slug: "f87-m2-black-carbon-intake",
    title: "BMW F87 M2 Carbon Intake",
    tags: ["category:intake", "BMW", "M2", "F87"],
  }));
  assert.equal(result.mode, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("engine_identity_missing"));
  assert.equal(result.applications[0]?.engineCode, null);
});

test("Eventuri replacement filter requires parent resolution rather than false universal fitment", () => {
  const result = normalizeEventuriSnapshotProduct(product({
    slug: "eventuri-carbon-intake-system-replacement-filter-type-b",
    title: "Eventuri Replacement Filter Type B",
    tags: ["category:filter-accessory"],
  }));
  assert.equal(result.mode, "NEEDS_REVIEW");
  assert.ok(result.issues.includes("parent_product_identity_missing"));
});

test("Eventuri source draft accounts for every raw leaf and audits legacy scope", () => {
  const raw = product({
    slug: "g63-w465-s58-test",
    title: "Mercedes-AMG G63 W465 M139 intake 2025+",
    tags: ["category:intake", "Mercedes-Benz", "G63 W465", "G63", "W465", "M139"],
  });
  const draft = buildEventuriSourceRecordDraft({ product: raw, sourceRevision: "eventuri-v1" });
  assert.equal(draft.normalization.applications[0]?.model, "G63");
  assert.equal(draft.normalization.applications[0]?.generation, "W465");
  assert.ok(draft.provenance.some((entry) => entry.fieldPath === "scope" && entry.reason));
});
