// src/app/[locale]/auto/AutoPageClient.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import {
  allAutomotiveBrands,
  getBrandsByNames,
  LocalBrand,
  getBrandMetadata,
  getLocalizedCountry,
  getLocalizedSubcategory,
} from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { shouldInvertBrand, shouldSmartInvertBrand } from '@/lib/invertBrands';
import { categoryData } from '@/lib/categoryData';
import type { CategoryData } from '@/lib/categoryData';

import { BrandModal } from '@/components/ui/BrandModal';
import { getBrandStoryForBrand, BrandStory } from '@/lib/brandStories';
import { getTypography, resolveLocale } from '@/lib/typography';

const TOP_AUTOMOTIVE_BRANDS = [
  'Akrapovic',
  'Brabus',
  'Mansory',
  'HRE wheels',
  'Urban Automotive',
  'Eventuri',
  'KW Suspension',
  'Novitec',
  'ABT',
];





const automotiveCategories = categoryData.filter((cat) => cat.segment === 'auto');

// Brand configurations for the legendary grid
/* eslint-disable @typescript-eslint/no-unused-vars */
const LEGENDARY_BRAND_CONFIG: Record<string, {
  flag: string;
  country: string;
  tag?: string;
  tagColor?: string;
  accentColor: string;
  description: { en: string; ua: string };
  invertLogo?: boolean;
}> = {
  'Akrapovic': {
    flag: 'рџ‡ёрџ‡®',
    country: 'Slovenia',
    tag: 'Performance Exhaust',
    accentColor: 'red',
    description: { en: 'Exhaust systems', ua: 'Вихлопні системи' },
  },
  'Brabus': {
    flag: 'рџ‡©рџ‡Є',
    country: 'Germany',
    accentColor: 'zinc',
    description: { en: 'Premium tuning', ua: 'Преміум тюнінг' },
    invertLogo: true,
  },
  'Mansory': {
    flag: 'рџ‡©рџ‡Є',
    country: 'Germany',
    tag: 'Luxury',
    tagColor: 'amber',
    accentColor: 'amber',
    description: { en: 'Premium tuning', ua: 'Преміум тюнінг' },
    invertLogo: true,
  },
  'HRE wheels': {
    flag: 'рџ‡єрџ‡ё',
    country: 'USA',
    tag: 'Forged Wheels',
    accentColor: 'sky',
    description: { en: 'Premium forged wheels', ua: 'Преміум ковані диски' },
  },
  'Urban Automotive': {
    flag: 'рџ‡¬рџ‡§',
    country: 'UK',
    tag: 'Body Kits',
    accentColor: 'emerald',
    description: { en: 'Premium body kits', ua: 'Преміум обвіси' },
    invertLogo: true,
  },
  'Eventuri': {
    flag: '🇬🇧',
    country: 'UK',
    accentColor: 'cyan',
    description: { en: 'Intake systems', ua: 'Впускні системи' },
  },
  'KW Suspension': {
    flag: 'рџ‡©рџ‡Є',
    country: 'Germany',
    accentColor: 'orange',
    description: { en: 'Suspension', ua: 'Підвіска' },
  },
  'Novitec': {
    flag: 'рџ‡©рџ‡Є',
    country: 'Germany',
    tag: 'Supercars',
    accentColor: 'rose',
    description: { en: 'Supercar tuning', ua: 'Тюнінг суперкарів' },
    invertLogo: true,
  },
  'ABT': {
    flag: 'рџ‡©рџ‡Є',
    country: 'Germany',
    tag: 'VAG',
    accentColor: 'violet',
    description: { en: 'Premium VAG tuning', ua: 'Преміум тюнінг VAG' },
    invertLogo: true,
  },
};

