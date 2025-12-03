// src/app/[locale]/moto/categories/moto-electronics/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { ECUIcon, IntercoolerIcon, TurboIcon, WaterPumpIcon, EngineIcon, ExhaustSystemIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const electronicsBrands = [
  {
    name: 'Starlane',
    country: '🇮🇹 Italy',
    specialty: { en: 'Data Acquisition', ua: 'Збір даних' },
    description: {
      en: 'Italian data acquisition specialist. Davinci II, Corsaro and Athon dashboards with GPS lap timing and telemetry.',
      ua: 'Італійський спеціаліст зі збору даних. Приладові панелі Davinci II, Corsaro та Athon з GPS хронометражем та телеметрією.',
    },
    featured: true,
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'AIM Sports',
    country: '🇮🇹 Italy',
    specialty: { en: 'Racing Dashboards', ua: 'Гоночні панелі' },
    description: {
      en: 'Italian motorsport electronics leader. MXS, MXG and Solo 2 DL dashboards with comprehensive data logging.',
      ua: 'Італійський лідер електроніки в мотоспорті. Панелі MXS, MXG та Solo 2 DL з повним записом даних.',
    },
    accentColor: 'from-red-500/30 to-orange-500/20',
  },
  {
    name: 'Dynojet',
    country: '🇺🇸 USA',
    specialty: { en: 'ECU Tuning', ua: 'ECU тюнінг' },
    description: {
      en: 'American tuning specialist. Power Commander, AutoTune and Power Vision for comprehensive fuel and ignition mapping.',
      ua: 'Американський спеціаліст тюнінгу. Power Commander, AutoTune та Power Vision для повного налаштування паливних та запальних карт.',
    },
    accentColor: 'from-green-500/30 to-emerald-500/20',
  },
  {
    name: 'Bazzaz',
    country: '🇺🇸 USA',
    specialty: { en: 'Fuel Controllers', ua: 'Паливні контролери' },
    description: {
      en: 'American fuel controller specialist. Z-Fi and Z-AFM systems for precise fueling adjustments and self-tuning.',
      ua: 'Американський спеціаліст паливних контролерів. Системи Z-Fi та Z-AFM для точного налаштування паливоподачі та автотюнінгу.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'RapidBike',
    country: '🇮🇹 Italy',
    specialty: { en: 'Italian ECU Tuning', ua: 'Італійський ECU тюнінг' },
    description: {
      en: 'Italian ECU tuning specialist. Easy, Racing and Evo modules for complete engine management control.',
      ua: 'Італійський спеціаліст ECU тюнінгу. Модулі Easy, Racing та Evo для повного контролю управління двигуном.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Woolich Racing',
    country: '🇦🇺 Australia',
    specialty: { en: 'ECU Flashing', ua: 'Прошивка ECU' },
    description: {
      en: 'Australian ECU flash specialist. Denso and Mitsubishi ECU flashing with log box data acquisition.',
      ua: 'Австралійський спеціаліст прошивки ECU. Прошивка ECU Denso та Mitsubishi зі збором даних Log Box.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Cordona',
    country: '🇸🇪 Sweden',
    specialty: { en: 'Quick-Shifters', ua: 'Квікшифтери' },
    description: {
      en: 'Swedish quick-shifter specialist. Precisione, Intelligente and GP ASG systems for all motorcycle types.',
      ua: 'Шведський спеціаліст квікшифтерів. Системи Precisione, Intelligente та GP ASG для всіх типів мотоциклів.',
    },
    accentColor: 'from-indigo-500/30 to-violet-500/20',
  },
  {
    name: 'Translogic',
    country: '🇬🇧 UK',
    specialty: { en: 'Shift Electronics', ua: 'Електроніка перемикань' },
    description: {
      en: 'British quick-shifter manufacturer. Intellishift systems with paddock stand wiring and plug-and-play kits.',
      ua: 'Британський виробник квікшифтерів. Системи Intellishift з підключенням підставки та plug-and-play комплекти.',
    },
    accentColor: 'from-teal-500/30 to-cyan-500/20',
  },
];

const electronicsTypes = [
  {
    name: { en: 'Data Loggers', ua: 'Дата-логери' },
    description: {
      en: 'GPS-enabled lap timers and data acquisition systems for track analysis and improvement.',
      ua: 'GPS-хронометри та системи збору даних для аналізу та покращення на треку.',
    },
    icon: ECUIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'ECU Tuning', ua: 'ECU тюнінг' },
    description: {
      en: 'Fuel controllers and ECU flash kits for custom fueling, ignition and throttle response.',
      ua: 'Паливні контролери та комплекти прошивки ECU для налаштування паливоподачі, запалення та відгуку дроселя.',
    },
    icon: IntercoolerIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Quick-Shifters', ua: 'Квікшифтери' },
    description: {
      en: 'Electronic shift sensors for clutchless upshifts and auto-blipper downshifts.',
      ua: 'Електронні датчики перемикання для беззчепленнєвих перемикань та авто-перегазовки.',
    },
    icon: TurboIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Dashboards', ua: 'Приладові панелі' },
    description: {
      en: 'Aftermarket digital displays with lap timing, shift lights and data overlay.',
      ua: 'Aftermarket цифрові дисплеї з хронометражем, ліхтарями перемикання та накладенням даних.',
    },
    icon: WaterPumpIcon,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Sensors', ua: 'Датчики' },
    description: {
      en: 'Suspension potentiometers, tire pressure monitors and exhaust gas analyzers.',
      ua: 'Потенціометри підвіски, монітори тиску шин та аналізатори вихлопних газів.',
    },
    icon: EngineIcon,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Wiring Harnesses', ua: 'Проводка' },
    description: {
      en: 'Race wiring harnesses, quick-disconnect plugs and waterproof connectors.',
      ua: 'Гоночна проводка, швидкороз\'ємні штекери та водонепроникні конектори.',
    },
    icon: ExhaustSystemIcon,
    color: 'text-orange-400',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Billet Aluminum', ua: 'Білетний алюміній' },
    description: { en: 'CNC-machined housings for dashboards and sensors', ua: 'CNC-оброблені корпуси для панелей та датчиків' },
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: { en: 'Military-Grade PCB', ua: 'Військові плати' },
    description: { en: 'Vibration-resistant circuit boards for reliability', ua: 'Вібростійкі плати для надійності' },
    color: 'from-green-400 to-emerald-500',
  },
  {
    name: { en: 'Waterproof Connectors', ua: 'Водонепроникні конектори' },
    description: { en: 'IP67-rated plugs and sockets', ua: 'IP67-сертифіковані штекери та розетки' },
    color: 'from-blue-400 to-cyan-500',
  },
  {
    name: { en: 'Silicone Wiring', ua: 'Силіконова проводка' },
    description: { en: 'Heat-resistant flexible wiring harnesses', ua: 'Термостійкі гнучкі джгути проводки' },
    color: 'from-orange-400 to-red-500',
  },
];

export default function MotoElectronicsCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof electronicsBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Moto Category', ua: 'Мото категорія' },
      title: { en: 'Electronics & Data', ua: 'Електроніка та дані' },
      subtitle: {
        en: 'Data acquisition, ECU tuning, quick-shifters and racing dashboards for track performance analysis. GPS lap timing, telemetry and custom fuel mapping.',
        ua: 'Збір даних, ECU тюнінг, квікшифтери та гоночні приладові панелі для аналізу продуктивності на треку. GPS хронометраж, телеметрія та кастомні паливні карти.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-black to-purple-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400/80 sm:text-xs">
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
            {electronicsTypes.map((type, i) => (
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
            {electronicsBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Готові до електронного апгрейду?' : 'Ready for an electronics upgrade?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо підбору електроніки та ECU тюнінгу.'
                : 'Contact us for a consultation on electronics selection and ECU tuning.'}
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
