import "server-only";

export const SHOP_CATALOG_V2_READER_MODE_ENV = "SHOP_CATALOG_V2_READER_MODE" as const;

export type ShopCatalogReaderFlag = {
  enabled: boolean;
  mode: "off" | "canary" | "ssr";
  reason: "explicit_ssr" | "explicit_canary" | "default_off" | "invalid_value";
};

/**
 * Catalog V2 serving is a separate, fail-closed decision from shadow comparison.
 * Environment values are injected by the caller so importing this module has no
 * side effects and an invalid deployment value can never switch customer traffic.
 */
export function resolveShopCatalogReaderFlag(
  mode: string | null | undefined
): ShopCatalogReaderFlag {
  const normalized = mode?.trim().toLowerCase() ?? "";
  if (normalized === "ssr") {
    return Object.freeze({ enabled: true, mode: "ssr", reason: "explicit_ssr" });
  }
  if (normalized === "canary") {
    return Object.freeze({ enabled: false, mode: "canary", reason: "explicit_canary" });
  }
  if (!normalized || normalized === "off") {
    return Object.freeze({ enabled: false, mode: "off", reason: "default_off" });
  }
  return Object.freeze({ enabled: false, mode: "off", reason: "invalid_value" });
}

export function isShopCatalogReaderRequestEnabled(
  flag: ShopCatalogReaderFlag,
  canaryHeader: string | null | undefined
) {
  return flag.mode === "ssr" || (flag.mode === "canary" && canaryHeader === "1");
}