export default function AutomotivePage() {
  const params = useParams();
  const locale = (params.locale === 'en' ? 'en' : 'ua') as 'en' | 'ua';
  const t = useTranslations('auto');
  const tPage = useTranslations('autoPage');
  const typography = getTypography(resolveLocale(locale));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<LocalBrand | null>(null);
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isBrandsOpen, setIsBrandsOpen] = useState(false);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const filteredBrands = allAutomotiveBrands.filter((brand) => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLetter = activeLetter ? brand.name.toUpperCase().startsWith(activeLetter) : true;
    return matchesSearch && matchesLetter;
  });

  const topBrands = useMemo(() => getBrandsByNames(TOP_AUTOMOTIVE_BRANDS, 'auto'), []);

  // Helper to find brand by name
  const findBrandByName = useCallback((name: string) => {
    return topBrands.find(b => b.name === name) || allAutomotiveBrands.find(b => b.name === name);
  }, [topBrands]);

  // Click handler for legendary brand cards
  const handleBrandClick = useCallback((brandName: string) => {
    const brand = findBrandByName(brandName);
    if (brand) {
      setSelectedBrand(brand);
    }
  }, [findBrandByName]);

  const brandCategoryMap = useMemo(() => {
    const map = new Map<string, CategoryData[]>();
    categoryData.forEach((cat) => {
      cat.brands.forEach((brandName) => {
        const key = brandName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(cat);
      });
    });
    return map;
  }, []);

  const getBrandOrigin = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedCountry(metadata.country, locale);
      }
      return locale === 'ua' ? 'Світовий портфель' : 'Global portfolio';
    },
    [locale]
  );

  const getBrandSubcategory = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedSubcategory(metadata.subcategory, locale);
      }
      return null;
    },
    [locale]
  );

  const getBrandCollections = useCallback(
    (brandName: string) => brandCategoryMap.get(brandName.trim().toLowerCase()) ?? [],
    [brandCategoryMap]
  );

  const getBrandStory = useCallback((brand: LocalBrand): BrandStory => {
    return getBrandStoryForBrand(brand, 'Auto');
  }, []);

  const selectedBrandStory = selectedBrand ? getBrandStory(selectedBrand) : null;
  const selectedBrandCollections = selectedBrand ? getBrandCollections(selectedBrand.name) : [];
  const selectedBrandOrigin = selectedBrand ? getBrandOrigin(selectedBrand) : null;
  const selectedBrandSubcategory = selectedBrand ? getBrandSubcategory(selectedBrand) : null;

  return (
    <div className="min-h-dvh bg-black text-white font-sans relative">
      <div className="fixed inset-0 z-0 bg-black">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-30"
        >
          <source src="/videos/hero-stream.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/70" />
      </div>
      <div className="relative z-10">
        <section className="relative isolate overflow-hidden rounded-b-[40px] border-b border-white/10">
          <div className="absolute inset-0">

            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)] sm:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
          </div>
          <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-32 pb-16 sm:gap-8 sm:px-6 sm:pt-40 sm:pb-20 md:gap-10 md:pt-48 md:pb-28">
            <div className="text-[9px] uppercase tracking-[0.4em] text-white/60 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">
              {locale === 'ua' ? 'Преміум програми | авто' : 'Premium programs | auto'}
            </div>
            <div className="max-w-4xl space-y-4 sm:space-y-5 md:space-y-6">
              <h1 className={`font-light leading-tight text-balance ${typography.heroTitle}`}>
                {t('title')}<span className="text-white/50"> | </span>
                <span className="text-white/70">{t('subtitle')}</span>
              </h1>
              <p className={`text-white/70 text-pretty ${typography.heroSubtitle}`}>
                {locale === 'ua'
                  ? 'Створюємо автомобілі з характером з 2007 року.'
                  : 'Creating cars with character since 2007.'}
              </p>
            </div>

          </div>
        </section>



        <section className="relative py-24 sm:py-32 md:py-40 overflow-hidden">
          {/* Video Background */}
          <div className="absolute inset-0">

          </div>
          {/* Epic Background Overlays - CLEANED UP */}

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-16 sm:mb-20 md:mb-28 text-center">
              <motion.h2
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.8 }}
                className={`font-extralight tracking-tight text-white text-balance ${typography.sectionHeading}`}
              >
                <span className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent">
                  {locale === 'ua' ? 'Легендарні бренди' : 'Legendary Brands'}
                </span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="mt-4 text-lg sm:text-xl text-zinc-500 max-w-xl mx-auto"
              >
                {locale === 'ua' ? 'Бренди, що формують індустрію' : 'Brands that shape the industry'}
              </motion.p>
            </div>

            {/* Legendary Grid - Equal Width Masonry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 auto-rows-max">

              {/* AKRAPOVIC - Hero Card */}
              <motion.button
                onClick={() => handleBrandClick('Akrapovic')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
              >
                {/* Glass Border/Background */}
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />

                {/* Animated Glow on Hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-1000">
                  <div className="absolute -inset-4 bg-gradient-to-r from-white/10 via-white/5 to-transparent rounded-[3rem] blur-3xl" />
                </div>

                {/* Content */}
                <div className="relative h-full min-h-[280px] sm:min-h-[320px] p-6 sm:p-8 flex flex-col">
                  <div className="flex-1 flex items-center justify-center py-6 sm:py-10">
                    <div className="relative w-full max-w-[240px] h-20 sm:h-24 lg:h-28">
                      <Image
                        src={getBrandLogo('Akrapovic')}
                        alt="Akrapovic"
                        fill
                        className={`object-contain drop-shadow-[0_0_60px_rgba(255,255,255,0.1)] transition-all duration-700 group-hover:scale-110 group-hover:drop-shadow-[0_0_80px_rgba(255,255,255,0.2)] ${shouldSmartInvertBrand('Akrapovic') ? 'filter invert hue-rotate-180' : shouldInvertBrand('Akrapovic') ? 'filter brightness-0 invert' : ''}`}
                        unoptimized
                      />
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-lg sm:text-xl font-light text-white tracking-tight">Akrapovic</p>
                      <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Вихлопні системи' : 'Exhaust systems'}</p>
                    </div>
                  </div>
                </div>
              </motion.button>

              {/* BRABUS - Tall Card */}
              <motion.button
                onClick={() => handleBrandClick('Brabus')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
              >
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />

                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                  <div className="absolute -inset-2 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] blur-2xl" />
                </div>

                <div className="relative h-full min-h-[280px] sm:min-h-[320px] p-6 sm:p-8 flex flex-col">
                  <div className="flex-1 flex items-center justify-center py-8">
                    <div className="relative w-full max-w-[220px] h-16 sm:h-20 lg:h-24">
                      <Image
                        src={getBrandLogo('Brabus')}
                        alt="Brabus"
                        fill
                        className={`object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-700 group-hover:scale-110 ${shouldInvertBrand('Brabus') ? 'filter brightness-0 invert' : ''}`}
                        unoptimized
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-lg sm:text-xl font-light text-white tracking-tight">BRABUS</p>
                    <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Преміум тюнінг' : 'Premium tuning'}</p>
                  </div>
                </div>
              </motion.button>

              {/* MANSORY - Wide Card */}
              <motion.button
                onClick={() => handleBrandClick('Mansory')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.15 }}
                className="group relative cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
              >
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />

                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                  <div className="absolute -inset-2 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] blur-2xl" />
                </div>

                <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[200px]">
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="relative w-full max-w-[220px] h-14 sm:h-18">
                      <Image
                        src={getBrandLogo('Mansory')}
                        alt="Mansory"
                        fill
                        className="object-contain opacity-95 drop-shadow-[0_0_25px_rgba(255,255,255,0.1)] transition-all duration-700 group-hover:scale-110"
                        unoptimized
                      />
                    </div>
                  </div>

                  <p className="text-lg sm:text-xl font-light text-white tracking-tight">Mansory</p>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Преміум тюнінг' : 'Premium tuning'}</p>
                </div>
              </motion.button>

              {/* HRE */}
              <motion.button
                onClick={() => handleBrandClick('HRE wheels')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
              >
                <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[180px]">
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="relative w-full max-w-[160px] h-16 sm:h-20">
                      <Image src={getBrandLogo('HRE wheels')} alt="HRE" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg sm:text-xl font-light text-white tracking-tight">HRE Wheels</p>
                      <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Преміум ковані диски' : 'Premium forged wheels'}</p>
                    </div>
                  </div>
                </div>
              </motion.button>

              {/* URBAN AUTOMOTIVE */}
              <motion.button
                onClick={() => handleBrandClick('Urban Automotive')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
              >
                <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[220px]">
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="relative w-full max-w-[180px] h-14 sm:h-18">
                      <Image src={getBrandLogo('Urban Automotive')} alt="Urban Automotive" fill className="object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                    </div>
                  </div>
                  <p className="text-lg sm:text-xl font-light text-white tracking-tight">Urban Automotive</p>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Преміум обвіси' : 'Premium body kits'}</p>
                </div>
              </motion.button>

              {/* EVENTURI */}
              <motion.button
                onClick={() => handleBrandClick('Eventuri')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
              >
                <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[220px]">
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="relative w-full max-w-[200px] h-16 sm:h-20">
                      <Image src={getBrandLogo('Eventuri')} alt="Eventuri" fill className="object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                    </div>
                  </div>
                  <p className="text-lg sm:text-xl font-light text-white tracking-tight">Eventuri</p>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Впускні системи' : 'Intake systems'}</p>
                </div>
              </motion.button>

              {/* KW */}
              <motion.button
                onClick={() => handleBrandClick('KW Suspension')}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.35 }}
                className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
              >
                <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[220px]">
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="relative w-full max-w-[160px] h-20 sm:h-24">
                      <Image src={getBrandLogo('KW Suspension')} alt="KW" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                    </div>
                  </div>
                  <p className="text-lg sm:text-xl font-light text-white tracking-tight">KW Suspensions</p>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Підвіска' : 'Suspension'}</p>
                </div>
              </motion.button>
              {/* NOVITEC & ABT - Split Row */}
              <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                {/* NOVITEC */}
                <motion.button
                  onClick={() => handleBrandClick('Novitec')}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.4 }}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
                >
                  <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />

                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                    <div className="absolute -inset-2 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] blur-2xl" />
                  </div>

                  <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[180px]">
                    <div className="flex-1 flex items-center justify-center py-4">
                      <div className="relative w-full max-w-[200px] h-16 sm:h-20">
                        <Image
                          src={getBrandLogo('Novitec')}
                          alt="Novitec"
                          fill
                          className="object-contain opacity-95 transition-all duration-700 group-hover:scale-110"
                          unoptimized
                        />
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-lg sm:text-xl font-light text-white tracking-tight">Novitec</p>
                        <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Суперкар тюнінг' : 'Supercar tuning'}</p>
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* ABT */}
                <motion.button
                  onClick={() => handleBrandClick('ABT')}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.45 }}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
                >
                  <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />

                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                    <div className="absolute -inset-2 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] blur-2xl" />
                  </div>

                  <div className="relative h-full p-6 sm:p-8 flex flex-col min-h-[180px]">
                    <div className="flex-1 flex items-center justify-center py-4">
                      <div className="relative w-full max-w-[160px] h-16 sm:h-20">
                        <Image
                          src={getBrandLogo('ABT')}
                          alt="ABT"
                          fill
                          className={`object-contain opacity-95 transition-all duration-700 group-hover:scale-110 ${shouldInvertBrand('ABT') ? 'filter brightness-0 invert' : ''}`}
                          unoptimized
                        />
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-lg sm:text-xl font-light text-white tracking-tight">ABT Sportsline</p>
                        <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Audi та VW тюнінг' : 'Audi & VW tuning'}</p>
                      </div>
                    </div>
                  </div>
                </motion.button>
              </div>
              {/* +160 BRANDS CTA */}
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="group relative sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
                onClick={() => {
                  const catalogSection = document.getElementById('brand-catalog');
                  catalogSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {/* Background */}
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />

                <div className="relative p-6 sm:p-8 lg:p-10">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
                    <div className="text-center lg:text-left">
                      <div className="flex items-baseline gap-3 justify-center lg:justify-start">
                        <span className={`font-extralight text-white ${typography.sectionHeading}`}>
                          {locale === 'ua' ? 'Всі бренди' : 'All brands'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/50">
                        {locale === 'ua' ? 'Повний каталог преміум автозапчастин та аксесуарів' : 'Complete catalog of premium auto parts & accessories'}
                      </p>
                    </div>

                    {/* CTA Button */}
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-white/40 group-hover:bg-white/20 group-hover:shadow-[0_0_50px_rgba(255,255,255,0.15)]">
                      <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </div>
                  </div>

                  {/* Infinite Scrolling Carousel */}
                  <div className="relative overflow-hidden">
                    {/* First row - scrolling left */}
                    <div className="flex gap-6 mb-4 animate-scroll-left">
                      {[...allAutomotiveBrands.slice(0, 20), ...allAutomotiveBrands.slice(0, 20)].map((brand, idx) => (
                        <button
                          key={`row1-${brand.name}-${idx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBrand(brand);
                          }}
                          className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                          <div className="relative w-full h-full">
                            <Image
                              src={getBrandLogo(brand.name)}
                              alt={brand.name}
                              fill
                              className={`object-contain ${shouldSmartInvertBrand(brand.name) || shouldInvertBrand(brand.name) ? 'opacity-95 hover:opacity-100' : 'opacity-70 hover:opacity-100'} transition-opacity ${shouldSmartInvertBrand(brand.name) ? 'filter invert hue-rotate-180' : shouldInvertBrand(brand.name) ? 'filter brightness-0 invert' : ''}`}
                              unoptimized
                            />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Second row - scrolling right */}
                    <div className="flex gap-6 animate-scroll-right">
                      {[...allAutomotiveBrands.slice(20, 40), ...allAutomotiveBrands.slice(20, 40)].map((brand, idx) => (
                        <button
                          key={`row2-${brand.name}-${idx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBrand(brand);
                          }}
                          className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                        >
                          <div className="relative w-full h-full">
                            <Image
                              src={getBrandLogo(brand.name)}
                              alt={brand.name}
                              fill
                              className={`object-contain ${shouldSmartInvertBrand(brand.name) || shouldInvertBrand(brand.name) ? 'opacity-95 hover:opacity-100' : 'opacity-70 hover:opacity-100'} transition-opacity ${shouldSmartInvertBrand(brand.name) ? 'filter invert hue-rotate-180' : shouldInvertBrand(brand.name) ? 'filter brightness-0 invert' : ''}`}
                              unoptimized
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
          <div className="relative mb-8 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm sm:mb-10 sm:p-12 md:mb-12 md:p-16">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50" />
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/70 sm:text-[11px] sm:tracking-[0.5em] md:text-[12px] md:tracking-[0.6em] font-medium">{t('productCategories')}</p>
              <h2 className={`mt-3 font-light text-white text-balance sm:mt-4 ${typography.sectionHeading}`}>
                {locale === 'ua' ? 'Модулі, які складають авто' : 'Modules we compose cars from'}
              </h2>
              <button
                onClick={() => setIsModulesOpen(!isModulesOpen)}
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-[0.15em] text-black shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all hover:bg-white/90 hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] active:scale-95"
              >
                <span>{isModulesOpen ? (locale === 'ua' ? 'Згорнути' : 'Collapse') : (locale === 'ua' ? 'Відкрити список' : 'Open list')}</span>
                <motion.div
                  animate={{ rotate: isModulesOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 10 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-black"
                  >
                    <path
                      d="M1 3L5 7L9 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              </button>
            </div>
          </div>
          <AnimatePresence>
            {isModulesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 auto-rows-fr pb-4">
                  {automotiveCategories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/${locale}/auto/categories/${cat.slug}`}
                      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white/10 border border-white/20 transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:translate-y-[-4px] sm:rounded-3xl h-full backdrop-blur-3xl"
                    >
                      {/* Multi-layer box shadows for depth */}
                      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] sm:rounded-3xl" />

                      {/* Bottom glow on hover */}
                      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                      <div className="relative p-6 sm:p-7 md:p-8 flex flex-col flex-1">
                        {/* Title & Description */}
                        <div className="min-h-[120px] sm:min-h-[140px]">
                          <h3 className="text-xl font-normal text-white text-balance sm:text-2xl tracking-wide">{locale === 'ua' ? cat.title.ua : cat.title.en}</h3>
                          <p className="mt-3 text-[13px] leading-relaxed text-white/80 text-pretty sm:text-[15px] font-light">{locale === 'ua' ? cat.description.ua : cat.description.en}</p>
                          <p className="mt-2 text-[11px] text-white/50 text-pretty sm:text-xs">{locale === 'ua' ? cat.spotlight.ua : cat.spotlight.en}</p>
                        </div>

                        {/* Brand tags with relief */}
                        <div className="mt-5 min-h-[80px] grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider content-start sm:text-[11px]">
                          {cat.brands.map((name) => (
                            <span key={name} className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center font-medium text-white/90 transition-colors duration-200 group-hover:border-white/20 group-hover:bg-white/10">
                              {name}
                            </span>
                          ))}
                        </div>

                        {/* Open button - clear affordance */}
                        <div className="mt-auto pt-6 flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white transition-all duration-300 group-hover:gap-3 group-hover:text-white">
                            {locale === 'ua' ? 'Відкрити' : 'Open'}
                            <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">{cat.brands.length} брендів</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>



        <section id="brand-catalog" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
          <div className="mb-8 text-center sm:mb-10 md:mb-12">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{locale === 'ua' ? 'Каталог' : 'Atlas'}</p>
            <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>{t('allBrands')}</h2>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="relative w-full max-w-3xl">
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-gradient-to-r from-white/10 to-white/[0.02] px-6 py-3 text-base text-white placeholder-white/40 shadow-[0_0_40px_rgba(255,255,255,0.07)] focus:outline-none focus:ring-2 focus:ring-white/40 sm:rounded-3xl sm:px-8 sm:py-3.5 sm:text-lg md:px-10 md:py-4"
              />
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/40 sm:right-6 md:right-8">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Alphabet Filter */}
            <div className="flex flex-wrap justify-center gap-2 px-4">
              <button
                onClick={() => setActiveLetter(null)}
                className={`h-8 w-8 rounded-full text-xs font-medium transition-all ${activeLetter === null
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
              >
                ALL
              </button>
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                  className={`h-8 w-8 rounded-full text-xs font-medium transition-all ${activeLetter === letter
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => setIsBrandsOpen(!isBrandsOpen)}
                className="inline-flex items-center gap-3 rounded-full bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-[0.15em] text-black shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all hover:bg-white/90 hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] active:scale-95"
              >
                <span>{isBrandsOpen ? (locale === 'ua' ? 'Згорнути' : 'Collapse') : (locale === 'ua' ? 'Відкрити список' : 'Open list')}</span>
                <motion.div
                  animate={{ rotate: isBrandsOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 10 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-black"
                  >
                    <path
                      d="M1 3L5 7L9 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              </button>

              {/* Scroll Down Arrow */}
              <button
                onClick={() => {
                  if (!isBrandsOpen) setIsBrandsOpen(true);
                  setTimeout(() => {
                    document.getElementById('brand-list-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="animate-bounce p-2 text-white/30 hover:text-white transition-colors"
                aria-label="Scroll to brands"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isBrandsOpen && (
              <motion.div
                id="brand-list-container"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:mt-12 xl:grid-cols-4 pb-4">
                  {filteredBrands.length > 0 ? (
                    filteredBrands.map((brand) => {
                      const origin = getBrandOrigin(brand);
                      const subcategory = getBrandSubcategory(brand);
                      const collections = getBrandCollections(brand.name);
                      const logoSrc = getBrandLogo(brand.name);

                      return (
                        <motion.button
                          key={brand.name}
                          onClick={() => setSelectedBrand(brand)}
                          whileHover={{ y: -6 }}
                          className="group relative flex flex-col items-center text-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-4 transition backdrop-blur-3xl shadow-sm hover:bg-white/20 hover:border-white/30 hover:shadow-md sm:rounded-3xl sm:p-5 md:p-6"
                        >
                          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{
                            background:
                              'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 60%)',
                          }} />
                          <div className="relative w-full flex items-center justify-center text-[10px] uppercase tracking-[0.25em] text-white/50 sm:text-xs sm:tracking-[0.3em]">
                            <div className="flex items-center gap-2">
                              <span>{origin}</span>
                            </div>
                          </div>
                          <div className="relative mt-4 h-20 w-full sm:mt-6 sm:h-24">
                            <div className="relative w-full h-full">
                              <Image
                                src={logoSrc}
                                alt={brand.name}
                                fill
                                className={`object-contain object-center ${shouldInvertBrand(brand.name) ? 'filter brightness-0 invert' : ''}`}
                                sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 20vw"
                                unoptimized
                              />
                            </div>
                          </div>
                          <div className="mt-4 text-lg font-light leading-tight text-white sm:mt-6 sm:text-xl w-full px-1 break-words">{brand.name}</div>
                        </motion.button>
                      );
                    })
                  ) : (
                    <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-xl text-white/70">
                      {t('noBrands')}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <BrandModal
          brand={selectedBrand ? {
            name: selectedBrand.name,
            logoSrc: getBrandLogo(selectedBrand.name),
            description: selectedBrandStory?.description[locale],
            headline: selectedBrandStory?.headline?.[locale],
            highlights: selectedBrandStory?.highlights?.map(h => h[locale]),
            website: selectedBrand.website
          } : null}
          isOpen={!!selectedBrand}
          onClose={() => setSelectedBrand(null)}
        />

        <div className="pb-10" />
      </div>
    </div>
  );
}
