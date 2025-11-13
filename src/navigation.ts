import {createNavigation} from 'next-intl/navigation';
import {locales, pathnames} from './i18n/routing';

export const {Link, redirect, usePathname, useRouter} =
  createNavigation({locales, pathnames});