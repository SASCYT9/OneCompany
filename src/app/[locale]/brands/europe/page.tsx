import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getBrandsByCategory, brandMetadata, countryNames, subcategoryNames } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { getBrandStoryForBrand } from '@/lib/brandStories';
import BrandLogosGrid from '@/components/sections/BrandLogosGrid';
import CategoryCard from '@/components/ui/CategoryCard';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { absoluteUrl, buildLocalizedPath, resolveLocale } from "@/lib/seo";
import { buildBrandsSegmentMetadata } from "../segmentMetadata";
import { BreadcrumbSchema, CollectionPageSchema } from "@/components/seo/StructuredData";

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildBrandsSegmentMetadata(resolveLocale(locale), "europe");
}

export default async function BrandsCategoryEuropePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const lang = (locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';

  const category = 'europe';
  const brands = getBrandsByCategory(category);
  if (brands.length === 0) {
    notFound();
  }

  const items = brands.map(b => {
    const meta = brandMetadata[b.name];
    const story = getBrandStoryForBrand(
      { name: b.name, description: b.description, descriptionUA: b.descriptionUA },
      'Auto'
    );

    return {
      name: b.name,
      logoSrc: getBrandLogo(b.name),
      country: meta ? countryNames[meta.country][lang] : undefined,
      subcategory: meta ? subcategoryNames[meta.subcategory][lang] : undefined,
      website: b.website,
      headline: story.headline[lang],
      description: story.description[lang],
      highlights: story.highlights.map((h) => h[lang]),
    };
  });

  const categories = [
    { name: t('categories.usa'), href: `/${locale}/brands/usa` },
    { name: t('categories.europe'), href: `/${locale}/brands/europe` },
    { name: t('categories.oem'), href: `/${locale}/brands/oem` },
    { name: t('categories.racing'), href: `/${locale}/brands/racing` },
  ];
  const resolvedLocale = resolveLocale(locale);
  const breadcrumbs = [
    { name: resolvedLocale === "ua" ? "Головна" : "Home", url: absoluteUrl(buildLocalizedPath(resolvedLocale)) },
    { name: resolvedLocale === "ua" ? "Бренди" : "Brands", url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/brands")) },
    { name: resolvedLocale === "ua" ? "Європейські бренди" : "European brands", url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/brands/europe")) },
  ];

  return (
    <div className="px-6 md:px-10 py-20 md:py-28">
      <BreadcrumbSchema items={breadcrumbs} />
      <CollectionPageSchema
        name={resolvedLocale === "ua" ? "Європейські бренди" : "European brands"}
        description={resolvedLocale === "ua" ? "Каталог європейських брендів тюнінгу." : "Catalog of European tuning brands."}
        url={absoluteUrl(buildLocalizedPath(resolvedLocale, "/brands/europe"))}
      />
      <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight">{t('brandsPage.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {categories.map(cat => (
          <CategoryCard key={cat.name} title={cat.name} href={cat.href} />
        ))}
      </div>

      <div className="flex space-x-8 mb-10 border-b border-white/20">
        <Link
          href={`/${locale}/brands`}
          aria-label={resolvedLocale === "ua" ? "Перейти до брендів авто тюнінгу" : "Go to auto tuning brands"}
          className={`text-lg font-semibold pb-3 border-b-2 border-blue-500`}
        >
          {t('auto.title')}
        </Link>
        <Link
          href={`/${locale}/brands/moto`}
          aria-label={resolvedLocale === "ua" ? "Перейти до брендів мото тюнінгу" : "Go to moto tuning brands"}
          className={`text-lg font-semibold pb-3 border-b-2 border-transparent text-white/60 hover:text-white`}
        >
          {t('moto.title')}
        </Link>
      </div>

      <BrandLogosGrid items={items} />

      <p className="mt-6 text-xs text-white/40">{t('brandsPage.logoDisclaimer')}</p>
    </div>
  );
}
