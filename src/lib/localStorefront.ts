/**
 * Local storefront mode deliberately has no database or external write
 * credentials. It is enabled only by the ignored .env.local created for this
 * checkout and can never activate on Vercel.
 */
export function isLocalStorefrontMode() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.VERCEL !== "1" &&
    process.env.SHOP_LOCAL_CATALOG_SNAPSHOT === "1" &&
    !String(process.env.DATABASE_URL ?? "").trim()
  );
}
