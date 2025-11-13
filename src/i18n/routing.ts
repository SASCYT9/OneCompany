import {Pathnames, LocalePrefix} from 'next-intl/routing';

export const locales = ['en', 'ua'] as const;
export const localePrefix: LocalePrefix = 'always';

export const pathnames: Pathnames<typeof locales> = {
  '/': '/',
  '/about': {
    en: '/about',
    ua: '/about'
  }
};
