import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import {routing} from './i18n/routing';
 
const intlMiddleware = createMiddleware(routing);

// Map internal locale codes to ISO language codes for hreflang
const localeToHreflang: Record<string, string> = {
  'ua': 'uk',
  'en': 'en'
};

// Countries that should see Ukrainian version
const ukrainianCountries = ['UA']; // Ukraine
const blockedCountries = ['RU']; // Russia (Blocked)

// Detect preferred locale based on geo and browser settings
function detectLocale(req: NextRequest): 'ua' | 'en' {
  // 1. Check if user already has a locale preference cookie
  const localeCookie = req.cookies.get('NEXT_LOCALE')?.value;
  if (localeCookie && (localeCookie === 'ua' || localeCookie === 'en')) {
    return localeCookie;
  }

  // 2. Check Vercel's geolocation header (works on Vercel deployment)
  const country = req.headers.get('x-vercel-ip-country');
  if (country && ukrainianCountries.includes(country)) {
    return 'ua';
  }

  // 3. Check browser's Accept-Language header
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

  // 4. Default to English for international users
  return 'en';
}

export default function middleware(req: NextRequest) {
  // 1. Block access from specific countries (Russia)
  const country = req.headers.get('x-vercel-ip-country');
  if (country && blockedCountries.includes(country)) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  const { pathname } = req.nextUrl;

  // Skip middleware for non-localized routes (admin, APIs, Telegram WebApp)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api') || pathname.startsWith('/telegram-app')) {
    return NextResponse.next();
  }

  // Check if user is visiting root without locale
  const pathnameHasLocale = /^\/(ua|en)(\/|$)/.test(pathname);
  
  if (!pathnameHasLocale && pathname === '/') {
    // Detect and redirect to appropriate locale
    const detectedLocale = detectLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${detectedLocale}`;
    
    const response = NextResponse.redirect(url);
    // Save preference for future visits (30 days)
    response.cookies.set('NEXT_LOCALE', detectedLocale, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
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
