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

const intlMiddleware = createMiddleware(routing);
const blockedCountries = ["RU"];

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ua/|en/|.*\\..*).*)"],
};
