import test from "node:test";
import assert from "node:assert/strict";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import {
  classifyProductFitment,
  isNormalizedFitmentMetafield,
  mergePersistedFitment,
  normalizeManualFitment,
  parseNormalizedFitment,
  resolveSearchFitment,
  resolveSearchFitments,
} from "../../../src/lib/shopFitmentQuality";

function product(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    slug: "test-product",
    sku: "TEST-1",
    scope: "auto",
    brand: "Test",
    title: { ua: "Тестовий товар", en: "Test product" },
    category: { ua: "Аксесуари", en: "Accessories" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    highlights: [],
    ...overrides,
  };
}

test("high-confidence vehicle fitment is inferred, not silently verified", () => {
  const result = classifyProductFitment(product(), {
    make: "BMW",
    models: ["M3"],
    chassisCodes: ["g80"],
    yearRanges: [{ from: 2021, to: null }],
    confidence: "high",
  });

  assert.equal(result.status, "inferred");
  assert.equal(result.vehicleType, "car");
  assert.deepEqual(result.chassisCodes, ["G80"]);
});

test("unknown explicit universal products are separated from review defects", () => {
  const universal = classifyProductFitment(
    product({ title: { ua: "Універсальний хомут", en: "Universal exhaust clamp" } }),
    { make: null, models: [], chassisCodes: [], yearRanges: [], confidence: "unknown" }
  );
  const incomplete = classifyProductFitment(product(), {
    make: null,
    models: [],
    chassisCodes: [],
    yearRanges: [],
    confidence: "unknown",
  });

  assert.equal(universal.status, "universal");
  assert.equal(incomplete.status, "needs_review");
});

test("GiroDisc replacement rings inherit compatibility from the matching rotor kit", () => {
  const result = classifyProductFitment(
    product({
      brand: "GiroDisc",
      sku: "D1-264",
      title: { ua: "Змінне кільце", en: "Replacement rotor ring" },
    }),
    { make: null, models: [], chassisCodes: [], yearRanges: [], confidence: "unknown" }
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.make, null);
  assert.deepEqual(result.dependency, { type: "parent_product", parentSku: "A1-264" });
});

test("dimensional DO88 plumbing is classified as universal instead of missing fitment", () => {
  const result = classifyProductFitment(
    product({
      brand: "DO88",
      sku: "H75-90",
      title: { ua: "Силіконове коліно 75 мм 90°", en: "Silicone hose elbow 75 mm 90 degrees" },
    }),
    { make: null, models: [], chassisCodes: [], yearRanges: [], confidence: "unknown" }
  );

  assert.equal(result.status, "universal");
  assert.equal(result.vehicleType, "universal");
});

test("low-confidence make-only extraction remains in review", () => {
  const result = classifyProductFitment(product(), {
    make: "BMW",
    models: [],
    chassisCodes: [],
    yearRanges: [],
    confidence: "low",
  });

  assert.equal(result.status, "needs_review");
  assert.equal(result.make, "BMW");
});

test("persisted universal mapping clears incompatible vehicle fields", () => {
  const persisted = parseNormalizedFitment(
    JSON.stringify({
      version: 1,
      status: "universal",
      vehicleType: "car",
      make: "BMW",
      models: ["M3"],
      chassisCodes: ["G80"],
      yearRanges: [{ from: 2021, to: null }],
      confidence: "high",
      source: "manual",
      verifiedAt: "2026-07-10T12:00:00.000Z",
      verifiedBy: "admin@example.com",
      note: "Confirmed universal",
    })
  );

  assert.equal(persisted?.vehicleType, "universal");
  assert.equal(persisted?.make, null);
  assert.deepEqual(persisted?.models, []);
});

test("invalid persisted payload falls back to automatic classification", () => {
  const automatic = classifyProductFitment(product(), {
    make: null,
    models: [],
    chassisCodes: [],
    yearRanges: [],
    confidence: "unknown",
  });

  assert.equal(mergePersistedFitment(automatic, "not-json"), automatic);
});

test("manual verification requires a make and records the reviewer", () => {
  const invalid = normalizeManualFitment({ status: "verified", vehicleType: "car" }, "admin");
  const valid = normalizeManualFitment(
    {
      status: "verified",
      vehicleType: "car",
      make: "BMW",
      models: ["M3"],
      chassisCodes: ["g80"],
      yearRanges: [{ from: 2021, to: null }],
    },
    "admin@example.com",
    new Date("2026-07-10T12:00:00.000Z")
  );

  assert.equal(invalid.data, null);
  assert.equal(valid.data?.verifiedBy, "admin@example.com");
  assert.equal(valid.data?.verifiedAt, "2026-07-10T12:00:00.000Z");
  assert.deepEqual(valid.data?.chassisCodes, ["G80"]);
});

test("search trusts verified mappings and excludes manual review placeholders", () => {
  const automatic = {
    make: "BMW",
    models: [],
    chassisCodes: [],
    yearRanges: [],
    confidence: "low" as const,
  };
  const verified = normalizeManualFitment(
    { status: "verified", vehicleType: "car", make: "BMW", models: ["M3"] },
    "admin"
  ).data!;
  const review = normalizeManualFitment(
    { status: "needs_review", vehicleType: "car", make: "BMW" },
    "admin"
  ).data!;

  assert.deepEqual(resolveSearchFitment(automatic, JSON.stringify(verified)).models, ["M3"]);
  assert.equal(resolveSearchFitment(automatic, JSON.stringify(review)).make, null);
});

test("normalized fitment metafield is recognized as protected system data", () => {
  assert.equal(
    isNormalizedFitmentMetafield({ namespace: "onecompany", key: "normalized_fitment" }),
    true
  );
  assert.equal(
    isNormalizedFitmentMetafield({ namespace: "custom", key: "normalized_fitment" }),
    false
  );
});

test("manual mapping preserves multiple independent vehicle applications", () => {
  const normalized = normalizeManualFitment(
    {
      status: "verified",
      applications: [
        {
          vehicleType: "car",
          make: "Toyota",
          models: ["GR86"],
          chassisCodes: ["ZN8"],
          yearRanges: [{ from: 2022, to: null }],
        },
        {
          vehicleType: "car",
          make: "Subaru",
          models: ["BRZ"],
          chassisCodes: ["ZD8"],
          yearRanges: [{ from: 2022, to: null }],
        },
      ],
    },
    "admin"
  ).data!;
  const searchFitments = resolveSearchFitments(
    { make: null, models: [], chassisCodes: [], yearRanges: [], confidence: "unknown" },
    JSON.stringify(normalized)
  );

  assert.equal(normalized.version, 2);
  assert.equal(normalized.applications.length, 2);
  assert.deepEqual(
    searchFitments.map((fitment) => fitment.make),
    ["Toyota", "Subaru"]
  );
});
