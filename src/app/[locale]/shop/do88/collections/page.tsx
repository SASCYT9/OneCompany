import { absoluteUrl, buildPageMetadata, resolveLocale } from "@/lib/seo";
import Do88CollectionsGrid from "../../components/Do88CollectionsGrid";
import Link from "next/link";
import { DO88_COLLECTION_CARDS } from "../../data/do88CollectionsList";
import { Suspense } from "react";
import Do88VehicleFilter from "../Do88VehicleFilter";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/do88/collections", {
    title:
      resolvedLocale === "ua"
        ? "Модельний ряд DO88 | One Company"
        : "DO88 Categories | One Company",
    description:
      resolvedLocale === "ua"
        ? "Каталог категорій DO88: Інтеркулери, радіатори, патрубки, масляні радіатори та інші."
        : "DO88 categories: Intercoolers, radiators, hoses, oil coolers and more.",
  });
}

export default async function Do88CollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: isUa ? "Категорії DO88" : "DO88 categories",
    url: absoluteUrl(`/${resolvedLocale}/shop/do88/collections`),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: DO88_COLLECTION_CARDS.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/${resolvedLocale}/shop/do88/collections/${item.categoryHandle}`),
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
        <Link href={`/${locale}/shop/do88`} className="urban-back-to-stores__link">
          ← {isUa ? "DO88 головна" : "DO88 home"}
        </Link>
      </div>
      <div className="w-full px-4 md:px-8 mb-4 mt-2 max-w-[1500px] mx-auto">
        <Suspense
          fallback={
            <div className="h-16 bg-foreground/5 dark:bg-white/5 rounded-2xl animate-pulse max-w-5xl mx-auto" />
          }
        >
          <Do88VehicleFilter locale={resolvedLocale} compact={true} />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-[50vh]">
            <div className="w-8 h-8 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
          </div>
        }
      >
        <Do88CollectionsGrid locale={resolvedLocale} cards={DO88_COLLECTION_CARDS} />
      </Suspense>
    </>
  );
}
