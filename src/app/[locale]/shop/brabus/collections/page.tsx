import { absoluteUrl, buildPageMetadata, resolveLocale } from "@/lib/seo";
import BrabusCollectionsGrid from "../../components/BrabusCollectionsGrid";
import Link from "next/link";
import { BRABUS_COLLECTION_CARDS } from "../../data/brabusCollectionsList";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/brabus/collections", {
    title:
      resolvedLocale === "ua" ? "Модельний ряд Brabus | One Company" : "Brabus Range | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний модельний ряд Brabus: G-Class, Porsche, Rolls Royce, Interieur та інші."
        : "Full Brabus range: G-Class, Porsche, Rolls Royce, Interieur and more.",
  });
}

export default async function BrabusCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: isUa ? "Модельний ряд Brabus" : "Brabus range",
    url: absoluteUrl(`/${resolvedLocale}/shop/brabus/collections`),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: BRABUS_COLLECTION_CARDS.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/${resolvedLocale}/shop/brabus/collections/${item.collectionHandle}`),
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
        <Link href={`/${locale}/shop/brabus`} className="urban-back-to-stores__link">
          ← {isUa ? "Brabus головна" : "Brabus home"}
        </Link>
      </div>
      <BrabusCollectionsGrid locale={resolvedLocale} cards={BRABUS_COLLECTION_CARDS} />
    </>
  );
}
