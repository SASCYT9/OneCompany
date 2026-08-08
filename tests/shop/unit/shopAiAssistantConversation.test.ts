import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShopAiNoMoreOptionsMessage,
  excludePreviouslyShownShopAiProducts,
  inheritShopAiConversationContext,
  isShopAiContinuation,
} from "../../../src/lib/shopAiAssistantConversation";
import type { ShopAiPlan, ShopAiProduct } from "../../../src/lib/shopAiAssistantTypes";

const previousPlan: ShopAiPlan = {
  intent: "recommend",
  goal: "power",
  vehicle: { type: "car", make: "BMW", model: "M5", chassis: "G90", year: null, engine: null },
  category: "chipTuning",
  searchQuery: "BMW M5 G90 chipTuning",
  minPrice: null,
  maxPrice: null,
  powerGainHp: 100,
  needsClarification: false,
  clarification: null,
};

const product = (id: string): ShopAiProduct => ({
  id,
  name: id,
  brand: "Test",
  partNumber: id,
  description: "+100 к.с.",
  thumbnail: null,
  inStock: true,
  price: 100,
  slug: id,
  variantId: null,
  turn14Id: "",
});

test("continuation inherits the previous vehicle, category and power goal", () => {
  const context = inheritShopAiConversationContext(
    { locale: "ua", currency: "USD" },
    previousPlan,
    "Не годиться. А ще які варіанти?"
  );

  assert.equal(isShopAiContinuation("А ще які варіанти?"), true);
  assert.equal(context.make, "BMW");
  assert.equal(context.model, "M5");
  assert.equal(context.chassis, "G90");
  assert.equal(context.category, "chipTuning");
  assert.equal(context.powerGainHp, 100);
});

test("continuation removes products already shown in the conversation", () => {
  assert.deepEqual(
    excludePreviouslyShownShopAiProducts(
      [product("shown"), product("fresh")],
      ["shown"],
      "Покажи ще варіанти"
    ).map((item) => item.id),
    ["fresh"]
  );
});

test("a new explicit request does not inherit or exclude prior results", () => {
  const base = { locale: "ua" as const, currency: "EUR" as const };
  assert.deepEqual(
    inheritShopAiConversationContext(base, previousPlan, "Потрібен вихлоп для Audi RS6"),
    base
  );
  assert.equal(
    excludePreviouslyShownShopAiProducts([product("shown")], ["shown"], "Вихлоп для Audi").length,
    1
  );
});

test("continuation explains that no additional confirmed options remain", () => {
  assert.equal(
    buildShopAiNoMoreOptionsMessage("ua", previousPlan, "А ще які варіанти?", ["shown"], []),
    "Інших підтверджених варіантів для BMW M5 G90 +100 к.с. у каталозі немає."
  );
});

test("a technical OPF clarification inherits vehicle but re-evaluates shown products", () => {
  const context = inheritShopAiConversationContext(
    { locale: "en", currency: "EUR" },
    { ...previousPlan, category: "exhaust", powerGainHp: null },
    "My vehicle has OPF"
  );
  assert.equal(context.chassis, "G90");
  assert.equal(
    excludePreviouslyShownShopAiProducts([product("shown")], ["shown"], "My vehicle has OPF")
      .length,
    1
  );
});

test("an answer to a clarification inherits the full previous plan", () => {
  const clarificationPlan: ShopAiPlan = {
    ...previousPlan,
    category: "exhaust",
    needsClarification: true,
    requiredDetails: ["opfGpf"],
    vehicle: {
      type: "car",
      make: "BMW",
      model: "X6",
      chassis: "G06",
      year: 2020,
      engine: "B57",
      fuel: "diesel",
      bodyStyle: "suv",
    },
  };
  const context = inheritShopAiConversationContext(
    { locale: "ua", currency: "EUR" },
    clarificationPlan,
    "BMW X6 G06 2020"
  );

  assert.equal(context.category, "exhaust");
  assert.equal(context.make, "BMW");
  assert.equal(context.model, "X6");
  assert.equal(context.chassis, "G06");
  assert.equal(context.year, 2020);
  assert.equal(context.engine, "B57");
  assert.equal(context.fuel, "diesel");
  assert.equal(context.bodyStyle, "suv");
});
