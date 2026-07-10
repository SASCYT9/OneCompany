import type { ShopAiContext, ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";

const CONTINUATION_SIGNAL =
  /(?:^|\s)(ще|інші|інший|альтернатив|не годиться|не підходить|more|other|another|alternative|else)(?:\s|$|[?!.])/i;

const TECHNICAL_FOLLOW_UP_SIGNAL = /\b(?:opf|gpf|engine|motor|двигун|мотор)\b/iu;

export function isShopAiContinuation(message: string) {
  return CONTINUATION_SIGNAL.test(message) || TECHNICAL_FOLLOW_UP_SIGNAL.test(message);
}

export function isShopAiAlternativeContinuation(message: string) {
  return CONTINUATION_SIGNAL.test(message);
}

export function inheritShopAiConversationContext(
  context: ShopAiContext,
  previousPlan: ShopAiPlan | null,
  message: string
): ShopAiContext {
  if (!previousPlan || !isShopAiContinuation(message)) return context;
  return {
    ...context,
    query: previousPlan.searchQuery || context.query,
    category: previousPlan.category || context.category,
    make: previousPlan.vehicle.make || context.make,
    model: previousPlan.vehicle.model || context.model,
    chassis: previousPlan.vehicle.chassis || context.chassis,
    powerGainHp: previousPlan.powerGainHp ?? context.powerGainHp ?? null,
    opfGpf: previousPlan.opfGpf ?? context.opfGpf ?? null,
  };
}

export function excludePreviouslyShownShopAiProducts(
  products: ShopAiProduct[],
  excludedIds: string[],
  message: string
) {
  if (!isShopAiAlternativeContinuation(message) || excludedIds.length === 0) return products;
  const excluded = new Set(excludedIds);
  return products.filter((product) => !excluded.has(product.id));
}

export function buildShopAiNoMoreOptionsMessage(
  locale: "ua" | "en",
  plan: ShopAiPlan,
  message: string,
  excludedProductIds: string[],
  remainingProducts: ShopAiProduct[]
) {
  if (
    !isShopAiAlternativeContinuation(message) ||
    excludedProductIds.length === 0 ||
    remainingProducts.length > 0
  ) {
    return null;
  }

  const vehicle = [plan.vehicle.make, plan.vehicle.model, plan.vehicle.chassis]
    .filter(Boolean)
    .join(" ");
  const powerGoal = plan.powerGainHp
    ? ` +${plan.powerGainHp} ${locale === "ua" ? "к.с." : "hp"}`
    : "";
  return locale === "ua"
    ? `Інших підтверджених варіантів для ${vehicle || "цього авто"}${powerGoal} у каталозі немає.`
    : `There are no other confirmed options for ${vehicle || "this vehicle"}${powerGoal}.`;
}
