import assert from "node:assert/strict";
import test from "node:test";

import { buildFallbackShopAiPlan } from "../../../src/lib/shopAiAssistantPlanner";
import { shouldUseShopAiSemanticReranking } from "../../../src/lib/shopAiSemanticIntent";

const context = {
  locale: "ua" as const,
  currency: "EUR" as const,
  scope: "auto" as const,
};

test("structured vehicle queries do not spend an embedding call", () => {
  const message = "вихлоп на BMW M3 F80 2018 без OPF";
  const plan = buildFallbackShopAiPlan(message, context);

  assert.equal(shouldUseShopAiSemanticReranking(message, plan), false);
});

test("qualitative preferences enable one semantic rerank", () => {
  const message = "потрібен вихлоп BMW M3 F80 з глибоким звуком";
  const plan = buildFallbackShopAiPlan(message, context);

  assert.equal(shouldUseShopAiSemanticReranking(message, plan), true);
});
