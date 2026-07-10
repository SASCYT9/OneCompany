import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShopAiPowerGoalAnswer,
  filterShopAiProductsForPowerGoal,
} from "../../../src/lib/shopAiAssistantPower";
import type { ShopAiPlan, ShopAiProduct } from "../../../src/lib/shopAiAssistantTypes";

const plan: ShopAiPlan = {
  intent: "recommend",
  vehicle: { type: "car", make: "BMW", model: "M5", chassis: "G90", year: null, engine: null },
  category: "chipTuning",
  searchQuery: "BMW M5 G90 chip tuning",
  minPrice: null,
  maxPrice: null,
  powerGainHp: 200,
  needsClarification: false,
  clarification: null,
};

const product: ShopAiProduct = {
  id: "g90-racechip",
  name: "RaceChip GTS 5 — BMW M5 G90/G99",
  brand: "RaceChip",
  partNumber: "RC-G90",
  description: "+136 к.с. / +157 Нм",
  thumbnail: null,
  inStock: true,
  price: 1000,
  slug: "racechip-g90",
  variantId: null,
  turn14Id: "",
};

test("power goal answer does not present a smaller gain as the requested target", () => {
  const answer = buildShopAiPowerGoalAnswer({ locale: "ua", plan, products: [product] });

  assert.match(answer ?? "", /\+136 к\.с\./);
  assert.match(answer ?? "", /не дотягує/);
  assert.match(answer ?? "", /\+200 к\.с\./);
});

test("power goal answer reports no exact product when gain evidence is absent", () => {
  const answer = buildShopAiPowerGoalAnswer({
    locale: "ua",
    plan,
    products: [{ ...product, description: "Модуль керування двигуном" }],
  });

  assert.match(answer ?? "", /немає товару з підтвердженим приростом/);
});

test("power goal removes cards without a declared gain", () => {
  const withoutGain = { ...product, id: "without-gain", description: "Stage 1 tuner" };

  assert.deepEqual(
    filterShopAiProductsForPowerGoal([withoutGain, product], plan).map((item) => item.id),
    ["g90-racechip"]
  );
});
