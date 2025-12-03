// src/app/[locale]/auto/categories/cooling/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { RadiatorIcon, IntercoolerIcon, WaterPumpIcon, TurboIcon, AirFilterIcon, EngineIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const coolingBrands = [
  {
    name: 'CSF Racing',
    country: '🇺🇸 USA',
    specialty: { en: 'OEM+ Radiators', ua: 'OEM+ радіатори' },
    description: {
      en: 'High-performance aluminum radiators with OEM fit and enhanced cooling capacity. Triple-pass designs.',
      ua: 'Високопродуктивні алюмінієві радіатори з OEM посадкою та підвищеною охолоджуючою здатністю. Triple-pass дизайни.',
    },
    featured: true,
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Wagner Tuning',
    country: '🇩🇪 Germany',
    specialty: { en: 'Intercoolers', ua: 'Інтеркулери' },
    description: {
      en: 'German intercooler specialists with Competition and EVO lines for maximum charge air cooling.',
      ua: 'Німецькі спеціалісти інтеркулерів з лінійками Competition та EVO для максимального охолодження наддуву.',
    },
    accentColor: 'from-green-500/30 to-emerald-500/20',
  },
  {
    name: 'Mishimoto',
    country: '🇺🇸 USA',
    specialty: { en: 'Cooling Systems', ua: 'Системи охолодження' },
    description: {
      en: 'Complete cooling solutions: radiators, intercoolers, oil coolers, hoses and thermostats.',
      ua: 'Комплексні рішення охолодження: радіатори, інтеркулери, маслоохолоджувачі, патрубки та термостати.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'PWR',
    country: '🇦🇺 Australia',
    specialty: { en: 'Motorsport Cooling', ua: 'Мотоспорт охолодження' },
    description: {
      en: 'Australian motorsport cooling supplier to F1, WRC and top race teams worldwide.',
      ua: 'Австралійський постачальник мотоспорт охолодження для F1, WRC та топових гоночних команд.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Setrab',
    country: '🇸🇪 Sweden',
    specialty: { en: 'Oil Coolers', ua: 'Маслоохолоджувачі' },
    description: {
      en: 'Swedish oil cooler manufacturer for motorsport and performance applications. ProLine series.',
      ua: 'Шведський виробник маслоохолоджувачів для мотоспорту та performance застосувань. Серія ProLine.',
    },
    accentColor: 'from-yellow-500/30 to-amber-500/20',
  },
  {
    name: 'Mocal',
    country: '🇬🇧 UK',
    specialty: { en: 'Oil Systems', ua: 'Масляні системи' },
    description: {
      en: 'British oil cooler and thermostatic sandwich plate manufacturer. Motorsport-proven designs.',
      ua: 'Британський виробник маслоохолоджувачів та термостатичних плит. Мотоспорт-перевірені дизайни.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'do88',
    country: '🇸🇪 Sweden',
    specialty: { en: 'Performance Cooling', ua: 'Performance охолодження' },
    description: {
      en: 'Swedish performance cooling specialists. Radiators, intercoolers and silicone hose kits.',
      ua: 'Шведські спеціалісти performance охолодження. Радіатори, інтеркулери та силіконові патрубки.',
    },
    accentColor: 'from-violet-500/30 to-purple-500/20',
  },
  {
    name: 'Forge Motorsport',
    country: '🇬🇧 UK',
    specialty: { en: 'Alloy Cooling', ua: 'Алюмінієве охолодження' },
    description: {
      en: 'British manufacturer of intercoolers, oil coolers and cooling accessories for VAG and more.',
      ua: 'Британський виробник інтеркулерів, маслоохолоджувачів та аксесуарів охолодження для VAG та інших.',
    },
    accentColor: 'from-teal-500/30 to-cyan-500/20',
  },
  {
    name: 'Samco Sport',
    country: '🇬🇧 UK',
    specialty: { en: 'Silicone Hoses', ua: 'Силіконові патрубки' },
    description: {
      en: 'Premium silicone hose manufacturer. Coolant, turbo and heater hose kits in custom colors.',
      ua: 'Преміальний виробник силіконових патрубків. Кіти патрубків охолодження, турбо та печки в кастомних кольорах.',
    },
    accentColor: 'from-pink-500/30 to-rose-500/20',
  },
  {
    name: 'SPAL',
    country: '🇮🇹 Italy',
    specialty: { en: 'Electric Fans', ua: 'Електро вентилятори' },
    description: {
      en: 'Italian electric fan manufacturer. High-flow cooling fans and fan controllers for performance applications.',
      ua: 'Італійський виробник електро вентиляторів. Високопропускні вентилятори та контролери для performance.',
    },
    accentColor: 'from-indigo-500/30 to-blue-500/20',
  },
];

const coolingTypes = [
  {
    name: { en: 'Radiators', ua: 'Радіатори' },
    description: {
      en: 'Aluminum performance radiators with increased core thickness and tube rows for enhanced cooling.',
      ua: 'Алюмінієві performance радіатори зі збільшеною товщиною ядра та рядами трубок для кращого охолодження.',
    },
    icon: RadiatorIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Intercoolers', ua: 'Інтеркулери' },
    description: {
      en: 'Front-mount and top-mount intercoolers for reduced intake air temperatures.',
      ua: 'Фронтальні та верхні інтеркулери для зниження температури впускного повітря.',
    },
    icon: IntercoolerIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Oil Coolers', ua: 'Маслоохолоджувачі' },
    description: {
      en: 'Engine and transmission oil coolers for maintaining optimal lubricant temperatures.',
      ua: 'Маслоохолоджувачі двигуна та трансмісії для підтримки оптимальної температури мастила.',
    },
    icon: WaterPumpIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Silicone Hoses', ua: 'Силіконові патрубки' },
    description: {
      en: 'High-temperature silicone coolant hoses with improved pressure ratings and custom colors.',
      ua: 'Високотемпературні силіконові патрубки з покращеними характеристиками тиску та кастомними кольорами.',
    },
    icon: AirFilterIcon,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Electric Fans', ua: 'Електро вентилятори' },
    description: {
      en: 'High-CFM electric cooling fans with digital controllers for precise temperature management.',
      ua: 'Високопродуктивні електро вентилятори з цифровими контролерами для точного управління температурою.',
    },
    icon: TurboIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Water Pumps', ua: 'Водяні помпи' },
    description: {
      en: 'High-flow mechanical and electric water pumps for improved coolant circulation.',
      ua: 'Високопропускні механічні та електричні помпи для покращеної циркуляції охолоджувача.',
    },
    icon: EngineIcon,
    color: 'text-emerald-400',
  },
];

export default function CoolingCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof coolingBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Cooling', ua: 'Охолодження' },
      subtitle: {
        en: 'Radiators, intercoolers, oil coolers and complete cooling system upgrades. Keep your engine running at optimal temperatures.',
        ua: 'Радіатори, інтеркулери, маслоохолоджувачі та комплексні апгрейди системи охолодження. Тримайте двигун в оптимальному температурному режимі.',
      },
    },
    sections: {
      brands: { en: 'Featured Brands', ua: 'Провідні бренди' },
      types: { en: 'Product Types', ua: 'Типи продуктів' },
      cta: { en: 'Request Quote', ua: 'Запросити ціну' },
    },
    back: { en: '← Back to Auto', ua: '← Назад до Авто' },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/30 via-black to-blue-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
        
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

      {/* Product Types Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.types[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coolingTypes.map((type, i) => (
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
            {coolingBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Потрібна консультація з охолодження?' : 'Need cooling consultation?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для підбору оптимальної системи охолодження для вашого автомобіля.'
                : 'Contact us for optimal cooling system selection for your vehicle.'}
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
