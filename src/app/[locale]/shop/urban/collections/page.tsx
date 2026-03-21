import { absoluteUrl, buildPageMetadata, resolveLocale } from '@/lib/seo';
import UrbanCollectionsGrid from '../../components/UrbanCollectionsGrid';
import Link from 'next/link';
import { URBAN_COLLECTION_CARDS } from '../../data/urbanCollectionsList';
import { getUrbanCollectionPageConfig } from '../../data/urbanCollectionPages.server';

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

  const cardsWithConfig = URBAN_COLLECTION_CARDS.filter(
    (card) => getUrbanCollectionPageConfig(card.collectionHandle) != null
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isUa ? 'Модельний ряд Urban' : 'Urban range',
    url: absoluteUrl(`/${resolvedLocale}/shop/urban/collections`),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: cardsWithConfig.map((item, index) => ({
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
      <div className="urban-back-to-stores">
        <Link href={`/${locale}/shop/urban`} className="urban-back-to-stores__link">
          ← {isUa ? 'Urban головна' : 'Urban home'}
        </Link>
      </div>
      <UrbanCollectionsGrid locale={resolvedLocale} cards={cardsWithConfig} />
    </>
  );
}
