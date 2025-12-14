'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getBrandLogo } from '@/lib/brandLogos';
import { getBrandMetadata, LocalBrand, countryNames, subcategoryNames } from '@/lib/brands';
import { CategoryData } from '@/lib/categoryData';
import { BreadcrumbSchema, CollectionPageSchema } from '@/components/seo/StructuredData';
import { curatedBrandStories } from '@/lib/brandStories';
import { BrandModal } from '@/components/ui/BrandModal';
import { BrandItem } from '@/components/sections/BrandLogosGrid';

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
    
    // Get story data if available
    const story = curatedBrandStories[brand.name];
    const headline = story ? story.headline[lang] : undefined;
    const description = lang === 'ua' ? brand.descriptionUA : brand.description;

    setSelectedBrand({
      name: brand.name,
      logoSrc: logo,
      country,
      subcategory,
      description,
      website: brand.website,
      headline
    });
  };

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
         <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
           {brands.map(brand => {
             const logo = getBrandLogo(brand.name);
             return (
                <div 
                  key={brand.name}
                  onClick={() => handleBrandClick(brand)}
                  className="group relative aspect-[3/2] flex items-center justify-center p-6 bg-white/[0.02] border border-white/10 rounded-2xl hover:bg-white/[0.05] hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-500 backdrop-blur-sm overflow-hidden cursor-pointer"
                >
                  {/* Radial white backlight for dark logos */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[80%] h-[80%] bg-[radial-gradient(circle,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0.04)_40%,_transparent_70%)] group-hover:bg-[radial-gradient(circle,_rgba(255,255,255,0.18)_0%,_rgba(255,255,255,0.08)_40%,_transparent_70%)] transition-all duration-500 rounded-full" />
                  </div>

                  {/* Logo with unified sizing */}
                  <div className="relative w-full h-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-all duration-500">
                    <div className="relative w-full h-full p-2" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
                      <Image
                        src={logo}
                        alt={brand.name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
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