import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupplementalCatalogSourceRecordDraft,
  normalizeSupplementalCatalogSnapshotProduct,
} from "../../../src/lib/shopCatalogSupplementalNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../../../src/lib/shopCatalogSourceCoverage";

const product = {
  id: "product-fi-rsq8",
  slug: "fi-exhaust-audi-rsq8",
  sku: "AD-Q8RS-CBOE",
  scope: "auto",
  brand: "Fi EXHAUST",
  title: { ua: "Fi EXHAUST для Audi RSQ8", en: "Fi EXHAUST for Audi RSQ8" },
  tags: ["Fi Exhaust", "AUDI"],
  variants: [{ id: "variant-fi-rsq8", sku: "AD-Q8RS-CBOE", isDefault: true }],
};

test("supplemental sources preserve products without inventing verified fitment", () => {
  const normalization = normalizeSupplementalCatalogSnapshotProduct(product, "fi-exhaust");
  assert.equal(normalization.productId, product.id);
  assert.equal(normalization.variantId, null);
  assert.equal(normalization.verification, "NEEDS_REVIEW");
  assert.equal(normalization.mode, "NEEDS_REVIEW");
  assert.deepEqual(normalization.applications, []);
  assert.deepEqual(normalization.issues, ["compatibility_evidence_requires_review"]);
});

test("supplemental evidence accounts for every immutable raw field", () => {
  const draft = buildSupplementalCatalogSourceRecordDraft({
    product,
    sourceRevision: "fixture-v1",
    expectedSource: "fi-exhaust",
  });
  const coverage = buildShopCatalogSourceRecordCoverage({
    recordKey: draft.sourceRecord.recordKey,
    rawPayload: draft.sourceRecord.rawPayload,
    sourceRevision: draft.sourceRecord.sourceRevision,
    payloadHash: draft.sourceRecord.payloadHash,
    provenance: draft.provenance,
  });
  assert.equal(coverage.coveragePercent, 100);
  assert.equal(coverage.missing.length, 0);
  assert.equal(coverage.invalid.length, 0);
  assert.equal(coverage.payloadHashMatches, true);
});

test("supplemental adapters fail closed when a partition receives another brand", () => {
  assert.throws(
    () => normalizeSupplementalCatalogSnapshotProduct(product, "kw-suspensions"),
    /Supplemental source mismatch/
  );
});

test("Revozport retains official SKU fitment clauses and quarantines unresolved rows", () => {
  const fitment = {
    version: 2,
    mode: "vehicle_specific",
    scope: "auto",
    policy: {
      requiredDimensions: ["make", "model"],
      clauses: [{
        id: "revozport-rs5-b95",
        verification: "VERIFIED",
        provenance: {
          sourceRef: "https://revozport.com/products/audi-rs5-b9-5-front-lip",
          sourceRecordKey: "RZ-AD-1017",
          rawPaths: ["inventory.AUDI.row.4.PRODUCT NAME"],
          evidenceRefs: ["sku:RZ-AD-1017", "official:audi-rs5-b9-5-front-lip"],
        },
        constraints: [
          { dimension: "scope", state: "EXACT", values: ["auto"] },
          { dimension: "make", state: "EXACT", values: ["Audi"] },
          { dimension: "model", state: "EXACT", values: ["RS5"] },
          { dimension: "generation", state: "EXACT", values: ["B9.5"] },
          { dimension: "chassis", state: "EXACT", values: ["B9.5"] },
          { dimension: "year", state: "UNKNOWN" },
          { dimension: "engine", state: "UNKNOWN" },
          { dimension: "fuel", state: "UNKNOWN" },
          { dimension: "bodyStyle", state: "UNKNOWN" },
          { dimension: "drivetrain", state: "UNKNOWN" },
          { dimension: "transmission", state: "UNKNOWN" },
          { dimension: "market", state: "UNKNOWN" },
          { dimension: "opfGpf", state: "UNKNOWN" },
        ],
      }],
    },
    parentSku: null,
    source: {
      supplier: "Revozport",
      sourceRef: "https://revozport.com/products/audi-rs5-b9-5-front-lip",
      sourceUpdatedAt: "2026-09-23T00:00:00Z",
      sourceKey: "revozport-inventory-pricing",
      sourceRecordKey: "RZ-AD-1017",
      sourceRevision: "a".repeat(64),
      payloadHash: "b".repeat(64),
      mapperVersion: "revozport-fitment-v2.1",
    },
    note: "Fitment from exact Revozport SKU and official product page.",
  };
  const revozportProduct = {
    ...product,
    id: "product-revozport-rs5",
    slug: "revozport-rz-ad-1017",
    sku: "RZ-AD-1017",
    brand: "Revozport",
    fitment,
    fitmentAudit: [{ resolution: "official_sku_url_confirmed" }],
  };
  const normalization = normalizeSupplementalCatalogSnapshotProduct(revozportProduct, "revozport");
  assert.equal(normalization.mode, "VEHICLE_SPECIFIC");
  assert.ok(normalization.compatibilityPolicy);
  assert.equal(normalization.compatibilityPolicy.clauses[0]!.verification, "VERIFIED");
  assert.deepEqual(normalization.applications, [{
    scope: "auto",
    make: "Audi",
    model: "RS5",
    generation: "B9.5",
    yearFrom: null,
    yearTo: null,
    engineCode: null,
    fuel: null,
    opfGpf: "unknown",
    transmission: null,
  }]);

  const faceliftFitment = structuredClone(fitment) as any;
  faceliftFitment.policy.clauses[0].id = "revozport-x6-f96-pre-lci";
  faceliftFitment.policy.clauses[0].constraints.find((item: any) => item.dimension === "make").values = ["BMW"];
  faceliftFitment.policy.clauses[0].constraints.find((item: any) => item.dimension === "model").values = ["X6 M"];
  faceliftFitment.policy.clauses[0].constraints.find((item: any) => item.dimension === "generation").values = ["F96 PRE-LCI"];
  faceliftFitment.policy.clauses[0].constraints.find((item: any) => item.dimension === "chassis").values = ["F96"];
  const facelift = normalizeSupplementalCatalogSnapshotProduct({
    ...revozportProduct,
    id: "product-revozport-x6-f96",
    slug: "revozport-x6-f96-pre-lci",
    sku: "RZ-BM-1028",
    fitment: faceliftFitment,
  }, "revozport");
  assert.equal(facelift.compatibilityPolicy?.clauses[0]?.constraints.find((item) => item.dimension === "generation")?.state, "EXACT");
  assert.deepEqual(facelift.applications[0], {
    scope: "auto",
    make: "BMW",
    model: "X6 M",
    generation: "F96 PRE-LCI",
    yearFrom: null,
    yearTo: null,
    engineCode: null,
    fuel: null,
    opfGpf: "unknown",
    transmission: null,
  });

  const needsReview = normalizeSupplementalCatalogSnapshotProduct({
    ...revozportProduct,
    fitmentAudit: [{ resolution: "ambiguous_or_missing_sku" }],
  }, "revozport");
  assert.ok(needsReview.issues.includes("fitment_source_rows_need_review:1"));
});
