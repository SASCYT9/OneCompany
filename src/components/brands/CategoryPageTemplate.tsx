'use client';

import { categoryData } from '@/lib/categoryData';
import { getBrandsByNames, getBrandSlug, getLocalizedCountry, CountryOfOrigin } from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import ProductCard from '@/components/products/ProductCard';
import { notFound } from 'next/navigation';

interface Props {
  categorySlug: string;
  locale: string;
}

export default function CategoryPageTemplate({ categorySlug, locale }: Props) {
  const lang = (locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';
  
  const category = categoryData.find(c => c.slug === categorySlug);
  
  if (!category) {
    notFound();
  }

  // Map segment to BrandCategory
  const brandCategory = category.segment === 'moto' ? 'moto' : 'auto';
  const brands = getBrandsByNames(category.brands, brandCategory);

  return (
    <div className="min-h-screen bg-white dark:bg-black pt-32 pb-20">
       {/* Header */}
       <div className="px-6 md:px-10 mb-20 text-center">
          <div className="inline-block mb-4 px-3 py-1 border border-zinc-200 dark:border-white/10 rounded-full">
            <span className="text-xs uppercase tracking-widest text-zinc-500 dark:text-white/50">
              {category.segment === 'moto' ? (lang === 'ua' ? 'Мото' : 'Moto') : (lang === 'ua' ? 'Авто' : 'Auto')}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-8">
            {category.title[lang]}
          </h1>
          <p className="text-lg md:text-xl font-light text-zinc-600 dark:text-white/60 max-w-3xl mx-auto leading-relaxed">
            {category.description[lang]}
          </p>
          {category.spotlight && (
             <p className="mt-4 text-sm md:text-base font-light text-zinc-400 dark:text-white/40 max-w-2xl mx-auto">
               {category.spotlight[lang]}
             </p>
          )}
       </div>

       {/* Grid */}
       <div className="px-6 md:px-10">
         <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
           {brands.map(brand => (
             <ProductCard
               key={brand.name}
               name={brand.name}
               image={getBrandLogo(brand.name)}
               href={`/${locale}/brands/${getBrandSlug(brand)}`}
               category={brand.country ? getLocalizedCountry(brand.country as CountryOfOrigin, lang) : undefined}
             />
           ))}
         </div>
       </div>
    </div>
  );
}
