import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import {
  hasLocalePrefix,
  isLocaleAgnosticPublicPath,
  isNoindexPath,
  normalizePathname,
  resolveRemovedBlogRedirectPath,
} from "@/lib/seoIndexPolicy";
import { ADMIN_PATH_HEADER } from "@/lib/admin/adminPathHeader";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { shouldAllowAdminApiRequest, shouldAllowAdminPageRequest } from "@/lib/adminProxyAuth";
import {
  evaluateShopCatalogCanary,
  parseShopCatalogCanaryConfig,
  SHOP_CATALOG_CANARY_COOKIE,
  SHOP_CATALOG_CANARY_REQUEST_HEADER,
  SHOP_CATALOG_CANARY_SELECTED_COOKIE,
} from "@/lib/shopCatalogCanary";

const intlMiddleware = createMiddleware(routing);
const blockedCountries = ["RU"];

function withCatalogCanaryCookie(response: NextResponse, rolloutId: string, selected: boolean) {
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  };
  response.cookies.set(SHOP_CATALOG_CANARY_COOKIE, rolloutId, options);
  response.cookies.set(SHOP_CATALOG_CANARY_SELECTED_COOKIE, selected ? "1" : "0", options);
  response.headers.set("Vary", "Cookie");
  return response;
}

function routeCatalogCanary(req: NextRequest, pathname: string) {
  if (process.env.SHOP_CATALOG_V2_READER_MODE?.trim().toLowerCase() !== "canary") return null;
  const catalogMatch = pathname.match(/^\/(ua|en)\/shop\/catalog$/);
  const isSuggestion = pathname === "/api/shop/catalog/suggest";
  if (!catalogMatch && !isSuggestion) return null;

  const rolloutId = req.cookies.get(SHOP_CATALOG_CANARY_COOKIE)?.value || crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  const selected = catalogMatch
    ? evaluateShopCatalogCanary({
        config: parseShopCatalogCanaryConfig(process.env),
        rolloutId,
        locale: catalogMatch[1] ?? null,
        brand: req.nextUrl.searchParams.get("brand"),
        category: req.nextUrl.searchParams.get("category"),
      })
    : req.cookies.get(SHOP_CATALOG_CANARY_SELECTED_COOKIE)?.value === "1";

  if (selected) requestHeaders.set(SHOP_CATALOG_CANARY_REQUEST_HEADER, "1");
  if (catalogMatch && !selected) {
    const legacyUrl = req.nextUrl.clone();
    legacyUrl.pathname = `/${catalogMatch[1]}/shop/stock`;
    return withCatalogCanaryCookie(NextResponse.rewrite(legacyUrl), rolloutId, false);
  }
  return withCatalogCanaryCookie(
    NextResponse.next({ request: { headers: requestHeaders } }),
    rolloutId,
    selected
  );
}

function nextWithAdminPath(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ADMIN_PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default async function proxy(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country");
  if (country && blockedCountries.includes(country)) {
    return new NextResponse("Access Denied", { status: 403 });
  }

  const { pathname } = req.nextUrl;
  const normalizedPathname = normalizePathname(pathname);
  const currentPath = normalizedPathname;
  const adminCookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;

  const removedBlogRedirectPath = resolveRemovedBlogRedirectPath(currentPath);
  if (removedBlogRedirectPath) {
    const url = req.nextUrl.clone();
    url.pathname = removedBlogRedirectPath;
    return NextResponse.redirect(url, 308);
  }

  if (normalizedPathname !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = normalizedPathname;
    return NextResponse.redirect(url, 308);
  }

  const catalogCanaryResponse = routeCatalogCanary(req, currentPath);
  if (catalogCanaryResponse) return catalogCanaryResponse;

  if (currentPath.startsWith("/api/admin")) {
    const result = await shouldAllowAdminApiRequest({
      pathname: currentPath,
      method: req.method,
      cookieToken: adminCookie,
    });
    if (!result.allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (currentPath === "/admin" || currentPath.startsWith("/admin/")) {
    const result = await shouldAllowAdminPageRequest({
      pathname: currentPath,
      method: req.method,
      cookieToken: adminCookie,
    });
    if (!result.allowed) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      if (currentPath !== "/admin") {
        url.searchParams.set("next", currentPath);
      }
      return NextResponse.redirect(url);
    }
    return nextWithAdminPath(req, currentPath);
  }

  if (isNoindexPath(currentPath)) {
    return NextResponse.next();
  }

  const pathnameHasLocale = hasLocalePrefix(currentPath);
  if (!pathnameHasLocale && currentPath === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/ua";
    return NextResponse.redirect(url, 308);
  }

  if (!pathnameHasLocale && isLocaleAgnosticPublicPath(currentPath)) {
    const url = req.nextUrl.clone();
    url.pathname = `/ua${currentPath}`;
    return NextResponse.redirect(url, 308);
  }

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  const response = intlMiddleware(req);
  const linkHeader = response.headers.get("Link");
  if (linkHeader) {
    response.headers.set("Link", linkHeader.replace(/hreflang="ua"/g, 'hreflang="uk"'));
  }
  return response;
}

export const config = {
  matcher: [
    "/:locale(ua|en)/shop/catalog",
    "/api/shop/catalog/suggest",
    "/((?!_next/static|_next/image|favicon.ico|ua/|en/|.*\\..*).*)",
  ],
};
