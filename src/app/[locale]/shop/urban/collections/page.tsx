import { absoluteUrl, buildPageMetadata, resolveLocale } from '@/lib/seo';
import UrbanCollectionsGrid from '../../components/UrbanCollectionsGrid';
import Link from 'next/link';
import { URBAN_COLLECTION_CARDS } from '../../data/urbanCollectionsList';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, 'shop/urban/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Модельний ряд Urban | One Company'
        : 'Urban Range | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Повний модельний ряд Urban Automotive: Defender, Urus, Cullinan, G-Wagon та інші.'
        : 'Full Urban Automotive range: Defender, Urus, Cullinan, G-Wagon and more.',
  });
}

export default async function UrbanCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';
  const cards = URBAN_COLLECTION_CARDS;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isUa ? 'Модельний ряд Urban' : 'Urban range',
    url: absoluteUrl(`/${resolvedLocale}/shop/urban/collections`),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: cards.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(`/${resolvedLocale}/shop/urban/collections/${item.collectionHandle}`),
        name: item.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="w-full max-w-[1720px] mx-auto px-6 md:px-12 lg:px-16 pt-32 pb-4">
        <Link href={`/${locale}/shop/urban`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] relative z-10">
          <span>←</span> {isUa ? 'Urban головна' : 'Urban home'}
        </Link>
      </div>
      <UrbanCollectionsGrid locale={resolvedLocale} cards={cards} />
    </>
  );
}
