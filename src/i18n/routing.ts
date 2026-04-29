import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const locales = ['en', 'ua'] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: 'ua',
  // Map 'ua' locale to proper ISO 'uk' language code for hreflang
  localePrefix: 'always',
  alternateLinks: true,
  // Disable next-intl's NEXT_LOCALE cookie. proxy.ts already manages it on
  // the root-redirect only. When intl middleware sets the cookie on every
  // request, the Set-Cookie header forces Vercel to bypass the ISR edge
  // cache (Cache-Control becomes private, no-store) → no perf gain from ISR.
  localeCookie: false,
});

export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);

