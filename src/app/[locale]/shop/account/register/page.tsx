import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import ShopAccountAuthClient from '../components/ShopAccountAuthClient';

type Props = {
  params: Promise<{ locale: SupportedLocale }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account/register', {
    title: resolvedLocale === 'ua' ? 'Реєстрація shop account | One Company' : 'Shop account registration | One Company',
    description: resolvedLocale === 'ua' ? 'Створення приватного shop account.' : 'Create a private customer account for One Company shop.',
  });
}

export default async function ShopAccountRegisterPage({ params }: Props) {
  const { locale } = await params;
  return <ShopAccountAuthClient locale={locale} mode="register" />;
}
