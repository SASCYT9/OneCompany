import { getTranslations, setRequestLocale } from 'next-intl/server';
import { allAutomotiveBrands, allMotoBrands, getBrandSlug } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import ProductCard from '@/components/products/ProductCard';
import Link from 'next/link';

interface BrandsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function BrandsPage({ params }: BrandsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  
  const automotiveItems = allAutomotiveBrands.map(b => ({
    name: b.name,
    logoSrc: getBrandLogo(b.name),
    slug: getBrandSlug(b),
  }));

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero Section */}
      <div className="px-6 md:px-10 py-32 md:py-40">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-8 leading-tight">
            {t('brandsPage.title')}
          </h1>
          <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto mb-10" />
          <p className="text-xl md:text-2xl font-light text-zinc-600 dark:text-white/50 max-w-3xl mx-auto">
            Explore our curated collection of premium automotive and motorcycle brands
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="border-t border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="flex justify-center space-x-16 py-6">
            <Link 
              href={`/${locale}/brands`} 
              className="text-base font-light pb-2 border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white uppercase tracking-widest"
            >
              {t('auto.title')}
            </Link>
            <Link 
              href={`/${locale}/brands/moto`} 
              className="text-base font-light pb-2 text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white transition-colors uppercase tracking-widest"
            >
              {t('moto.title')}
            </Link>
          </div>
        </div>
      </div>

      {/* Brands Grid */}
      <div className="px-6 md:px-10 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {automotiveItems.map((brand) => (
              <ProductCard
                key={brand.name}
                name={brand.name}
                image={brand.logoSrc}
                href={`/${locale}/brands/${brand.slug}`}
                category="Automotive"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="px-6 md:px-10 pb-16">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-zinc-400 dark:text-white/30 font-light">{t('brandsPage.logoDisclaimer')}</p>
        </div>
      </div>
    </div>
  );
}