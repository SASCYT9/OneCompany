import test from "node:test";
import assert from "node:assert/strict";
import { mergeShopCartItemInputs } from "../../../src/lib/shopCart";

test("mergeShopCartItemInputs aggregates guest and customer cart rows by slug and variant", () => {
  const merged = mergeShopCartItemInputs(
    [
      { slug: "urban-defender-kit", quantity: 1, variantId: "v1" },
      { slug: "urban-wheel-set", quantity: 2 },
    ],
    [
      { slug: "urban-defender-kit", quantity: 3, variantId: "v1" },
      { slug: "urban-defender-kit", quantity: 1, variantId: "v2" },
      { slug: "urban-wheel-set", quantity: 1 },
    ]
  );

  assert.deepEqual(merged, [
    { slug: "urban-defender-kit", quantity: 4, variantId: "v1" },
    { slug: "urban-wheel-set", quantity: 3, variantId: null },
    { slug: "urban-defender-kit", quantity: 1, variantId: "v2" },
  ]);
});

test("mergeShopCartItemInputs preserves OneAI attribution across cart rewrites", () => {
  const merged = mergeShopCartItemInputs(
    [
      {
        slug: "one-ai-product",
        quantity: 1,
        variantId: "v1",
        oneAiRunId: "run-1",
        oneAiCandidateDecisionId: "candidate-1",
      },
    ],
    [{ slug: "one-ai-product", quantity: 2, variantId: "v1" }]
  );

  assert.deepEqual(merged, [
    {
      slug: "one-ai-product",
      quantity: 3,
      variantId: "v1",
      oneAiRunId: "run-1",
      oneAiCandidateDecisionId: "candidate-1",
    },
  ]);
});
