export type MobileBottomNavigationKey = "home" | "shop" | "selection" | "cart";

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
    isPathOrDescendant(pathname, `/${locale}/shop/checkout`)
  );
}
