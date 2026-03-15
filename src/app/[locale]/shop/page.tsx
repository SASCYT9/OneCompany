import { resolveLocale } from '@/lib/seo';
import OurStoresPortal from './components/OurStoresPortal';

export { generateMetadata } from './metadata';

type Props = {
  params: Promise<{ locale: string }>;
};

/** Сторінка /shop — тільки «Наші магазини» (Urban, KW, FI, Eventuri). Не використовувати ShopPageClient / каталог «Обери бренд» тут. */
export default async function ShopPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return (
    <div data-page="our-stores">
      <OurStoresPortal locale={resolvedLocale} />
    </div>
  );
}

