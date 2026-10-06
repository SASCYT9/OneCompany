/**
 * Vehicle selector options (makes/models/chassis/details) only change when
 * catalog fitment is published, so they are cached across requests under this
 * tag. Storefront product revalidation and the admin cache reset invalidate it;
 * CLI publication scripts rely on the bounded TTL below.
 */
export const SHOP_CATALOG_SELECTOR_CACHE_TAG = "shop-catalog-selectors";
export const SHOP_CATALOG_SELECTOR_CACHE_SECONDS = 600;
