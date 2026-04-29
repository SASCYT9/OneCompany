import { resolveLocale } from '@/lib/seo';
import OurStoresPortal from './components/OurStoresPortal';

export { generateMetadata } from './metadata';

// ISR: cache the rendered HTML for 1 hour. The B2B-only stock card
// is rendered client-side via useSession() so the page stays static.
export const revalidate = 3600;

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

