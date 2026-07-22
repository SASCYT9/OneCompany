import assert from "node:assert/strict";
import test from "node:test";

import {
  decideShopAiRetrievalPath,
  decideShopAiVehicleResolutionPath,
  decideShopAiV2Pipeline,
} from "../../../src/lib/shopAiV2PipelineDecision";

test("unknown category stays legacy unless a canonical exact SKU matched", () => {
  assert.deepEqual(
    decideShopAiV2Pipeline({
      evalRequiresV2: false,
      categorySupported: false,
      categoryRolloutEnabled: false,
      exactSkuMatched: false,
    }),
    {
      evalRejected: false,
      forcedForEval: false,
      serveV2: false,
      source: "legacy",
    }
  );

  assert.equal(
    decideShopAiV2Pipeline({
      evalRequiresV2: false,
      categorySupported: false,
      categoryRolloutEnabled: false,
      exactSkuMatched: true,
    }).source,
    "exact-sku-baseline"
  );
});

test("protected eval rejects a request that cannot prove a V2 path", () => {
  const rejected = decideShopAiV2Pipeline({
    evalRequiresV2: true,
    categorySupported: false,
    categoryRolloutEnabled: false,
    exactSkuMatched: false,
  });
  assert.equal(rejected.evalRejected, true);
  assert.equal(rejected.serveV2, false);
});

test("protected eval forces supported category V2 without changing public rollout", () => {
  const decision = decideShopAiV2Pipeline({
    evalRequiresV2: true,
    categorySupported: true,
    categoryRolloutEnabled: false,
    exactSkuMatched: false,
  });
  assert.equal(decision.forcedForEval, true);
  assert.equal(decision.serveV2, true);
  assert.equal(decision.source, "category-rollout");
});

test("selected V2 never falls back to legacy when strict knowledge is unavailable", () => {
  assert.equal(decideShopAiRetrievalPath({ serveV2: true, strictAvailable: true }), "strict");
  assert.equal(
    decideShopAiRetrievalPath({ serveV2: true, strictAvailable: false }),
    "strict-unavailable"
  );
  assert.equal(decideShopAiRetrievalPath({ serveV2: false, strictAvailable: false }), "legacy");
});

test("selected V2 never uses legacy vehicle resolution", () => {
  assert.equal(
    decideShopAiVehicleResolutionPath({
      serveV2: true,
      hasVehicleInput: true,
      canonicalAvailable: false,
    }),
    "v2-unavailable"
  );
  assert.equal(
    decideShopAiVehicleResolutionPath({
      serveV2: false,
      hasVehicleInput: true,
      canonicalAvailable: false,
    }),
    "legacy"
  );
});
