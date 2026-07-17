export type ShopAiV2PipelineDecision = {
  evalRejected: boolean;
  forcedForEval: boolean;
  serveV2: boolean;
  source: "category-rollout" | "exact-sku-baseline" | "legacy";
};

export function decideShopAiV2Pipeline(input: {
  evalRequiresV2: boolean;
  categorySupported: boolean;
  categoryRolloutEnabled: boolean;
  exactSkuMatched: boolean;
}): ShopAiV2PipelineDecision {
  const forcedForEval = input.evalRequiresV2 && (input.categorySupported || input.exactSkuMatched);
  const evalRejected = input.evalRequiresV2 && !forcedForEval;
  if (evalRejected) {
    return {
      evalRejected,
      forcedForEval: false,
      serveV2: false,
      source: "legacy",
    };
  }
  if (input.exactSkuMatched) {
    return {
      evalRejected: false,
      forcedForEval,
      serveV2: true,
      source: "exact-sku-baseline",
    };
  }
  if (forcedForEval || input.categoryRolloutEnabled) {
    return {
      evalRejected: false,
      forcedForEval,
      serveV2: true,
      source: "category-rollout",
    };
  }
  return {
    evalRejected: false,
    forcedForEval: false,
    serveV2: false,
    source: "legacy",
  };
}

export function decideShopAiRetrievalPath(input: { serveV2: boolean; strictAvailable: boolean }) {
  if (!input.serveV2) return "legacy" as const;
  return input.strictAvailable ? ("strict" as const) : ("strict-unavailable" as const);
}

export function decideShopAiVehicleResolutionPath(input: {
  serveV2: boolean;
  hasVehicleInput: boolean;
  canonicalAvailable: boolean;
}) {
  if (!input.hasVehicleInput) return "not-needed" as const;
  if (!input.serveV2) return "legacy" as const;
  return input.canonicalAvailable ? ("canonical" as const) : ("v2-unavailable" as const);
}
