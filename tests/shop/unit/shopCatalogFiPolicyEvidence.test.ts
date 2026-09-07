import assert from "node:assert/strict";
import test from "node:test";

import { buildFiPolicyEvidence } from "../../../src/lib/shopCatalogFiPolicyEvidence";
import type { FiSourceProduct } from "../../../src/lib/shopCatalogFiDraft";

const product: FiSourceProduct = {
  id: 42,
  title: "Fi EXHAUST BMW M5",
  handle: "fi-bmw-m5",
  body_html: "<p>Source</p>",
  published_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  vendor: "Fi EXHAUST",
  product_type: "Exhaust",
  tags: ["fitment"],
  variants: [
    {
      id: 43,
      title: "Default",
      sku: "FI-M5",
      available: true,
      price: "100",
      compare_at_price: null,
      position: 1,
    },
  ],
  images: [],
};

const fitment = {
  id: "42",
  handle: product.handle,
  status: "REVIEW_REQUIRED",
  applications: [{ brand: "BMW", model: "M5", body: "G90" }],
};

test("FI evidence rejects cross-product identity mismatches", () => {
  assert.throws(
    () => buildFiPolicyEvidence({ product, fitment: { ...fitment, id: "99" } }),
    /identity mismatch/
  );
  assert.throws(
    () =>
      buildFiPolicyEvidence({ product, fitment: { ...fitment, id: "gid://shopify/Product/99" } }),
    /identity mismatch/
  );
  assert.throws(
    () =>
      buildFiPolicyEvidence({
        product,
        fitment: { ...fitment, id: "gid://shopify/Product/42/extra" },
      }),
    /identity mismatch/
  );
  assert.throws(
    () => buildFiPolicyEvidence({ product, fitment: { ...fitment, handle: "other" } }),
    /handle mismatch/
  );
});

test("FI evidence accepts the decimal and Shopify GID identity forms", () => {
  assert.equal(buildFiPolicyEvidence({ product, fitment }).sourceRecord.recordKey, "42");
  assert.equal(
    buildFiPolicyEvidence({ product, fitment: { ...fitment, id: "gid://shopify/Product/42" } })
      .sourceRecord.recordKey,
    "42"
  );
});

test("FI evidence hash changes when raw fitment changes", () => {
  const first = buildFiPolicyEvidence({ product, fitment }).sourceRecord;
  const second = buildFiPolicyEvidence({
    product,
    fitment: { ...fitment, status: "CSV_CORRELATED" },
  }).sourceRecord;
  assert.notEqual(first.payloadHash, second.payloadHash);
  assert.notEqual(first.sourceRevision, second.sourceRevision);
});

test("FI evidence round-trips review status and raw applications without mutation", () => {
  const originalProduct = structuredClone(product);
  const originalFitment = structuredClone(fitment);
  const evidence = buildFiPolicyEvidence({ product, fitment }).sourceRecord;
  assert.deepEqual(evidence.rawPayload, {
    mapperVersion: "fi-policy-evidence-v1",
    product,
    fitment,
  });
  assert.deepEqual(product, originalProduct);
  assert.deepEqual(fitment, originalFitment);
  assert.equal(evidence.recordKey, "42");
  assert.match(evidence.sourceRevision, /^fi-policy-evidence-v1:[a-f0-9]{64}$/);
});
