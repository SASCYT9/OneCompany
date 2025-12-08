'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { getBrandMetadata, getLocalizedCountry, getLocalizedSubcategory, LocalBrand } from '@/lib/brands';
import { BrandStory } from '@/lib/brandStories';

interface Props {
  brand: LocalBrand;
  story: BrandStory;
  locale: string;
}

export default function BrandPageClient({ brand, story, locale }: Props) {
  const lang = (locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';
  
  const metadata = getBrandMetadata(brand.name);
  const country = metadata ? getLocalizedCountry(metadata.country, lang) : null;
  const subcategory = metadata ? getLocalizedSubcategory(metadata.subcategory, lang) : null;

  return (
    <div className="min-h-screen relative text-white flex items-center justify-center p-4 md:p-8">
      {/* Video Background */}
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-40"
        >
          <source src="/videos/MotoBG-web.mp4" type="video/mp4" />
        </video>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      </div>

      {/* Content Card (Mimicking the Modal) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-4xl rounded-[32px] border border-white/20 bg-zinc-900/90 backdrop-blur-xl p-8 md:p-12 text-white shadow-2xl"
      >
        {/* Header Section */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
          <div className="relative h-24 w-full sm:h-28 sm:w-72 md:h-32 md:w-80 bg-white/5 rounded-xl border border-white/10">
            <Image
              src={getBrandLogo(brand.name)}
              alt={brand.name}
              fill
              className="object-contain p-6"
              unoptimized
              priority
            />
          </div>
          
          <Link
            href={`/${locale}/brands`}
            className="self-end md:self-auto rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:border-white hover:text-white transition-colors"
          >
            {locale === 'ua' ? 'Всі бренди' : 'All Brands'}
          </Link>
        </div>

        {/* Info Grid */}
        <div className="grid gap-10 md:grid-cols-2">
          {/* Left Column: Story */}
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/50 sm:text-xs sm:tracking-[0.4em] mb-6">
              {country && <span>{country}</span>}
              {country && subcategory && <span className="text-white/30">·</span>}
              {subcategory && <span className="text-white/60">{subcategory}</span>}
            </div>
            
            <h1 className="text-3xl md:text-4xl font-light mb-6 leading-tight">
              {story.headline[lang]}
            </h1>
            
            <p className="text-base md:text-lg text-white/70 leading-relaxed font-light">
              {story.description[lang]}
            </p>

            {brand.website && (
               <div className="mt-8">
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm uppercase tracking-widest text-white/60 hover:text-white transition-colors border-b border-white/20 hover:border-white pb-1"
                  >
                    {locale === 'ua' ? 'Офіційний сайт' : 'Official Website'}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
               </div>
            )}
          </div>
          
          {/* Right Column: Highlights */}
          <div className="space-y-4">
            {story.highlights?.map((highlight, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm md:text-base text-white/80 font-light"
              >
                {highlight[lang]}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
