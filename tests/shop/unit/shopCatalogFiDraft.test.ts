import assert from "node:assert/strict";
import test from "node:test";

import { buildFiCanonicalDraft, type FiSourceProduct } from "../../../src/lib/shopCatalogFiDraft";
import { compatibilityPolicyFromNormalizedFitment } from "../../../src/lib/shopCatalogAdminSnapshot.server";
import { parseNormalizedFitment } from "../../../src/lib/shopFitmentQuality";
import { strictMatchShopCatalogV2Compatibility } from "../../../src/lib/shopCatalogV2Compatibility";

test("Fi draft keeps exact commerce data, removes iframe from copy and preserves it as media", () => {
  const product: FiSourceProduct = {
    id: 1,
    title: "Fi EXHAUST Valvetronic Exhaust System для BMW M5",
    handle: "fi-bmw-m5",
    body_html:
      '<p>Опис</p><p><strong>Комплектація:</strong></p><ul><li>Mid Pipe + Valvetronic Muffler</li></ul><iframe src="https://www.youtube.com/embed/abcDEF123"></iframe>',
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    vendor: "BMW",
    product_type: "Вихлопна система",
    tags: ["Fi Exhaust"],
    variants: [
      {
        id: 2,
        title: "Default Title",
        sku: "BN-M5-CBE",
        available: true,
        price: "100.00",
        compare_at_price: null,
        position: 1,
      },
    ],
    images: [
      { id: 3, position: 1, src: "https://cdn.shopify.com/a.jpg", width: 1000, height: 700 },
    ],
  };
  const draft = buildFiCanonicalDraft(product, {
    id: "gid://shopify/Product/1",
    handle: product.handle,
    status: "CSV_CORRELATED",
    applications: [{ brand: "BMW", model: "M5", body: "G90" }],
  });
  assert.equal(draft.product.sku, "BN-M5-CBE");
  assert.equal(draft.product.priceUah, "100.00");
  assert.equal(draft.product.stock, "preOrder");
  assert.equal(draft.product.isPublished, false);
  assert.equal(draft.product.titleEn, "Fi EXHAUST Valve-Controlled Exhaust System for BMW M5 G90");
  assert.equal(draft.product.titleUa, "Fi EXHAUST: вихлопна система з клапанним керуванням для BMW M5");
  assert.doesNotMatch(draft.product.bodyHtmlUa, /iframe/u);
  assert.doesNotMatch(draft.product.bodyHtmlEn, /[\u0400-\u04ff]/u);
  assert.deepEqual(
    draft.media.map((media) => media.mediaType),
    ["IMAGE", "EXTERNAL_VIDEO"]
  );
  assert.equal(draft.variants[0]?.title, null);
  assert.equal(draft.applications.length, 1);
});

test("Fi draft blocks missing required source data but treats missing source image separately", () => {
  const draft = buildFiCanonicalDraft(
    {
      id: 9,
      title: "Fi EXHAUST для Test",
      handle: "test",
      body_html: "<p>Опис</p>",
      published_at: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      vendor: "Test",
      product_type: "",
      tags: [],
      variants: [],
      images: [],
    },
    { id: "9", handle: "test", status: "REVIEW_REQUIRED", applications: [] }
  );
  assert.ok(draft.issues.includes("fitment_missing"));
  assert.ok(draft.issues.includes("fitment_review_required"));
  assert.ok(draft.issues.includes("sku_missing"));
  assert.ok(draft.issues.includes("images_missing"));
});

test("Fi review, unknown-status, empty, and incomplete entries cannot create verified policies", () => {
  const product: FiSourceProduct = {
    id: 10,
    title: "Fi EXHAUST BMW M5",
    handle: "fi-review",
    body_html: "<p>Source</p>",
    published_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    vendor: "Fi EXHAUST",
    product_type: "Exhaust",
    tags: [],
    variants: [
      {
        id: 11,
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
  const cases = [
    {
      status: "REVIEW_REQUIRED",
      applications: [{ brand: "BMW", model: "M5", body: "G90" }],
      note: "fi_fitment_review_required",
    },
    {
      status: "UNRECOGNIZED",
      applications: [{ brand: "BMW", model: "M5", body: "G90" }],
      note: "fi_fitment_status_unrecognized",
    },
    { status: "CSV_CORRELATED", applications: [], note: "fi_fitment_applications_incomplete" },
    {
      status: "CSV_CORRELATED",
      applications: [{ brand: "", model: "M5", body: "G90" }],
      note: "fi_fitment_applications_incomplete",
    },
    {
      status: "CSV_CORRELATED",
      applications: [{ brand: "BMW", model: " ", body: "G90" }],
      note: "fi_fitment_applications_incomplete",
    },
  ];
  for (const current of cases) {
    const draft = buildFiCanonicalDraft(product, {
      id: "10",
      handle: product.handle,
      status: current.status,
      applications: current.applications,
    });
    const metafield = draft.metafields.find(
      (field) => field.namespace === "onecompany" && field.key === "normalized_fitment"
    );
    const raw = JSON.parse(metafield!.value) as { applications: unknown[] };
    const normalized = parseNormalizedFitment(metafield?.value);
    assert.equal(raw.applications.length, current.applications.length);
    assert.deepEqual(draft.applications, current.applications);
    assert.equal(normalized?.status, "needs_review");
    assert.equal(normalized?.confidence, "unknown");
    assert.equal(normalized?.note, current.note);
    const policy = compatibilityPolicyFromNormalizedFitment("fi-review", normalized);
    assert.equal(policy.mode, "NEEDS_REVIEW");
    assert.ok(policy.clauses.every((clause) => clause.verification === "NEEDS_REVIEW"));
    assert.notEqual(
      strictMatchShopCatalogV2Compatibility(policy, { scope: "auto", make: "BMW", model: "M5" })
        .status,
      "exact"
    );
  }
});

test("Fi correlated and reviewed statuses preserve verified imported fitment", () => {
  const product: FiSourceProduct = {
    id: 12,
    title: "Fi EXHAUST BMW M5",
    handle: "fi-correlated",
    body_html: "<p>Source</p>",
    published_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    vendor: "Fi EXHAUST",
    product_type: "Exhaust",
    tags: [],
    variants: [
      {
        id: 13,
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
  for (const status of ["CSV_CORRELATED", "METAFIELD_EXACT_SINGLE", "REVIEWED_OVERRIDE"]) {
    const draft = buildFiCanonicalDraft(product, {
      id: "12",
      handle: product.handle,
      status,
      applications: [{ brand: "BMW", model: "M5", body: "G90" }],
    });
    const metafield = draft.metafields.find(
      (field) => field.namespace === "onecompany" && field.key === "normalized_fitment"
    );
    const normalized = parseNormalizedFitment(metafield?.value);
    assert.equal(normalized?.status, "verified");
    assert.equal(normalized?.confidence, "high");
    assert.equal(
      compatibilityPolicyFromNormalizedFitment("fi-correlated", normalized).clauses[0]
        ?.verification,
      "VERIFIED"
    );
  }
});
