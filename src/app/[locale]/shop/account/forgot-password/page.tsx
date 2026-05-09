import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import ShopForgotPasswordClient from './ShopForgotPasswordClient';

type Props = {
  params: Promise<{ locale: SupportedLocale }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account/forgot-password', {
    title:
      resolvedLocale === 'ua'
        ? 'Скидання пароля | One Company'
        : 'Forgot password | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Скиньте пароль до вашого One Company shop account.'
        : 'Reset your One Company shop account password.',
  });
}

export default async function ShopForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  return <ShopForgotPasswordClient locale={locale} />;
}
