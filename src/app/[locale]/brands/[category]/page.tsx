// src/app/[locale]/brands/[category]/page.tsx
import { useTranslations } from 'next-intl';
import { getBrandsByCategory, allAutomotiveBrands, allMotoBrands } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import BrandLogosGrid from '@/components/sections/BrandLogosGrid';
import CategoryCard from '@/components/ui/CategoryCard';
import { Link } from '@/navigation';
import { notFound } from 'next/navigation';

interface BrandsCategoryPageProps {
  params: {
    category: string;
  };
}

export default function BrandsCategoryPage({ params }: BrandsCategoryPageProps) {
  const t = useTranslations();
  const { category } = params;

  const brands = getBrandsByCategory(category);
  if (brands.length === 0) {
    notFound();
  }

  const items = brands.map(b => ({
    name: b.name,
    logoSrc: getBrandLogo(b.name),
  }));

  const isMoto = category === 'moto';

  const categories = [
    { name: t('categories.usa'), href: '/brands/usa' },
    { name: t('categories.europe'), href: '/brands/europe' },
    { name: t('categories.oem'), href: '/brands/oem' },
    { name: t('categories.racing'), href: '/brands/racing' },
  ];

  return (
    <div className="px-6 md:px-10 py-20 md:py-28">
      <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight">{t('brandsPage.title')}</h1>

      {!isMoto && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {categories.map(cat => (
            <CategoryCard key={cat.name} title={cat.name} href={cat.href} />
          ))}
        </div>
      )}

      <div className="flex space-x-8 mb-10 border-b border-white/20">
        <Link
          href="/brands"
          className={`text-lg font-semibold pb-3 border-b-2 ${!isMoto ? 'border-blue-500' : 'border-transparent text-white/60 hover:text-white'}`}
        >
          {t('auto.title')}
        </Link>
        <Link
          href="/brands/moto"
          className={`text-lg font-semibold pb-3 border-b-2 ${isMoto ? 'border-blue-500' : 'border-transparent text-white/60 hover:text-white'}`}
        >
          {t('moto.title')}
        </Link>
      </div>

      <BrandLogosGrid items={items} />

      <p className="mt-6 text-xs text-white/40">{t('brandsPage.logoDisclaimer')}</p>
    </div>
  );
}
