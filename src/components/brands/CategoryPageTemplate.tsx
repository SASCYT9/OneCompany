'use client';

import { categoryData } from '@/lib/categoryData';
import { getBrandsByNames, getBrandSlug, getLocalizedCountry, CountryOfOrigin, getBrandMetadata } from '@/lib/brands';
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
    <div className="min-h-screen pt-32 pb-20 text-white">
       {/* Background Overlay for Video Readability */}
       <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] -z-10" />

       {/* Header */}
       <div className="px-6 md:px-10 mb-20 text-center relative z-10">
          <div className="inline-block mb-4 px-3 py-1 border border-white/20 rounded-full backdrop-blur-md bg-white/5">
            <span className="text-xs uppercase tracking-widest text-white/70">
              {category.segment === 'moto' ? (lang === 'ua' ? 'Мото' : 'Moto') : (lang === 'ua' ? 'Авто' : 'Auto')}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extralight tracking-tight text-white mb-8 drop-shadow-lg">
            {category.title[lang]}
          </h1>
          <p className="text-lg md:text-xl font-light text-white/80 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
            {category.description[lang]}
          </p>
          {category.spotlight && (
             <p className="mt-4 text-sm md:text-base font-light text-white/60 max-w-2xl mx-auto drop-shadow-sm">
               {category.spotlight[lang]}
             </p>
          )}
       </div>

       {/* Grid */}
       <div className="px-6 md:px-10 relative z-10">
         <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
           {brands.map(brand => {
             const meta = getBrandMetadata(brand.name);
             return (
               <ProductCard
                 key={brand.name}
                 name={brand.name}
                 image={getBrandLogo(brand.name)}
                 href={`/${locale}/brands/${getBrandSlug(brand)}`}
                 category={meta ? getLocalizedCountry(meta.country, lang) : undefined}
                 className="!bg-white/5 !border-white/10 hover:!bg-white/10 backdrop-blur-md"
               />
             );
           })}
         </div>
       </div>
    </div>
  );
}
