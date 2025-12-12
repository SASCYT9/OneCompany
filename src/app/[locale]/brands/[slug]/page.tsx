import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getBrandWithCategory, getBrandSlug, allAutomotiveBrands, allMotoBrands, getBrandMetadata } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { notFound } from 'next/navigation';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { BrandSchema, BreadcrumbSchema } from '@/components/seo/StructuredData';
import BrandPageClient from './BrandPageClient';
import { curatedBrandStories } from '@/lib/brandStories';

interface BrandDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

// Generate static params for all brands
export async function generateStaticParams() {
  const allBrands = [...allAutomotiveBrands, ...allMotoBrands];
  
  return allBrands.map((brand) => ({
    slug: getBrandSlug(brand),
  }));
}

// Dynamic metadata for each brand page
export async function generateMetadata({ params }: BrandDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const brand = getBrandWithCategory(slug);
  
  if (!brand) {
    return {};
  }
  
  const brandMeta = getBrandMetadata(brand.name);
  const isMoto = brand.category === 'moto';
  
  const meta = {
    en: {
      title: `${brand.name} · OneCompany`,
      description: `Buy ${brand.name} ${brandMeta?.subcategory || 'performance parts'} in Ukraine. ${brand.description || ''}`.trim(),
    },
    ua: {
      title: `${brand.name} · OneCompany`,
      description: `Купити ${brand.name} ${brandMeta?.subcategory || 'тюнінг'} в Україні. ${brand.description || ''}`.trim(),
    },
  };

  return {
    ...buildPageMetadata(resolvedLocale, `brands/${slug}`, meta[resolvedLocale]),
    keywords: [
      brand.name,
      `${brand.name} Ukraine`,
      `${brand.name} Україна`,
      `buy ${brand.name}`,
      `купити ${brand.name}`,
      brandMeta?.subcategory || 'tuning',
      isMoto ? 'motorcycle parts' : 'car parts',
    ],
  };
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  
  const brand = getBrandWithCategory(slug);
  
  if (!brand) {
    notFound();
  }
  
  const logoSrc = getBrandLogo(brand.name);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const currentUrl = `${baseUrl}/${locale}/brands/${slug}`;

  const breadcrumbs = [
    { name: locale === 'ua' ? 'Головна' : 'Home', url: `${baseUrl}/${locale}` },
    { name: locale === 'ua' ? 'Бренди' : 'Brands', url: `${baseUrl}/${locale}/brands` },
    { name: brand.name, url: currentUrl },
  ];

  // Resolve story
  const story = curatedBrandStories[brand.name] || {
    headline: {
        en: `${brand.name} — premium performance`,
        ua: `${brand.name} — преміум продуктивність`,
    },
    description: {
        en: brand.description || 'Official distribution, warranty support and direct supply from the manufacturer.',
        ua: brand.descriptionUA || 'Офіційна дистрибуція, гарантійна підтримка та прямі поставки від виробника.',
    },
    highlights: [
        { en: 'Global warranty', ua: 'Глобальна гарантія' },
        { en: 'Direct supply', ua: 'Прямі поставки' },
        { en: 'Expert installation', ua: 'Експертне встановлення' },
    ],
  };

  return (
    <>
      <BrandSchema 
        name={brand.name}
        description={brand.description || (locale === 'ua' ? `Імпортер ${brand.name} в Україні` : `${brand.name} importer in Ukraine`)}
        url={currentUrl}
        logo={`${baseUrl}${logoSrc}`}
      />
      <BreadcrumbSchema items={breadcrumbs} />
      
      <BrandPageClient 
        brand={brand}
        story={story}
        locale={locale}
      />
    </>
  );
}
