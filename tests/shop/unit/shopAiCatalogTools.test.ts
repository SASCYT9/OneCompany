import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopAiComparisonSet,
  buildShopAiNoExactMatchMessage,
  runShopAiCandidatePipeline,
} from "../../../src/lib/shopAiCatalogTools";
import type { ShopAiPlan, ShopAiProduct } from "../../../src/lib/shopAiAssistantTypes";

const plan: ShopAiPlan = {
  intent: "recommend",
  vehicle: {
    type: "car",
    make: "BMW",
    model: "M5",
    chassis: "G90",
    year: 2025,
    engine: null,
  },
  category: "chipTuning",
  searchQuery: "BMW M5 G90 +100 hp",
  minPrice: null,
  maxPrice: null,
  powerGainHp: 100,
  needsClarification: false,
  clarification: null,
};

function candidate(id: string, brand: string, chassis: string, gain: number | null): ShopAiProduct {
  return {
    id,
    name: `${brand} BMW M5 ${chassis}${gain ? ` +${gain} hp` : ""}`,
    brand,
    partNumber: id,
    description: gain ? `Claimed gain +${gain} hp` : "Performance product",
    thumbnail: null,
    inStock: true,
    price: 1000,
    slug: id,
    variantId: null,
    turn14Id: "",
    fitments: [
      {
        make: "BMW",
        models: ["M5"],
        chassisCodes: [chassis],
        yearRanges: [{ from: 2024, to: null }],
      },
    ],
  };
}

test("hard constraints reject a wrong chassis and missing power evidence", () => {
  const result = runShopAiCandidatePipeline({
    products: [
      candidate("g90", "RaceChip", "G90", 136),
      candidate("f90", "RaceChip", "F90", 120),
      candidate("unknown-gain", "Burger", "G90", null),
    ],
    plan,
    message: "BMW M5 G90 +100 hp",
  });
  assert.deepEqual(
    result.products.map((product) => product.id),
    ["g90"]
  );
  assert.equal(result.rejected.incompatibleVehicle, 1);
  assert.equal(result.rejected.missingRequestedEvidence, 1);
});

test("comparison prefers distinct brands", () => {
  const products = [
    candidate("a1", "Akrapovic", "G90", 100),
    candidate("a2", "Akrapovic", "G90", 110),
    candidate("r1", "Remus", "G90", 100),
    candidate("i1", "iPE", "G90", 100),
  ];
  assert.deepEqual(
    buildShopAiComparisonSet(products).map((product) => product.brand),
    ["Akrapovic", "Remus", "iPE"]
  );
});

test("explicit OPF selection rejects NON-OPF and unknown configurations", () => {
  const exhaustPlan: ShopAiPlan = {
    ...plan,
    category: "exhaust",
    powerGainHp: null,
    opfGpf: "with",
  };
  const opf = { ...candidate("opf", "Akrapovic", "G90", null), name: "G90 exhaust OPF / GPF" };
  const nonOpf = { ...candidate("non-opf", "Akrapovic", "G90", null), name: "G90 exhaust NON OPF" };
  const unknown = { ...candidate("unknown", "Remus", "G90", null), name: "G90 sport exhaust" };
  const result = runShopAiCandidatePipeline({
    products: [opf, nonOpf, unknown],
    plan: exhaustPlan,
    message: "BMW M5 G90 exhaust with OPF",
  });
  assert.deepEqual(
    result.products.map((product) => product.id),
    ["opf"]
  );
  assert.equal(result.products[0].facts?.opfGpf, "with");
});

test("high-confidence exact chassis is marked as confirmed", () => {
  const product = candidate("confirmed", "Remus", "G90", null);
  product.fitments![0].confidence = "high";
  product.fitmentStatus = "verified";
  product.fitmentSource = "manual";
  const result = runShopAiCandidatePipeline({
    products: [product],
    plan: { ...plan, powerGainHp: null },
    message: "BMW M5 G90",
  });
  assert.equal(result.products[0].compatibility, "confirmed");
});

test("automatic high-confidence fitment is not presented as confirmed", () => {
  const product = candidate("inferred", "Remus", "G90", null);
  product.fitments![0].confidence = "high";
  product.fitmentStatus = "inferred";
  product.fitmentSource = "automatic";
  const result = runShopAiCandidatePipeline({
    products: [product],
    plan: { ...plan, powerGainHp: null },
    message: "BMW M5 G90",
  });
  assert.equal(result.products[0].compatibility, "likely");
});

test("an explicit engine code rejects products for another engine", () => {
  const s68 = { ...candidate("s68", "Burger", "G90", null), description: "JB4 tuner for S68" };
  const b58 = { ...candidate("b58", "Burger", "G90", null), description: "JB4 tuner for B58" };
  const result = runShopAiCandidatePipeline({
    products: [s68, b58],
    plan: { ...plan, powerGainHp: null, vehicle: { ...plan.vehicle, engine: "S68" } },
    message: "BMW M5 G90 S68 tuner",
  });
  assert.deepEqual(
    result.products.map((product) => product.id),
    ["s68"]
  );
});

test("an explicit model year requires product-owned year evidence", () => {
  const current = candidate("current", "Remus", "G90", null);
  current.fitments![0].yearRanges = [{ from: 2024, to: null }];
  const old = candidate("old", "Remus", "G90", null);
  old.fitments![0].yearRanges = [{ from: 2018, to: 2023 }];
  const result = runShopAiCandidatePipeline({
    products: [current, old],
    plan: { ...plan, powerGainHp: null, vehicle: { ...plan.vehicle, year: 2025 } },
    message: "BMW M5 G90 2025",
  });
  assert.deepEqual(
    result.products.map((product) => product.id),
    ["current"]
  );
});

test("a complete exhaust request excludes tips, downpipes and link pipes", () => {
  const products = [
    { ...candidate("system", "Akrapovic", "G90", null), name: "Slip-On exhaust system" },
    {
      ...candidate("system-with-tips", "Remus", "G90", null),
      name: "Sport Exhaust for BMW M5 G90 with Carbon Tips",
    },
    { ...candidate("tips", "Akrapovic", "G90", null), name: "Carbon exhaust tips" },
    { ...candidate("downpipe", "Remus", "G90", null), name: "Sport downpipe" },
    { ...candidate("link", "Remus", "G90", null), name: "Stainless link pipe" },
    {
      ...candidate("ua-link", "Akrapovic", "G90", null),
      name: "Комплект лінк-пайпів Evolution",
    },
  ];
  const result = runShopAiCandidatePipeline({
    products,
    plan: {
      ...plan,
      category: "exhaust",
      productKind: "system",
      powerGainHp: null,
    },
    message: "BMW M5 G90 exhaust system",
  });
  assert.deepEqual(
    result.products.map((product) => product.id),
    ["system", "system-with-tips"]
  );
  assert.equal(result.products[0].facts?.productKind, "system");
});

test("no-match copy names hard constraints and refuses an incompatible substitute", () => {
  const message = buildShopAiNoExactMatchMessage("ua", {
    ...plan,
    category: "exhaust",
    productKind: "system",
    opfGpf: "with",
    powerGainHp: null,
  });
  assert.match(message, /BMW M5 G90 2025/);
  assert.match(message, /OPF\/GPF/);
  assert.match(message, /повна вихлопна система/);
  assert.match(message, /іншого кузова/);
});
