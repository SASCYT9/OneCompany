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
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";
import { shouldAllowAdminApiRequest, shouldAllowAdminPageRequest } from "@/lib/adminProxyAuth";

const intlMiddleware = createMiddleware(routing);

const blockedCountries = ["RU"]; // Russia (Blocked)

export default async function proxy(req: NextRequest) {
  // 1. Block access from specific countries (Russia)
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

    return NextResponse.next();
  }

  // Skip middleware for non-localized routes (admin, APIs, Telegram WebApp)
  if (isNoindexPath(currentPath)) {
    return NextResponse.next();
  }

  // Check if user is visiting root without locale
  const pathnameHasLocale = hasLocalePrefix(currentPath);

  if (!pathnameHasLocale && currentPath === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/ua";
    return NextResponse.redirect(url, 308);
  }

  if (!pathnameHasLocale) {
    const shouldLocalizePath = isLocaleAgnosticPublicPath(currentPath);

    if (shouldLocalizePath) {
      const url = req.nextUrl.clone();
      url.pathname = `/ua${currentPath}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // For already-localized paths (/ua/*, /en/*), skip the intl middleware
  // entirely. Returning NextResponse.next() lets Vercel serve the route
  // from its ISR/static cache; running intlMiddleware would mutate the
  // response and force Cache-Control: private, no-store on every request.
  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  const response = intlMiddleware(req);

  // Fix hreflang in Link headers - replace 'ua' with 'uk'
  const linkHeader = response.headers.get("Link");
  if (linkHeader) {
    const fixedLinkHeader = linkHeader.replace(/hreflang="ua"/g, 'hreflang="uk"');
    response.headers.set("Link", fixedLinkHeader);
  }

  return response;
}

export const config = {
  // Match all pathnames except for static files AND already-localized paths.
  // Excluding /ua/* and /en/* from the matcher is what makes those routes
  // statically cacheable on Vercel — even an early `NextResponse.next()` in
  // the middleware body is enough to mark the route dynamic and stamp
  // Cache-Control: private, no-store. The middleware now only runs for the
  // root redirect, locale-agnostic public paths, and admin/API auth.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ua/|en/|.*\\..*).*)"],
};
