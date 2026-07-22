import { STOREFRONT_ROUTE_REGISTRY } from "@/lib/storefrontRouteRegistry";

export type ShopNavigationDestinationKey = "brands" | "catalog" | "selection";

export type ShopNavigationDestination = {
  key: ShopNavigationDestinationKey;
  href: string;
};

const STOREFRONT_SEGMENTS = new Set(STOREFRONT_ROUTE_REGISTRY.map((route) => route.segment));
const SHOP_UTILITY_SEGMENTS = new Set(["account", "cart", "checkout"]);

function isPathOrDescendant(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function getShopNavigationDestinations(locale: string): ShopNavigationDestination[] {
  const localeRoot = `/${locale}`;

  return [
    { key: "brands", href: `${localeRoot}/shop` },
    { key: "catalog", href: `${localeRoot}/shop/catalog` },
    { key: "selection", href: `${localeRoot}/contact#selection-form` },
  ];
}

export function getShopNavigationActiveKey(
  pathname: string | null,
  locale: string
): ShopNavigationDestinationKey | null {
  if (!pathname) return null;

  const localeRoot = `/${locale}`;
  const shopRoot = `${localeRoot}/shop`;

  if (isPathOrDescendant(pathname, `${localeRoot}/contact`)) return "selection";
  if (
    isPathOrDescendant(pathname, `${shopRoot}/catalog`) ||
    isPathOrDescendant(pathname, `${shopRoot}/stock`)
  ) {
    return "catalog";
  }

  if (pathname === shopRoot || pathname === `${shopRoot}/`) return "brands";

  if (isPathOrDescendant(pathname, shopRoot)) {
    const segment = pathname.slice(shopRoot.length + 1).split("/")[0];
    if (!segment || SHOP_UTILITY_SEGMENTS.has(segment)) return null;
    return STOREFRONT_SEGMENTS.has(segment as (typeof STOREFRONT_ROUTE_REGISTRY)[number]["segment"])
      ? "brands"
      : "catalog";
  }

  return null;
}
