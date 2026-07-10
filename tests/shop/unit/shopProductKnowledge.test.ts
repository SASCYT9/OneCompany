import assert from "node:assert/strict";
import test from "node:test";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { buildShopProductKnowledge } from "../../../src/lib/shopProductKnowledge";

function product(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: "product-1",
    slug: "racechip-bmw-m5-g90",
    sku: "RC-M5-G90",
    scope: "auto",
    brand: "RaceChip",
    title: { ua: "RaceChip BMW M5 G90 +136 к.с.", en: "RaceChip BMW M5 G90 +136 hp" },
    category: { ua: "Чіп-тюнінг", en: "Chip tuning" },
    shortDescription: { ua: "Приріст +136 к.с. та +180 Нм", en: "+136 hp and +180 Nm" },
    longDescription: { ua: "", en: "Plug-and-play installation" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 1000, usd: 1100, uah: 45000 },
    image: "",
    highlights: [],
    tags: ["BMW", "M5", "G90"],
    ...overrides,
  };
}

test("builds deterministic structured knowledge from product facts", () => {
  const knowledge = buildShopProductKnowledge(product());
  assert.ok(knowledge);
  assert.equal(knowledge.productId, "product-1");
  assert.equal(knowledge.categoryGroup, "chipTuning");
  assert.equal(knowledge.powerGainHp, 136);
  assert.equal(knowledge.torqueGainNm, 180);
  assert.equal(knowledge.installationType, "direct_fit");
  assert.ok(knowledge.chassisCodes.includes("G90"));
  assert.equal(knowledge.contentHash.length, 64);
});

test("does not invent gains from percentages", () => {
  const knowledge = buildShopProductKnowledge(
    product({
      title: { ua: "Тюнінг BMW M5 G90", en: "BMW M5 G90 tuning" },
      shortDescription: { ua: "До 20% потужності", en: "Up to 20% more power" },
    })
  );
  assert.ok(knowledge);
  assert.equal(knowledge.powerGainHp, null);
});

test("manual normalized fitment overrides inferred chassis", () => {
  const persisted = JSON.stringify({
    version: 2,
    status: "verified",
    vehicleType: "car",
    make: "BMW",
    models: ["M5"],
    chassisCodes: ["G90"],
    yearRanges: [{ from: 2024, to: null }],
    applications: [
      {
        vehicleType: "car",
        make: "BMW",
        models: ["M5"],
        chassisCodes: ["G90"],
        yearRanges: [{ from: 2024, to: null }],
        engines: ["S68"],
        bodyStyles: ["sedan"],
        drivetrains: ["AWD"],
        markets: ["EU"],
      },
    ],
    confidence: "high",
    source: "manual",
    verifiedAt: "2026-07-10T00:00:00.000Z",
    verifiedBy: "test",
    note: null,
  });
  const knowledge = buildShopProductKnowledge(product(), persisted);
  assert.ok(knowledge);
  assert.equal(knowledge.fitmentStatus, "verified");
  assert.equal(knowledge.fitmentSource, "manual");
  assert.deepEqual(knowledge.engines, ["S68"]);
  assert.deepEqual(knowledge.markets, ["EU"]);
});
