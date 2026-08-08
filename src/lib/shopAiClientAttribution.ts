export const SHOP_AI_ATTRIBUTION_SESSION_KEY = "onecompany:one-ai-attribution:v1";
const SHOP_AI_ATTRIBUTION_TTL_MS = 2 * 60 * 60 * 1000;

export type ShopAiClientAttribution = {
  savedAt: number;
  runId: string;
  conversationId: string | null;
  productId: string;
  variantId: string | null;
  slug: string;
  locale: "ua" | "en";
};

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/u.test(value);
}

export function storeShopAiClientAttribution(value: ShopAiClientAttribution) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SHOP_AI_ATTRIBUTION_SESSION_KEY, JSON.stringify(value));
  } catch {
    // Storage can be disabled by privacy settings; product navigation must still work.
  }
}

export function readShopAiClientAttribution() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SHOP_AI_ATTRIBUTION_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ShopAiClientAttribution>;
    if (
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > SHOP_AI_ATTRIBUTION_TTL_MS ||
      !isSafeId(value.runId) ||
      !isSafeId(value.productId) ||
      (value.conversationId != null && !isSafeId(value.conversationId)) ||
      (value.variantId != null && !isSafeId(value.variantId)) ||
      typeof value.slug !== "string" ||
      (value.locale !== "ua" && value.locale !== "en")
    ) {
      window.sessionStorage.removeItem(SHOP_AI_ATTRIBUTION_SESSION_KEY);
      return null;
    }
    return value as ShopAiClientAttribution;
  } catch {
    try {
      window.sessionStorage.removeItem(SHOP_AI_ATTRIBUTION_SESSION_KEY);
    } catch {
      // Ignore unavailable storage.
    }
    return null;
  }
}

export async function postShopAiClientAttributionEvent(
  event: "product_click" | "manager_handoff" | "add_to_cart",
  attribution: ShopAiClientAttribution
) {
  try {
    await fetch("/api/shop/stock/assistant/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...attribution }),
      keepalive: true,
    });
  } catch {
    // Attribution must never block navigation or commerce actions.
  }
}
