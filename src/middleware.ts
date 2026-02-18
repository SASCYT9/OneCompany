import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import {
  hasLocalePrefix,
  isLocaleAgnosticPublicPath,
  isNoindexPath,
  normalizePathname,
  resolveRemovedBlogRedirectPath,
} from '@/lib/seoIndexPolicy';

const intlMiddleware = createMiddleware(routing);

// Countries that should see Ukrainian version
const ukrainianCountries = ['UA']; // Ukraine
const blockedCountries = ['RU']; // Russia (Blocked)

// Detect preferred locale based on geo and browser settings
function detectLocale(req: NextRequest, isMigrated: boolean = false): 'ua' | 'en' {
  // 1. Check if user already has a locale preference cookie
  // ONLY if they have been migrated (verified against new logic)
  if (isMigrated) {
    const localeCookie = req.cookies.get('NEXT_LOCALE')?.value;
    if (localeCookie && (localeCookie === 'ua' || localeCookie === 'en')) {
      return localeCookie;
    }
  }

  // 2. Check Vercel's geolocation header (works on Vercel deployment)
  const country = req.headers.get('x-vercel-ip-country');

  // STRICT LOGIC: If we have country info
  if (country) {
    if (ukrainianCountries.includes(country)) {
      return 'ua';
    } else {
      // ANY other country -> English (unless blocked, but blocking is handled in middleware default function)
      return 'en';
    }
  }

  // 3. Fallback: Check browser's Accept-Language header (only if no country info, e.g. localhost)
  const acceptLanguage = req.headers.get('accept-language');
  if (acceptLanguage) {
    // Check for Ukrainian language preference
    if (acceptLanguage.toLowerCase().includes('uk') ||
      acceptLanguage.toLowerCase().includes('ua')) {
      return 'ua';
    }
    // Check for Russian - show Ukrainian version (they can understand)
    if (acceptLanguage.toLowerCase().includes('ru')) {
      return 'ua';
    }
  }

  // 4. Default to English for international users (or localhost default)
  return 'en';
}

export default function middleware(req: NextRequest) {
  // 1. Block access from specific countries (Russia)
  const country = req.headers.get('x-vercel-ip-country');
  if (country && blockedCountries.includes(country)) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  const { pathname } = req.nextUrl;
  const normalizedPathname = normalizePathname(pathname);
  const currentPath = normalizedPathname;

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

  // Skip middleware for non-localized routes (admin, APIs, Telegram WebApp)
  if (isNoindexPath(currentPath)) {
    return NextResponse.next();
  }

  // Check if user is visiting root without locale
  const pathnameHasLocale = hasLocalePrefix(currentPath);

  // Migration: Check if we have validated this user's locale with the new strict logic
  const isMigrated = req.cookies.get('LOCALE_MIGRATED')?.value === '1';

  if (!pathnameHasLocale && currentPath === '/') {
    // Detect and redirect to appropriate locale
    const detectedLocale = detectLocale(req, isMigrated);
    const url = req.nextUrl.clone();
    url.pathname = `/${detectedLocale}`;

    const response = NextResponse.redirect(url);
    // Save preference for future visits (30 days)
    response.cookies.set('NEXT_LOCALE', detectedLocale, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    // Mark as migrated so we respect the cookie next time
    response.cookies.set('LOCALE_MIGRATED', '1', {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
    return response;
  }

  if (!pathnameHasLocale) {
    const shouldLocalizePath = isLocaleAgnosticPublicPath(currentPath);

    if (shouldLocalizePath) {
      const detectedLocale = detectLocale(req, isMigrated);
      const url = req.nextUrl.clone();
      url.pathname = `/${detectedLocale}${currentPath}`;
      return NextResponse.redirect(url, 308);
    }
  }

  const response = intlMiddleware(req);

  // Fix hreflang in Link headers - replace 'ua' with 'uk'
  const linkHeader = response.headers.get('Link');
  if (linkHeader) {
    const fixedLinkHeader = linkHeader.replace(/hreflang="ua"/g, 'hreflang="uk"');
    response.headers.set('Link', fixedLinkHeader);
  }

  return response;
}

export const config = {
  // Match all pathnames except for static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']
};
