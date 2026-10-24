export type ShopNavigationDestinationKey = "catalog" | "selection";

export type ShopNavigationDestination = {
  key: ShopNavigationDestinationKey;
  href: string;
};

const SHOP_UTILITY_SEGMENTS = new Set(["account", "cart", "checkout"]);

function isPathOrDescendant(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function getShopNavigationDestinations(locale: string): ShopNavigationDestination[] {
  const localeRoot = `/${locale}`;

  // One shop: the catalog (brand pages are catalog landings inside it).
  return [
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

  if (isPathOrDescendant(pathname, shopRoot)) {
    const segment = pathname.slice(shopRoot.length + 1).split("/")[0];
    if (SHOP_UTILITY_SEGMENTS.has(segment)) return null;
    return "catalog";
  }

  return null;
}
