'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { getBrandLogo } from '@/lib/brandLogos';
import { shouldInvertBrand } from '@/lib/invertBrands';
import { getBrandMetadata, LocalBrand, countryNames, subcategoryNames, getLocalizedCountry } from '@/lib/brands';
import { CategoryData } from '@/lib/categoryData';
import { BreadcrumbSchema, CollectionPageSchema } from '@/components/seo/StructuredData';
import { getBrandStoryForBrand } from '@/lib/brandStories';
import { BrandModal } from '@/components/ui/BrandModal';
import { BrandItem } from '@/components/sections/BrandLogosGrid';
import { absoluteUrl, buildLocalizedPath } from '@/lib/seo';

interface Props {
  category: CategoryData;
  brands: LocalBrand[];
  locale: string;
}

export default function CategoryPageClient({ category, brands, locale }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<BrandItem | null>(null);
  const lang = (locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';

  const handleBrandClick = (brand: LocalBrand) => {
    const logo = getBrandLogo(brand.name);
    const metadata = getBrandMetadata(brand.name);
    const country = metadata ? countryNames[metadata.country][lang] : undefined;
    const subcategory = metadata ? subcategoryNames[metadata.subcategory][lang] : undefined;

    const story = getBrandStoryForBrand(brand, category.segment === 'moto' ? 'Moto' : 'Auto');
    const headline = story.headline[lang];
    const description = story.description[lang];
    const highlights = story.highlights.map((h) => h[lang]);

    setSelectedBrand({
      name: brand.name,
      logoSrc: logo,
      country,
      subcategory,
      description,
      website: brand.website,
      headline,
      highlights,
    });
  };

  const resolvedLocale = locale === 'ua' ? 'ua' : 'en';
  const breadcrumbs = [
    { name: locale === 'ua' ? 'Головна' : 'Home', url: absoluteUrl(buildLocalizedPath(resolvedLocale)) },
    {
      name: category.segment === 'moto' ? (locale === 'ua' ? 'Мото' : 'Moto') : (locale === 'ua' ? 'Авто' : 'Auto'),
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, `/${category.segment}`)),
    },
    {
      name: category.title[lang],
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, `/${category.segment}/categories/${category.slug}`)),
    },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 text-white relative">
       <BreadcrumbSchema items={breadcrumbs} />
       <CollectionPageSchema 
         name={category.title[lang]} 
         description={category.description[lang]} 
         url={absoluteUrl(buildLocalizedPath(resolvedLocale, `/${category.segment}/categories/${category.slug}`))} 
       />

       {/* Video Background */}
       <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-40"
        >
          <source src={category.segment === 'auto' ? '/videos/rollsbg-v3.mp4' : '/videos/MotoBG-web.mp4'} type="video/mp4" />
        </video>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

       {/* Header */}
       <div className="px-6 md:px-10 mb-20 text-center relative z-10">
          <Link 
            href={`/${locale}/${category.segment}`}
            aria-label={category.segment === 'moto' ? 'Go to moto tuning section' : 'Go to auto tuning section'}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8 uppercase tracking-widest font-light"
          >
            ← {category.segment === 'moto' ? (locale === 'ua' ? 'Назад до Мото' : 'Back to Moto') : (locale === 'ua' ? 'Назад до Авто' : 'Back to Auto')}
          </Link>
          
          <div className="block mb-4">
            <div className="inline-block px-3 py-1 border border-white/20 rounded-full backdrop-blur-md bg-white/5">
              <span className="text-xs uppercase tracking-widest text-white/70">
                {category.segment === 'moto' ? (lang === 'ua' ? 'Мото' : 'Moto') : (lang === 'ua' ? 'Авто' : 'Auto')}
              </span>
            </div>
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
       <div className="px-4 sm:px-6 lg:px-8 relative z-10 pb-24">
         <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 auto-rows-max">
           {brands.map((brand, index) => {
             const meta = getBrandMetadata(brand.name);
             const country = meta ? getLocalizedCountry(meta.country, lang) : undefined;
             const logo = getBrandLogo(brand.name);
             const isFeatured = index === 0 || index === 1;
             
             return (
                <motion.button
                  key={brand.name}
                  onClick={() => handleBrandClick(brand)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className={`group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left ${
                    isFeatured 
                      ? 'lg:row-span-2 min-h-[320px] sm:min-h-[380px]' 
                      : 'min-h-[240px]'
                  }`}
                >
                  <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className={`relative h-full flex flex-col ${
                    isFeatured ? 'p-6 sm:p-8 lg:p-12' : 'p-6 sm:p-8'
                  }`}>
                    <div className="flex-1 flex items-center justify-center py-6">
                      <div className={`relative w-full max-w-[200px] ${
                        isFeatured ? 'h-28 sm:h-36 lg:h-44' : 'h-24 sm:h-32'
                      }`}>
                        <Image
                          src={logo}
                          alt={brand.name}
                          fill
                          className={`object-contain transition-all duration-500 group-hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] ${shouldInvertBrand(brand.name) ? 'filter brightness-0 invert' : ''}`}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          unoptimized
                        />
                      </div>
                    </div>

                    {country && (
                      <div className="flex justify-center -mt-2 mb-2">
                        <span className="text-[10px] uppercase tracking-widest text-white/50">{country}</span>
                      </div>
                    )}

                    <div className="flex items-end justify-between gap-4 mt-4">
                      <div>
                        <p className={`font-light text-white tracking-wide ${
                          isFeatured ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-lg sm:text-xl'
                        }`}>{brand.name}</p>
                        {/* Optional: Add short description or category if available */}
                      </div>
                      
                      <div className={`flex items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-white/40 group-hover:bg-white/20 shrink-0 ${
                        isFeatured ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-10 w-10 sm:h-12 sm:w-12'
                      }`}>
                        <svg className={`text-white transition-transform duration-500 group-hover:-rotate-45 ${
                          isFeatured ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-4 w-4 sm:h-5 sm:w-5'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </motion.button>
             );
           })}
         </div>
       </div>

       {/* Modal */}
       <BrandModal
          brand={selectedBrand}
          isOpen={!!selectedBrand}
          onClose={() => setSelectedBrand(null)}
       />
    </div>
  );
}
