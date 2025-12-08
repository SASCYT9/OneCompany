'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { getBrandMetadata, getLocalizedCountry, getLocalizedSubcategory, LocalBrand } from '@/lib/brands';
import { CategoryData } from '@/lib/categoryData';
import { BreadcrumbSchema, CollectionPageSchema } from '@/components/seo/StructuredData';
import { curatedBrandStories } from '@/lib/brandStories';

interface Props {
  category: CategoryData;
  brands: LocalBrand[];
  locale: string;
}

type LocalizedCopy = { en: string; ua: string; [key: string]: string };

export default function CategoryPageClient({ category, brands, locale }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<LocalBrand | null>(null);
  const lang = (locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';

  const getBrandOrigin = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedCountry(metadata.country, lang);
      }
      return lang === 'ua' ? 'Світовий портфель' : 'Global program';
    },
    [lang]
  );

  const getBrandSubcategory = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedSubcategory(metadata.subcategory, lang);
      }
      return null;
    },
    [lang]
  );

  const getBrandStory = useCallback((brand: LocalBrand) => {
    // Check if we have a curated story for this brand
    if (curatedBrandStories[brand.name]) {
      return curatedBrandStories[brand.name];
    }

    // Default story if no specific one exists
    return {
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
  }, []);

  const selectedBrandStory = selectedBrand ? getBrandStory(selectedBrand) : null;
  const selectedBrandOrigin = selectedBrand ? getBrandOrigin(selectedBrand) : null;
  const selectedBrandSubcategory = selectedBrand ? getBrandSubcategory(selectedBrand) : null;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const breadcrumbs = [
    { name: locale === 'ua' ? 'Головна' : 'Home', url: `${baseUrl}/${locale}` },
    { name: category.segment === 'moto' ? (locale === 'ua' ? 'Мото' : 'Moto') : (locale === 'ua' ? 'Авто' : 'Auto'), url: `${baseUrl}/${locale}/${category.segment}` },
    { name: category.title[lang], url: `${baseUrl}/${locale}/${category.segment}/categories/${category.slug}` },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 text-white relative">
       <BreadcrumbSchema items={breadcrumbs} />
       <CollectionPageSchema 
         name={category.title[lang]} 
         description={category.description[lang]} 
         url={`${baseUrl}/${locale}/${category.segment}/categories/${category.slug}`} 
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
       <div className="px-6 md:px-10 relative z-10">
         <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
           {brands.map(brand => {
             const meta = getBrandMetadata(brand.name);
             const country = meta ? getLocalizedCountry(meta.country, lang) : undefined;
             
             return (
                <motion.button
                  key={brand.name}
                  onClick={() => setSelectedBrand(brand)}
                  whileHover={{ y: -6 }}
                  className="group relative flex flex-col items-start text-left overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition backdrop-blur-md hover:bg-white/10 hover:border-white/20"
                >
                  {country && (
                    <div className="mb-4 px-2 py-1 bg-black/30 rounded text-[10px] uppercase tracking-widest text-white/70">
                      {country}
                    </div>
                  )}
                  
                  <div className="relative w-full aspect-[3/2] mb-4 flex items-center justify-center">
                    <Image
                      src={getBrandLogo(brand.name)}
                      alt={brand.name}
                      fill
                      className="object-contain p-4 transition-all duration-500 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      unoptimized
                    />
                  </div>

                  <div className="mt-auto w-full border-t border-white/10 pt-4">
                    <h3 className="text-lg font-light text-white group-hover:text-white/90 transition-colors">
                      {brand.name}
                    </h3>
                  </div>
                </motion.button>
             );
           })}
         </div>
       </div>

       {/* Modal */}
       <AnimatePresence>
        {selectedBrand && selectedBrandStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.currentTarget === e.target) {
                setSelectedBrand(null);
              }
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl rounded-[32px] border border-white/20 bg-zinc-900 p-8 text-white shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="relative h-20 w-full sm:h-24 sm:w-64 md:h-28 md:w-72 bg-white/5 rounded-xl">
                  <Image
                    src={getBrandLogo(selectedBrand.name)}
                    alt={selectedBrand.name}
                    fill
                    className="object-contain p-4"
                    unoptimized
                  />
                </div>
                <button
                  onClick={() => setSelectedBrand(null)}
                  className="self-end md:self-auto rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/70 hover:border-white hover:text-white transition-colors"
                >
                  {locale === 'ua' ? 'Закрити' : 'Close'}
                </button>
              </div>

              <div className="mt-8 grid gap-8 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/50 sm:text-xs sm:tracking-[0.4em]">
                    <span>{selectedBrandOrigin}</span>
                    {selectedBrandSubcategory && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="text-white/60">{selectedBrandSubcategory}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-4 text-3xl font-light">{selectedBrandStory.headline[lang]}</h3>
                  <p className="mt-4 text-sm text-white/70 leading-relaxed">{selectedBrandStory.description[lang]}</p>
                  
                  {selectedBrand.website && (
                    <div className="mt-8">
                      <a 
                          href={selectedBrand.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-full bg-white text-black px-8 py-3 text-sm font-medium hover:bg-white/90 transition-colors"
                      >
                          {locale === 'ua' ? 'Офіційний сайт' : 'Official Website'}
                      </a>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  {selectedBrandStory.highlights?.map((highlight, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80"
                    >
                      {highlight[lang]}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
