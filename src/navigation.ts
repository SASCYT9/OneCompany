import { createLocalizedPathnamesNavigation } from 'next-intl/navigation';

export const locales = ['en', 'ua'] as const;
export const localePrefix = 'always'; // Default

export const { Link, redirect, usePathname, useRouter } = createLocalizedPathnamesNavigation({
  locales,
  localePrefix,
});