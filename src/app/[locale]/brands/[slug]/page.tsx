import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getBrandWithCategory, getBrandSlug, allAutomotiveBrands, allMotoBrands, getBrandMetadata } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ProductCard from '@/components/products/ProductCard';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { BrandSchema, BreadcrumbSchema } from '@/components/seo/StructuredData';
import ReadMore from '@/components/ui/ReadMore';

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
  const isMoto = brand.category === 'moto';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const currentUrl = `${baseUrl}/${locale}/brands/${slug}`;

  const breadcrumbs = [
    { name: locale === 'ua' ? 'Головна' : 'Home', url: `${baseUrl}/${locale}` },
    { name: locale === 'ua' ? 'Бренди' : 'Brands', url: `${baseUrl}/${locale}/brands` },
    { name: brand.name, url: currentUrl },
  ];
  
  // Get related brands from the same category (max 8)
  const relatedBrands = (isMoto ? allMotoBrands : allAutomotiveBrands)
    .filter(b => getBrandSlug(b) !== slug)
    .slice(0, 8)
    .map(b => ({
      name: b.name,
      logoSrc: getBrandLogo(b.name),
      slug: getBrandSlug(b),
    }));

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <BrandSchema 
        name={brand.name}
        description={brand.description || (locale === 'ua' ? `Імпортер ${brand.name} в Україні` : `${brand.name} importer in Ukraine`)}
        url={currentUrl}
        logo={`${baseUrl}${logoSrc}`}
      />
      <BreadcrumbSchema items={breadcrumbs} />
      {/* Full-Screen Hero with Brand Logo */}
      <div className="relative h-[70vh] flex items-center justify-center overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>
        
        {/* Logo Container */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] mb-8">
            <Image
              src={logoSrc}
              alt={brand.name}
              fill
              className="object-contain p-8"
              priority
            />
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extralight tracking-tight text-zinc-900 dark:text-white text-center mb-6">
            {brand.name}
          </h1>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-white/40 font-light">
            Scroll
          </span>
          <div className="w-px h-12 bg-gradient-to-b from-zinc-300 dark:from-white/20 to-transparent" />
        </div>
      </div>

      {/* Brand Story Section */}
      <div className="px-6 md:px-10 py-24 md:py-32">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-8">
            About {brand.name}
          </h2>
          
          <ReadMore 
            labelOpen={locale === 'ua' ? 'Читати далі' : 'Read More'}
            labelClose={locale === 'ua' ? 'Згорнути' : 'Show Less'}
          >
            <div className="prose prose-lg dark:prose-invert prose-zinc max-w-none">
              <p className="text-lg md:text-xl font-light text-zinc-600 dark:text-white/60 leading-relaxed mb-8">
                {brand.description || `${brand.name} represents excellence in ${isMoto ? 'motorcycle' : 'automotive'} performance and innovation. Discover the premium quality and craftsmanship that sets this brand apart.`}
              </p>
              
              {brand.specialties && brand.specialties.length > 0 && (
                <div className="mt-12">
                  <h3 className="text-xl font-light text-zinc-900 dark:text-white mb-6">Specialties</h3>
                  <ul className="space-y-3">
                    {brand.specialties.map((specialty, index) => (
                      <li key={index} className="flex items-start space-x-4">
                        <span className="text-zinc-400 dark:text-white/40 mt-1">—</span>
                        <span className="text-base font-light text-zinc-700 dark:text-white/70">{specialty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {brand.website && (
                <div className="mt-12">
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 border border-zinc-900 dark:border-white text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-300 text-xs uppercase tracking-widest font-light"
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </ReadMore>
        </div>
      </div>

      {/* Related Brands Section */}
      {relatedBrands.length > 0 && (
        <div className="px-6 md:px-10 py-20 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-6">
                More {isMoto ? 'Moto' : 'Automotive'} Brands
              </h2>
              <div className="w-20 h-px bg-zinc-300 dark:bg-white/20 mx-auto" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {relatedBrands.map((relatedBrand) => (
                <ProductCard
                  key={relatedBrand.name}
                  name={relatedBrand.name}
                  image={relatedBrand.logoSrc}
                  href={`/${locale}/brands/${relatedBrand.slug}`}
                  category={isMoto ? 'Motorcycle' : 'Automotive'}
                />
              ))}
            </div>
            
            <div className="text-center mt-12">
              <Link
                href={`/${locale}/brands${isMoto ? '/moto' : ''}`}
                className="inline-block px-6 py-3 border border-zinc-900 dark:border-white text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-300 text-xs uppercase tracking-widest font-light"
              >
                View All Brands
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
