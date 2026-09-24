export const SHOP_PRODUCT_ADMIN_MEDIA_NAMESPACE = "onecompany";
export const SHOP_PRODUCT_ADMIN_MEDIA_KEY = "admin_media_override";

export function hasShopProductAdminMediaOverride(
  metafields:
    ReadonlyArray<{ namespace: string; key: string; value?: string | null }> | null | undefined
) {
  return Boolean(
    metafields?.some(
      (metafield) =>
        metafield.namespace === SHOP_PRODUCT_ADMIN_MEDIA_NAMESPACE &&
        metafield.key === SHOP_PRODUCT_ADMIN_MEDIA_KEY &&
        metafield.value?.trim().toLowerCase() === "true"
    )
  );
}
