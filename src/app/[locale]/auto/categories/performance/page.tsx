// src/app/[locale]/auto/categories/performance/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { ECUIcon, TurboIcon, EngineIcon, IntercoolerIcon, ExhaustSystemIcon, AirFilterIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const performanceBrands = [
  {
    name: 'HKS',
    country: '🇯🇵 Japan',
    specialty: { en: 'JDM Tuning', ua: 'JDM тюнінг' },
    description: {
      en: 'Japanese performance legends. Turbo kits, ECU tuning, blow-off valves and complete engine packages.',
      ua: 'Японські легенди продуктивності. Турбо кіти, ECU тюнінг, blow-off клапани та комплексні пакети двигуна.',
    },
    featured: true,
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Weistec',
    country: '🇺🇸 USA',
    specialty: { en: 'AMG Specialist', ua: 'Спеціаліст AMG' },
    description: {
      en: 'Mercedes-AMG performance specialists with supercharger kits, turbo upgrades and complete packages.',
      ua: 'Спеціалісти продуктивності Mercedes-AMG з компресорними кітами, турбо апгрейдами та комплексними пакетами.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'RennTech',
    country: '🇺🇸 USA',
    specialty: { en: 'Mercedes Power', ua: 'Mercedes потужність' },
    description: {
      en: 'Florida-based Mercedes tuner with 30+ years of experience in AMG power upgrades and suspension.',
      ua: 'Флоридський тюнер Mercedes з 30+ роками досвіду в апгрейдах потужності AMG та підвіски.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Dinan',
    country: '🇺🇸 USA',
    specialty: { en: 'BMW Performance', ua: 'BMW продуктивність' },
    description: {
      en: 'The most respected name in BMW tuning. ECU calibrations, intake, exhaust and suspension upgrades.',
      ua: 'Найповажніше ім\'я в тюнінгу BMW. ECU калібрування, впуск, випуск та апгрейди підвіски.',
    },
    accentColor: 'from-blue-500/30 to-indigo-500/20',
  },
  {
    name: 'Unitronic',
    country: '🇺🇸 USA',
    specialty: { en: 'VAG Tuning', ua: 'VAG тюнінг' },
    description: {
      en: 'Premium VAG tuning solutions. ECU and DSG calibrations, intakes, downpipes and turbo upgrades.',
      ua: 'Преміальні VAG тюнінг рішення. ECU та DSG калібрування, впуски, даунпайпи та турбо апгрейди.',
    },
    accentColor: 'from-purple-500/30 to-violet-500/20',
  },
  {
    name: 'APR',
    country: '🇺🇸 USA',
    specialty: { en: 'VAG Power', ua: 'VAG потужність' },
    description: {
      en: 'World leader in Volkswagen, Audi and Porsche performance. ECU tunes, turbos and hardware upgrades.',
      ua: 'Світовий лідер продуктивності Volkswagen, Audi та Porsche. ECU прошивки, турбо та хардвер апгрейди.',
    },
    accentColor: 'from-red-500/30 to-orange-500/20',
  },
  {
    name: 'Garrett',
    country: '🇺🇸 USA',
    specialty: { en: 'Turbochargers', ua: 'Турбокомпресори' },
    description: {
      en: 'Global leader in turbocharger technology. GT series, G series and PowerMax OEM upgrades.',
      ua: 'Глобальний лідер турбокомпресорних технологій. Серії GT, G та PowerMax OEM апгрейди.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'BorgWarner',
    country: '🇺🇸 USA',
    specialty: { en: 'OEM Turbos', ua: 'OEM турбіни' },
    description: {
      en: 'OEM turbo supplier with EFR and S-series performance turbos for aftermarket applications.',
      ua: 'OEM постачальник турбін з EFR та S-серіями performance турбін для aftermarket застосувань.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Precision Turbo',
    country: '🇺🇸 USA',
    specialty: { en: 'High Power', ua: 'Висока потужність' },
    description: {
      en: 'American turbo manufacturer for high horsepower builds. GEN2 and Pro Mod series turbos.',
      ua: 'Американський виробник турбін для високопотужних білдів. Турбіни серій GEN2 та Pro Mod.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'AEM',
    country: '🇺🇸 USA',
    specialty: { en: 'Engine Management', ua: 'Управління двигуном' },
    description: {
      en: 'Infinity ECU standalone management, wideband O2 sensors, gauges and data acquisition systems.',
      ua: 'Standalone ECU Infinity, широкосмугові O2 датчики, прилади та системи збору даних.',
    },
    accentColor: 'from-yellow-500/30 to-amber-500/20',
  },
  {
    name: 'Haltech',
    country: '🇦🇺 Australia',
    specialty: { en: 'Standalone ECU', ua: 'Standalone ECU' },
    description: {
      en: 'Australian ECU manufacturer. Elite, Nexus and IC-7 products for complete engine management.',
      ua: 'Австралійський виробник ECU. Продукти Elite, Nexus та IC-7 для комплексного управління двигуном.',
    },
    accentColor: 'from-rose-500/30 to-pink-500/20',
  },
  {
    name: 'MoTeC',
    country: '🇦🇺 Australia',
    specialty: { en: 'Pro Motorsport', ua: 'Про мотоспорт' },
    description: {
      en: 'Professional motorsport electronics. M1 ECU platform, C1 dash displays and data logging systems.',
      ua: 'Професійна мотоспорт електроніка. Платформа M1 ECU, дисплеї C1 та системи логування даних.',
    },
    accentColor: 'from-indigo-500/30 to-violet-500/20',
  },
];

const performanceTypes = [
  {
    name: { en: 'ECU Tuning', ua: 'ECU тюнінг' },
    description: {
      en: 'Software calibrations for enhanced power, torque curves and throttle response.',
      ua: 'Програмні калібрування для збільшеної потужності, кривих крутного моменту та відгуку дроселя.',
    },
    icon: ECUIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Turbo Upgrades', ua: 'Турбо апгрейди' },
    description: {
      en: 'Hybrid turbos, turbo kits and complete forced induction solutions.',
      ua: 'Гібридні турбіни, турбо кіти та комплексні рішення примусової індукції.',
    },
    icon: TurboIcon,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Superchargers', ua: 'Компресори' },
    description: {
      en: 'Centrifugal and positive displacement supercharger systems for instant power.',
      ua: 'Центробіжні та роторні компресорні системи для миттєвої потужності.',
    },
    icon: EngineIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Engine Internals', ua: 'Внутрішні компоненти' },
    description: {
      en: 'Forged pistons, rods, crankshafts and valve train upgrades for high power builds.',
      ua: 'Ковані поршні, шатуни, колінвали та апгрейди клапанного механізму для потужних білдів.',
    },
    icon: IntercoolerIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Fuel Systems', ua: 'Паливні системи' },
    description: {
      en: 'High-flow injectors, fuel pumps, rails and flex fuel systems.',
      ua: 'Високопропускні форсунки, паливні насоси, рейки та flex fuel системи.',
    },
    icon: ExhaustSystemIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Data & Gauges', ua: 'Дані та прилади' },
    description: {
      en: 'Wideband O2, boost gauges, data loggers and dash displays.',
      ua: 'Широкосмугові O2, буст-датчики, логери даних та дисплеї.',
    },
    icon: AirFilterIcon,
    color: 'text-emerald-400',
  },
];

export default function PerformanceCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof performanceBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Performance', ua: 'Продуктивність' },
      subtitle: {
        en: 'ECU tuning, turbo upgrades, superchargers and engine internals from world-class manufacturers. Unlock your vehicle\'s true potential.',
        ua: 'ECU тюнінг, турбо апгрейди, компресори та внутрішні компоненти двигуна від світових виробників. Розкрийте справжній потенціал вашого авто.',
      },
    },
    sections: {
      brands: { en: 'Featured Brands', ua: 'Провідні бренди' },
      types: { en: 'Performance Categories', ua: 'Категорії продуктивності' },
      cta: { en: 'Request Quote', ua: 'Запросити ціну' },
    },
    back: { en: '← Back to Auto', ua: '← Назад до Авто' },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent" />
        
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 md:py-28">
          <Link 
            href={`/${locale}/auto`}
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

      {/* Performance Types Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.types[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {performanceTypes.map((type, i) => (
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
            {performanceBrands.map((brand, i) => (
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
                  <div className="flex items-center mb-4">
                    <span className="text-xs text-white/50">{brand.country}</span>
                  </div>
                  
                  <div className="relative h-16 mb-4">
                    {/* Radial backlight for dark logos - intensified */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[80%] h-[100%] bg-[radial-gradient(ellipse,_rgba(255,255,255,0.3)_0%,_rgba(255,255,255,0.1)_40%,_transparent_70%)] group-hover:bg-[radial-gradient(ellipse,_rgba(255,255,255,0.4)_0%,_rgba(255,255,255,0.15)_40%,_transparent_70%)] transition-all duration-500" />
                    </div>
                    <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.3))' }}>
                      <Image
                        src={getBrandLogo(brand.name)}
                        alt={brand.name}
                        fill
                        className={`object-contain object-center transition-all duration-300 group-hover:scale-110 ${
                          isDarkLogo(getBrandLogo(brand.name)) ? 'invert hue-rotate-180 mix-blend-screen' : ''
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
              {locale === 'ua' ? 'Готові до потужності?' : 'Ready for power?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо performance апгрейдів для вашого автомобіля.'
                : 'Contact us for a consultation on performance upgrades for your vehicle.'}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={`/${locale}/contact`}
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {content.sections.cta[locale]}
              </Link>
              <Link
                href={`/${locale}/auto`}
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
