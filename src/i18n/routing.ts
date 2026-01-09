import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const locales = ['en', 'ua'] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: 'ua',
  // Map 'ua' locale to proper ISO 'uk' language code for hreflang
  localePrefix: 'always',
  alternateLinks: true
});

export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);

