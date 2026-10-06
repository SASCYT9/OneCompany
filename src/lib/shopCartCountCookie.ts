/**
 * Non-sensitive item count mirrored from cart API responses, so the header
 * badge can render without a request (and without a database read) per page.
 */
export const SHOP_CART_COUNT_COOKIE = "oc_cart_count";
export const SHOP_CART_CHANGED_EVENT = "shop-cart-updated";

export function readShopCartCount(cookieHeader: string): number | null {
  const match = cookieHeader.match(/(?:^|;\s*)oc_cart_count=(\d{1,4})(?:;|$)/);
  return match ? Number(match[1]) : null;
}

export function notifyShopCartChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SHOP_CART_CHANGED_EVENT));
}
