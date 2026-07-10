import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackShopAiPlan,
  normalizeShopAiPlan,
} from "../../../src/lib/shopAiAssistantPlanner";

const context = { locale: "ua" as const, currency: "EUR" as const };

test("planner infers a tuning category and asks for missing vehicle", () => {
  const plan = buildFallbackShopAiPlan("Потрібен вихлоп", context);

  assert.equal(plan.category, "exhaust");
  assert.equal(plan.needsClarification, true);
});

test("planner inherits vehicle selected on the Stock page", () => {
  const plan = normalizeShopAiPlan(
    { category: "brakes", needsClarification: false, vehicle: {} },
    "Покажи гальма для цього авто",
    { ...context, make: "BMW", model: "M3", chassis: "F80" }
  );

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M3");
  assert.equal(plan.vehicle.chassis, "F80");
  assert.equal(plan.needsClarification, false);
});

test("planner rejects unsupported categories and invalid price values", () => {
  const plan = normalizeShopAiPlan(
    { category: "phones", minPrice: -10, maxPrice: "not-a-number" },
    "Порадь щось",
    context
  );

  assert.equal(plan.category, null);
  assert.equal(plan.minPrice, null);
  assert.equal(plan.maxPrice, null);
});

test("planner does not convert absent price limits to zero", () => {
  const plan = normalizeShopAiPlan(
    { category: "exhaust", minPrice: null, maxPrice: null, vehicle: { make: "BMW", model: "M3" } },
    "Підбери вихлоп",
    context
  );

  assert.equal(plan.minPrice, null);
  assert.equal(plan.maxPrice, null);
});

test("fallback planner resolves vehicle and budget without an AI provider", () => {
  const plan = buildFallbackShopAiPlan("Підбери вихлоп для BMW M3 2018 до 3000 EUR", context);

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M3");
  assert.equal(plan.vehicle.year, 2018);
  assert.equal(plan.category, "exhaust");
  assert.equal(plan.maxPrice, 3000);
  assert.equal(plan.needsClarification, false);
});

test("fallback planner inherits a year from the current Stock query", () => {
  const plan = buildFallbackShopAiPlan("Find exhaust for this car", {
    ...context,
    query: "BMW M3 2018",
    make: "BMW",
    model: "M3",
  });

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M3");
  assert.equal(plan.vehicle.year, 2018);
  assert.equal(plan.searchQuery.includes("2018"), true);
});

test("planner recognizes a Ukrainian comparison request deterministically", () => {
  const plan = normalizeShopAiPlan(
    { intent: "recommend", vehicle: { make: "BMW", model: "M5" } },
    "Порівняй найкращі вихлопи",
    { locale: "ua", currency: "EUR" }
  );

  assert.equal(plan.intent, "compare");
});

test("planner keeps a verified Stock chassis instead of an AI typo", () => {
  const plan = normalizeShopAiPlan(
    {
      category: "exhaust",
      needsClarification: true,
      clarification: "G9O is not a standard M5 chassis.",
      vehicle: { make: "BMW", model: "M5", chassis: "G9O" },
    },
    "BMW m5 g9O",
    { ...context, make: "BMW", model: "M5", chassis: "G90" }
  );

  assert.equal(plan.vehicle.chassis, "G90");
  assert.equal(plan.needsClarification, false);
  assert.equal(plan.clarification, null);
});

test("planner normalizes a letter O typo in a chassis code", () => {
  const plan = normalizeShopAiPlan(
    { vehicle: { make: "BMW", model: "M5", chassis: "g9O" } },
    "BMW M5 g9O",
    context
  );

  assert.equal(plan.vehicle.chassis, "G90");
});

test("planner never returns an English clarification for Ukrainian context", () => {
  const plan = normalizeShopAiPlan(
    {
      category: "exhaust",
      needsClarification: true,
      clarification: "Please confirm the exact vehicle model.",
      vehicle: {},
    },
    "Підбери вихлоп",
    context
  );

  assert.equal(plan.needsClarification, true);
  assert.match(plan.clarification ?? "", /[А-ЯІЇЄҐа-яіїєґ]/);
  assert.doesNotMatch(plan.clarification ?? "", /Please confirm/i);
});

test("planner keeps the active Stock category when a follow-up omits it", () => {
  const plan = normalizeShopAiPlan(
    { vehicle: { make: "BMW", model: "M5", chassis: "G90" } },
    "BMW m5 g9O",
    { ...context, category: "exhaust", make: "BMW", model: "M5", chassis: "G90" }
  );

  assert.equal(plan.category, "exhaust");
});

test("planner treats a requested horsepower gain as chip tuning", () => {
  const plan = normalizeShopAiPlan(
    { category: "exhaust", vehicle: { make: "BMW", model: "M5", chassis: "G90" } },
    "BMW M5 G90 + 200 сил хочу",
    { ...context, category: "exhaust", make: "BMW", model: "M5", chassis: "G90" }
  );

  assert.equal(plan.category, "chipTuning");
  assert.equal(plan.powerGainHp, 200);
  assert.equal(plan.vehicle.chassis, "G90");
});

test("fallback planner normalizes a chassis typo from the message itself", () => {
  const plan = buildFallbackShopAiPlan("BMW M5 G9O +100 сил", context);

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M5");
  assert.equal(plan.vehicle.chassis, "G90");
  assert.equal(plan.powerGainHp, 100);
});

test("planner requests OPF details for an exhaust without inventing a configuration", () => {
  const plan = buildFallbackShopAiPlan("Exhaust for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.category, "exhaust");
  assert.equal(plan.opfGpf, null);
  assert.ok(plan.requiredDetails?.includes("opfGpf"));
});

test("planner recognizes an explicit NON-OPF configuration", () => {
  const plan = buildFallbackShopAiPlan("NON OPF exhaust for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.opfGpf, "without");
  assert.equal(plan.requiredDetails?.includes("opfGpf"), false);
});

test("planner requests engine evidence for chip tuning", () => {
  const plan = buildFallbackShopAiPlan("RaceChip for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.category, "chipTuning");
  assert.ok(plan.requiredDetails?.includes("engine"));
});

test("fallback planner extracts a structured engine code", () => {
  const plan = buildFallbackShopAiPlan("RaceChip S68 for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.vehicle.engine, "S68");
  assert.equal(plan.requiredDetails?.includes("engine"), false);
});

test("generic exhaust intent targets a complete system", () => {
  const plan = buildFallbackShopAiPlan("Exhaust for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.productKind, "system");
});

test("downpipe intent remains distinct from a complete exhaust", () => {
  const plan = buildFallbackShopAiPlan("Downpipe for BMW M3 G80", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.productKind, "downpipe");
});
