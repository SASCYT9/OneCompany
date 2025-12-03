// src/app/[locale]/moto/categories/moto-controls/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { TireIcon, WheelIcon, SteeringWheelIcon, ECUIcon, SeatIcon, CaliperIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const controlsBrands = [
  {
    name: 'CNC Racing',
    country: '🇮🇹 Italy',
    specialty: { en: 'Billet Controls', ua: 'Білетні контролі' },
    description: {
      en: 'Italian CNC specialist for Ducati, MV Agusta and Aprilia. Rearsets, clip-ons, levers and billet accessories.',
      ua: 'Італійський CNC спеціаліст для Ducati, MV Agusta та Aprilia. Підніжки, кліпони, важелі та білетні аксесуари.',
    },
    featured: true,
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Gilles Tooling',
    country: '🇱🇺 Luxembourg',
    specialty: { en: 'Premium Rearsets', ua: 'Преміум підніжки' },
    description: {
      en: 'Luxembourg-based premium controls manufacturer. IP, VCR and RCT rearsets with multiple adjustment options.',
      ua: 'Люксембурзький преміум виробник контролів. Підніжки IP, VCR та RCT з багатьма опціями регулювання.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Rizoma',
    country: '🇮🇹 Italy',
    specialty: { en: 'Italian Design', ua: 'Італійський дизайн' },
    description: {
      en: 'Italian design house with premium billet controls. Mirrors, levers, grips, pegs and bar-ends.',
      ua: 'Італійський дизайн-хаус з преміальними білетними контролями. Дзеркала, важелі, грипси, підніжки та баренди.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'Lightech',
    country: '🇮🇹 Italy',
    specialty: { en: 'Track Parts', ua: 'Трекові деталі' },
    description: {
      en: 'Italian race parts specialist. Adjustable rearsets, chain adjusters, fork preload caps and accessories.',
      ua: 'Італійський спеціаліст гоночних деталей. Регульовані підніжки, регулятори ланцюга, кришки вилки та аксесуари.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'ValterMoto',
    country: '🇮🇹 Italy',
    specialty: { en: 'Race Components', ua: 'Гоночні компоненти' },
    description: {
      en: 'Italian race component manufacturer. Type 1, 2, 3 rearsets and crash protection for track use.',
      ua: 'Італійський виробник гоночних компонентів. Підніжки Type 1, 2, 3 та захист від падінь для треку.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'Sato Racing',
    country: '🇯🇵 Japan',
    specialty: { en: 'JDM Precision', ua: 'JDM точність' },
    description: {
      en: 'Japanese precision parts manufacturer. Rearsets, frame sliders, swingarm spools and brake levers.',
      ua: 'Японський виробник точних деталей. Підніжки, слайдери рами, шпулі маятника та гальмівні важелі.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Woodcraft',
    country: '🇺🇸 USA',
    specialty: { en: 'American Race', ua: 'Американські гонки' },
    description: {
      en: 'American racing parts manufacturer. Rearsets, clip-ons, case covers and protective components.',
      ua: 'Американський виробник гоночних деталей. Підніжки, кліпони, кришки двигуна та захисні компоненти.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Accossato',
    country: '🇮🇹 Italy',
    specialty: { en: 'Brake Controls', ua: 'Гальмівні контролі' },
    description: {
      en: 'Italian brake specialist with radial master cylinders, folding levers and brake/clutch controls.',
      ua: 'Італійський спеціаліст гальм з радіальними циліндрами, складними важелями та контролями гальма/зчеплення.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
];

const controlTypes = [
  {
    name: { en: 'Rearsets', ua: 'Підніжки' },
    description: {
      en: 'Adjustable rider foot pegs with multiple position options for aggressive or comfortable riding positions.',
      ua: 'Регульовані підніжки райдера з багатьма позиціями для агресивної або комфортної посадки.',
    },
    icon: TireIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Clip-Ons', ua: 'Кліпони' },
    description: {
      en: 'Replacement handlebars that mount below triple clamps for sportbike ergonomics.',
      ua: 'Кермові кріплення, що монтуються під траверсами для спортбайкової ергономіки.',
    },
    icon: WheelIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Brake Levers', ua: 'Гальмівні важелі' },
    description: {
      en: 'Adjustable and folding brake levers with reach adjustment for precise finger placement.',
      ua: 'Регульовані та складні гальмівні важелі з налаштуванням вильоту для точного розташування пальців.',
    },
    icon: SteeringWheelIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Quick-Shifters', ua: 'Квікшифтери' },
    description: {
      en: 'Electronic shift sensors for clutchless upshifts and downshifts on track and street.',
      ua: 'Електронні датчики перемикання для беззчепленнєвих перемикань вгору та вниз на треку та вулиці.',
    },
    icon: ECUIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Grips & Bar Ends', ua: 'Грипси та баренди' },
    description: {
      en: 'Replacement grips and weighted bar-ends for vibration reduction and style.',
      ua: 'Замінні грипси та баренди з важелями для зменшення вібрації та стилю.',
    },
    icon: SeatIcon,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Triple Clamps', ua: 'Траверси' },
    description: {
      en: 'Billet aluminum triple clamps with adjustable offset and reduced flex.',
      ua: 'Білетні алюмінієві траверси з регульованим офсетом та зменшеним прогином.',
    },
    icon: CaliperIcon,
    color: 'text-orange-400',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Billet Aluminum', ua: 'Білетний алюміній' },
    description: { en: 'CNC-machined 7075-T6 for rearsets and levers', ua: 'CNC-оброблений 7075-T6 для підніжок та важелів' },
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: { en: 'Titanium', ua: 'Титан' },
    description: { en: 'Lightweight titanium hardware and fasteners', ua: 'Легкий титановий кріпіж' },
    color: 'from-blue-400 to-purple-500',
  },
  {
    name: { en: 'Stainless Steel', ua: 'Нержавіюча сталь' },
    description: { en: 'Pivots, bushings and bearing surfaces', ua: 'Шарніри, втулки та підшипникові поверхні' },
    color: 'from-gray-500 to-gray-700',
  },
  {
    name: { en: 'Rubber Compounds', ua: 'Гумові компаунди' },
    description: { en: 'Track-spec grip compounds for pegs and grips', ua: 'Трекові компаунди для підніжок та грипсів' },
    color: 'from-emerald-400 to-teal-500',
  },
];

export default function MotoControlsCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof controlsBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Moto Category', ua: 'Мото категорія' },
      title: { en: 'Controls & Ergonomics', ua: 'Керування та ергономіка' },
      subtitle: {
        en: 'Adjustable rearsets, clip-ons, billet levers and quick-shifters for precise rider interface. CNC-machined with multiple position options for track ergonomics.',
        ua: 'Регульовані підніжки, кліпони, білетні важелі та квікшифтери для точного інтерфейсу райдера. CNC-оброблені з кількома позиціями для трекової ергономіки.',
      },
    },
    sections: {
      brands: { en: 'Featured Brands', ua: 'Провідні бренди' },
      types: { en: 'Product Types', ua: 'Типи продуктів' },
      materials: { en: 'Materials', ua: 'Матеріали' },
      cta: { en: 'Request Quote', ua: 'Запросити ціну' },
    },
    back: { en: '← Back to Moto', ua: '← Назад до Мото' },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent" />
        
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-28">
          <Link 
            href={`/${locale}/moto`}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
          >
            {content.back[locale]}
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-red-400/80 sm:text-xs">
              {content.hero.eyebrow[locale]}
            </p>
            <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {content.hero.title[locale]}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/70 sm:text-xl">
              {content.hero.subtitle[locale]}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Materials Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.materials[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {materials.map((material, i) => (
              <motion.div
                key={material.name.en}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-all duration-300"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${material.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                <div className="relative">
                  <h3 className="text-lg font-medium text-white">{material.name[locale]}</h3>
                  <p className="mt-2 text-sm text-white/60">{material.description[locale]}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Types Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.types[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {controlTypes.map((type, i) => (
              <motion.div
                key={type.name.en}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className={`mb-4 ${type.color}`}>
                  <type.icon className="w-8 h-8 stroke-[1.5]" />
                </div>
                <h3 className="text-lg font-medium text-white">{type.name[locale]}</h3>
                <p className="mt-2 text-sm text-white/60">{type.description[locale]}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Brands Grid Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.brands[locale]}
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {controlsBrands.map((brand, i) => (
              <motion.button
                key={brand.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                onClick={() => setSelectedBrand(brand)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 p-6 text-left transition-all duration-300 hover:border-white/20"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${brand.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-white/50">{brand.country}</span>
                    <span className="text-xs text-white/50 uppercase tracking-wider">{brand.specialty[locale]}</span>
                  </div>
                  
                  <div className="relative h-16 mb-4">
                    {/* Radial backlight for dark logos */}
                    <div className="absolute inset-0 flex items-center justify-start pointer-events-none">
                      <div className="w-[80%] h-[100%] bg-[radial-gradient(ellipse,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0.04)_40%,_transparent_70%)] group-hover:bg-[radial-gradient(ellipse,_rgba(255,255,255,0.18)_0%,_rgba(255,255,255,0.08)_40%,_transparent_70%)] transition-all duration-500" />
                    </div>
                    <div className="relative" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
                      <Image
                        src={getBrandLogo(brand.name)}
                        alt={brand.name}
                        fill
                        className={`object-contain object-left transition-all duration-300 group-hover:scale-105 ${
                          isDarkLogo(getBrandLogo(brand.name)) ? 'brightness-0 invert' : ''
                        }`}
                        unoptimized
                      />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-light text-white mb-2">{brand.name}</h3>
                  <p className="text-sm text-white/60 line-clamp-2">{brand.description[locale]}</p>
                  
                  <div className="mt-4 flex items-center text-xs text-white/40 group-hover:text-white/70 transition-colors">
                    <span>{locale === 'ua' ? 'Детальніше' : 'Learn more'}</span>
                    <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-light sm:text-3xl md:text-4xl">
              {locale === 'ua' ? 'Потрібна ідеальна ергономіка?' : 'Need perfect ergonomics?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо підбору контролів під ваш стиль їзди.'
                : 'Contact us for a consultation on controls selection for your riding style.'}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={`/${locale}/contact`}
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {content.sections.cta[locale]}
              </Link>
              <Link
                href={`/${locale}/moto`}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                {locale === 'ua' ? 'Всі категорії' : 'All categories'}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Brand Modal */}
      <AnimatePresence>
        {selectedBrand && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedBrand(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-6 sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedBrand(null)}
                className="absolute right-4 top-4 text-white/50 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
                <span>{selectedBrand.country}</span>
                <span>•</span>
                <span className="uppercase tracking-wider">{selectedBrand.specialty[locale]}</span>
              </div>
              
              <div className="relative h-20 mb-6">
                <Image
                  src={getBrandLogo(selectedBrand.name)}
                  alt={selectedBrand.name}
                  fill
                  className={`object-contain object-left ${
                    isDarkLogo(getBrandLogo(selectedBrand.name)) ? 'brightness-0 invert' : ''
                  }`}
                  unoptimized
                />
              </div>
              
              <h3 className="text-2xl font-light text-white mb-4">{selectedBrand.name}</h3>
              <p className="text-white/70 mb-6">{selectedBrand.description[locale]}</p>
              
              <div className="flex gap-3">
                <Link
                  href={`/${locale}/contact`}
                  className="flex-1 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  {locale === 'ua' ? 'Запросити ціну' : 'Request Quote'}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
