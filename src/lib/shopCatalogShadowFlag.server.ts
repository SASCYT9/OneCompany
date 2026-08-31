import "server-only";

export const SHOP_CATALOG_V2_SHADOW_MODE_ENV = "SHOP_CATALOG_V2_SHADOW_MODE" as const;

export type ShopCatalogShadowFlagInput = {
  nodeEnv?: string | null;
  mode?: string | null;
};

export type ShopCatalogShadowFlag = {
  enabled: boolean;
  mode: "off" | "compare";
  production: boolean;
  reason: "explicit_compare" | "default_off" | "invalid_value";
};

/**
 * Fail-closed, compare-only flag. There is deliberately no traffic-serving
 * mode in this contract. Callers must pass environment values explicitly so
 * importing the module never reads process state or changes behavior.
 */
export function resolveShopCatalogShadowFlag(
  input: ShopCatalogShadowFlagInput
): ShopCatalogShadowFlag {
  const production = input.nodeEnv === "production";
  const mode = input.mode?.trim().toLowerCase() ?? "";
  if (mode === "compare") {
    return Object.freeze({
      enabled: true,
      mode: "compare",
      production,
      reason: "explicit_compare",
    });
  }
  if (!mode || mode === "off") {
    return Object.freeze({
      enabled: false,
      mode: "off",
      production,
      reason: "default_off",
    });
  }
  return Object.freeze({
    enabled: false,
    mode: "off",
    production,
    reason: "invalid_value",
  });
}
