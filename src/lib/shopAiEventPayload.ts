const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/u;

export type ShopAiAttributionEventType = "product_click" | "manager_handoff" | "add_to_cart";

export type ShopAiAttributionEventPayload = {
  event: ShopAiAttributionEventType;
  runId: string;
  conversationId: string | null;
  productId: string;
  variantId: string | null;
  locale: "ua" | "en";
};

export type ParseShopAiAttributionEventResult =
  | { ok: true; value: ShopAiAttributionEventPayload }
  | { ok: false; error: string };

function cleanId(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return SAFE_ID_PATTERN.test(cleaned) ? cleaned : null;
}

export function parseShopAiAttributionEvent(value: unknown): ParseShopAiAttributionEventResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }
  const source = value as Record<string, unknown>;
  const allowed = new Set<ShopAiAttributionEventType>([
    "product_click",
    "manager_handoff",
    "add_to_cart",
  ]);
  if (
    typeof source.event !== "string" ||
    !allowed.has(source.event as ShopAiAttributionEventType)
  ) {
    return { ok: false, error: "Invalid event" };
  }
  const runId = cleanId(source.runId);
  const productId = cleanId(source.productId);
  const conversationId = source.conversationId == null ? null : cleanId(source.conversationId);
  const variantId = source.variantId == null ? null : cleanId(source.variantId);
  if (!runId) return { ok: false, error: "Invalid runId" };
  if (!productId) return { ok: false, error: "Invalid productId" };
  if (source.conversationId != null && !conversationId) {
    return { ok: false, error: "Invalid conversationId" };
  }
  if (source.variantId != null && !variantId) {
    return { ok: false, error: "Invalid variantId" };
  }
  if (source.locale !== "ua" && source.locale !== "en") {
    return { ok: false, error: "locale must be ua or en" };
  }
  return {
    ok: true,
    value: {
      event: source.event as ShopAiAttributionEventType,
      runId,
      conversationId,
      productId,
      variantId,
      locale: source.locale,
    },
  };
}
