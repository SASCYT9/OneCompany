export type MobileBottomNavigationKey = "home" | "shop" | "selection" | "cart";

export const SHOP_CATALOG_OPEN_FILTERS_EVENT = "onecompany:shop-catalog:open-filters";

function isPathOrDescendant(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function getMobileBottomNavigationActiveKey(
  pathname: string | null,
  locale: string
): MobileBottomNavigationKey | null {
  if (!pathname) return null;

  const localeRoot = `/${locale}`;
  const shopRoot = `${localeRoot}/shop`;

  if (pathname === localeRoot || pathname === `${localeRoot}/`) return "home";
  if (isPathOrDescendant(pathname, `${shopRoot}/cart`)) return "cart";
  if (isPathOrDescendant(pathname, `${localeRoot}/contact`)) return "selection";
  if (isPathOrDescendant(pathname, shopRoot)) return "shop";

  return null;
}

export function shouldHideMobileBottomNavigation(pathname: string | null, locale: string) {
  if (!pathname) return false;

  return (
    isPathOrDescendant(pathname, `/${locale}/admin`) ||
    isPathOrDescendant(pathname, `/${locale}/shop/checkout`) ||
    // The Eventuri landing page has its own persistent vehicle-finder CTA.
    // Keeping the global fixed bar here covers the finder and product-card controls
    // on compact viewports; the header still exposes menu and cart navigation.
    isPathOrDescendant(pathname, `/${locale}/shop/eventuri`)
  );
}

export function shouldUseCatalogFiltersNavigation(pathname: string | null, locale: string) {
  if (!pathname) return false;

  const shopRoot = `/${locale}/shop`;
  return pathname === `${shopRoot}/catalog` || pathname === `${shopRoot}/stock`;
}
