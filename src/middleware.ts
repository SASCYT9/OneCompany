import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import {routing} from './i18n/routing';
 
const intlMiddleware = createMiddleware(routing);

// Map internal locale codes to ISO language codes for hreflang
const localeToHreflang: Record<string, string> = {
  'ua': 'uk',
  'en': 'en'
};

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip middleware for non-localized routes (admin, APIs, Telegram WebApp)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api') || pathname.startsWith('/telegram-app')) {
    return NextResponse.next();
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
