import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const locales = ['en', 'ua'] as const;

export const routing = defineRouting({
  locales: ['en', 'ua'],
  defaultLocale: 'ua'
});

export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);

