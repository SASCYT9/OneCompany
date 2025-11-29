// src/app/[locale]/moto/categories/moto-exhaust/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';

type Locale = 'en' | 'ua';

const exhaustBrands = [
  {
    name: 'Akrapovič',
    country: '🇸🇮 Slovenia',
    specialty: { en: 'MotoGP Partner', ua: 'Партнер MotoGP' },
    description: {
      en: 'Official MotoGP and WorldSBK partner. Full titanium systems, slip-ons and Evolution Line with EC approval.',
      ua: 'Офіційний партнер MotoGP та WorldSBK. Повні титанові системи, slip-on та Evolution Line з EC-сертифікацією.',
    },
    featured: true,
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'SC-Project',
    country: '🇮🇹 Italy',
    specialty: { en: 'Race Exhaust', ua: 'Гоночний вихлоп' },
    description: {
      en: 'Italian race exhaust manufacturer. CR-T, S1, GP70-R and MotoGP replica systems with distinctive sound.',
      ua: 'Італійський виробник гоночних вихлопів. Системи CR-T, S1, GP70-R та MotoGP репліки з характерним звуком.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Termignoni',
    country: '🇮🇹 Italy',
    specialty: { en: 'Ducati Official', ua: 'Офіційний Ducati' },
    description: {
      en: 'Official Ducati racing partner. Titanium and carbon systems developed with Ducati Corse for maximum performance.',
      ua: 'Офіційний гоночний партнер Ducati. Титанові та карбонові системи, розроблені з Ducati Corse для максимальної продуктивності.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Arrow',
    country: '🇮🇹 Italy',
    specialty: { en: 'Multi-Brand', ua: 'Мульти-бренд' },
    description: {
      en: 'Italian exhaust specialist with wide model coverage. Competition, Race-Tech and Thunder lines for all segments.',
      ua: 'Італійський спеціаліст вихлопів з широким покриттям моделей. Лінійки Competition, Race-Tech та Thunder для всіх сегментів.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Austin Racing',
    country: '🇬🇧 UK',
    specialty: { en: 'GP-Style', ua: 'GP-стиль' },
    description: {
      en: 'British manufacturer known for aggressive GP-style exhaust systems with distinctive demonic sound.',
      ua: 'Британський виробник, відомий агресивними GP-style системами з характерним "демонічним" звуком.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Yoshimura',
    country: '🇯🇵 Japan',
    specialty: { en: 'JDM Legend', ua: 'JDM легенда' },
    description: {
      en: 'Japanese racing legend with 70+ years of history. Alpha T, R-77 and RS-series for street and track.',
      ua: 'Японська гоночна легенда з 70+ роками історії. Alpha T, R-77 та RS-серії для вулиці та треку.',
    },
    accentColor: 'from-rose-500/30 to-pink-500/20',
  },
  {
    name: 'Leo Vince',
    country: '🇮🇹 Italy',
    specialty: { en: 'Street & Race', ua: 'Вулиця та трек' },
    description: {
      en: 'Italian brand with street-legal and racing exhausts. LV-10, Factory S and Nero lines.',
      ua: 'Італійський бренд з вуличними та гоночними вихлопами. Лінійки LV-10, Factory S та Nero.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'MIVV',
    country: '🇮🇹 Italy',
    specialty: { en: 'Italian Design', ua: 'Італійський дизайн' },
    description: {
      en: 'Italian exhaust manufacturer with Delta Race, Suono and GP Pro lines for sport and touring bikes.',
      ua: 'Італійський виробник вихлопів з лінійками Delta Race, Suono та GP Pro для спортбайків та туристів.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
];

const exhaustTypes = [
  {
    name: { en: 'Full Titanium Systems', ua: 'Повні титанові системи' },
    description: {
      en: 'Complete exhaust from headers to muffler in aerospace-grade titanium for maximum weight savings.',
      ua: 'Повний вихлоп від колекторів до глушника з аерокосмічного титану для максимального зниження ваги.',
    },
    icon: '🏆',
  },
  {
    name: { en: 'Slip-On Mufflers', ua: 'Slip-On глушники' },
    description: {
      en: 'Bolt-on replacement mufflers that retain factory headers for quick installation and improved sound.',
      ua: 'Глушники на заміну заводських з простим монтажем для швидкого встановлення та покращеного звуку.',
    },
    icon: '🔧',
  },
  {
    name: { en: 'Race Headers', ua: 'Гоночні колектори' },
    description: {
      en: 'High-flow racing headers without catalysts for track-only use and maximum power gains.',
      ua: 'Високопропускні гоночні колектори без каталізаторів для треку та максимального приросту потужності.',
    },
    icon: '🔥',
  },
  {
    name: { en: 'Carbon Fiber Cans', ua: 'Карбонові глушники' },
    description: {
      en: 'Lightweight carbon fiber muffler bodies for heat resistance and aggressive styling.',
      ua: 'Легкі карбонові корпуси глушників для термостійкості та агресивного стайлінгу.',
    },
    icon: '⚫',
  },
  {
    name: { en: 'EC-Approved', ua: 'EC-сертифіковані' },
    description: {
      en: 'Street-legal systems with European type approval for daily riding and touring.',
      ua: 'Вуличні системи з європейською сертифікацією для щоденної їзди та туризму.',
    },
    icon: '✅',
  },
  {
    name: { en: 'MotoGP Replicas', ua: 'MotoGP репліки' },
    description: {
      en: 'Exact replica systems used by factory MotoGP teams for the ultimate exhaust experience.',
      ua: 'Точні репліки систем заводських команд MotoGP для найкращого вихлопного досвіду.',
    },
    icon: '🏁',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Titanium', ua: 'Титан' },
    description: { en: '40-50% lighter than steel, extreme heat resistance, signature blue hue', ua: 'На 40-50% легше сталі, екстремальна термостійкість, фірмовий синій відтінок' },
    color: 'from-blue-400 to-purple-500',
  },
  {
    name: { en: 'Inconel', ua: 'Інконель' },
    description: { en: 'MotoGP-grade superalloy for 1000°C+ tolerance', ua: 'MotoGP суперсплав для температур 1000°C+' },
    color: 'from-orange-400 to-red-500',
  },
  {
    name: { en: 'Stainless Steel', ua: 'Нержавіюча сталь' },
    description: { en: 'Durable, corrosion resistant, classic sound', ua: 'Довговічна, корозійностійка, класичний звук' },
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: { en: 'Carbon Fiber', ua: 'Карбон' },
    description: { en: 'Lightweight muffler cans and heat shields', ua: 'Легкі глушники та теплозахисні елементи' },
    color: 'from-gray-800 to-black',
  },
];

export default function MotoExhaustCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof exhaustBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Moto Category', ua: 'Мото категорія' },
      title: { en: 'Exhaust & Sound', ua: 'Вихлоп та звук' },
      subtitle: {
        en: 'Full titanium systems, slip-ons and race-only exhausts with FIM homologation and dyno-verified power gains. Designed for WorldSBK, MotoGP and track day domination.',
        ua: 'Повні титанові системи, slip-on та трекові вихлопи з FIM-гомологацією та підтвердженим приростом потужності. Розроблені для WorldSBK, MotoGP та перемог на треку.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-black to-indigo-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-blue-400/80 sm:text-xs">
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
            {exhaustTypes.map((type, i) => (
              <motion.div
                key={type.name.en}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="text-3xl mb-4">{type.icon}</div>
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
            {exhaustBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Готові до нового звуку?' : 'Ready for new sound?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо вибору вихлопної системи для вашого мотоцикла.'
                : 'Contact us for a consultation on exhaust system selection for your motorcycle.'}
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
