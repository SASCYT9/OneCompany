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
  const inheritsClarificationAnswer = Boolean(previousPlan?.needsClarification);
  if (!previousPlan || (!isShopAiContinuation(message) && !inheritsClarificationAnswer)) {
    return context;
  }

  const previousVehicle = previousPlan.vehicle;
  const filters = context.filters
    ? {
        ...context.filters,
        category: context.filters.category ?? previousPlan.category ?? undefined,
        make: context.filters.make ?? previousVehicle.make ?? undefined,
        model: context.filters.model ?? previousVehicle.model ?? undefined,
        chassis: context.filters.chassis ?? previousVehicle.chassis ?? undefined,
        year: context.filters.year ?? previousVehicle.year ?? null,
        engine: context.filters.engine ?? previousVehicle.engine ?? undefined,
        opfGpf: context.filters.opfGpf ?? previousPlan.opfGpf ?? null,
        productKind: context.filters.productKind ?? previousPlan.productKind,
      }
    : undefined;

  return {
    ...context,
    query: previousPlan.searchQuery || context.query,
    category: previousPlan.category || context.category,
    make: context.make || previousVehicle.make || undefined,
    model: context.model || previousVehicle.model || undefined,
    chassis: context.chassis || previousVehicle.chassis || undefined,
    year: context.year ?? previousVehicle.year ?? null,
    engine: context.engine || previousVehicle.engine || undefined,
    fuel: context.fuel ?? previousVehicle.fuel ?? null,
    bodyStyle: context.bodyStyle ?? previousVehicle.bodyStyle ?? null,
    powerGainHp: previousPlan.powerGainHp ?? context.powerGainHp ?? null,
    opfGpf: previousPlan.opfGpf ?? context.opfGpf ?? null,
    productKind: context.productKind ?? previousPlan.productKind,
    filters,
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
  const fallbackVehicle =
    plan.vehicle.type === "motorcycle"
      ? locale === "ua"
        ? "цього мотоцикла"
        : "this motorcycle"
      : locale === "ua"
        ? "цього авто"
        : "this vehicle";
  const powerGoal = plan.powerGainHp
    ? ` +${plan.powerGainHp} ${locale === "ua" ? "к.с." : "hp"}`
    : "";
  return locale === "ua"
    ? `Інших підтверджених варіантів для ${vehicle || fallbackVehicle}${powerGoal} у каталозі немає.`
    : `There are no other confirmed options for ${vehicle || fallbackVehicle}${powerGoal}.`;
}
