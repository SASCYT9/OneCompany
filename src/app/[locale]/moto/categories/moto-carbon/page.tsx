// src/app/[locale]/moto/categories/moto-carbon/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { Bike, Shield, Wrench, Cog, Link2, Flame } from 'lucide-react';

type Locale = 'en' | 'ua';

const carbonBrands = [
  {
    name: 'Ilmberger Carbon',
    country: '🇩🇪 Germany',
    specialty: { en: 'Prepreg Carbon', ua: 'Препрег карбон' },
    description: {
      en: 'German carbon fiber specialists. Autoclave-cured prepreg components with OEM fitment for Ducati, BMW, Aprilia.',
      ua: 'Німецькі спеціалісти карбону. Автоклавні препрег-компоненти з OEM посадкою для Ducati, BMW, Aprilia.',
    },
    featured: true,
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Fullsix Carbon',
    country: '🇮🇹 Italy',
    specialty: { en: 'Italian Craft', ua: 'Італійська майстерність' },
    description: {
      en: 'Italian carbon manufacturer for Ducati and MV Agusta. Autoclave technology with gloss and matte finishes.',
      ua: 'Італійський виробник карбону для Ducati та MV Agusta. Автоклавна технологія з глянцевим та матовим покриттям.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Carbon2Race',
    country: '🇮🇹 Italy',
    specialty: { en: 'Racing Carbon', ua: 'Гоночний карбон' },
    description: {
      en: 'Italian race carbon specialist with fairings, belly pans and crash protection for track use.',
      ua: 'Італійський спеціаліст гоночного карбону з обтічниками, піддонами та захистом від падінь для треку.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'CRC Fairings',
    country: '🇺🇸 USA',
    specialty: { en: 'Race Bodywork', ua: 'Гоночний обвіс' },
    description: {
      en: 'American race bodywork manufacturer. Fiberglass and carbon race fairings for track and club racing.',
      ua: 'Американський виробник гоночного обвісу. Склопластикові та карбонові обтічники для треку та клубних гонок.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Armour Bodies',
    country: '🇺🇸 USA',
    specialty: { en: 'Pro Race', ua: 'Про гонки' },
    description: {
      en: 'American pro racing bodywork supplier. Used in MotoAmerica and club racing nationwide.',
      ua: 'Американський постачальник про-гоночного обвісу. Використовується в MotoAmerica та клубних гонках.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'Rizoma',
    country: '🇮🇹 Italy',
    specialty: { en: 'Design Parts', ua: 'Дизайнерські деталі' },
    description: {
      en: 'Italian design house for premium billet and carbon accessories. Mirrors, levers, grips and trim.',
      ua: 'Італійський дизайн-хаус преміальних білетних та карбонових аксесуарів. Дзеркала, важелі, грипси та декор.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'Akrapovič',
    country: '🇸🇮 Slovenia',
    specialty: { en: 'Carbon Cans', ua: 'Карбонові глушники' },
    description: {
      en: 'Slovenian exhaust legends with carbon fiber muffler bodies and heat shields.',
      ua: 'Словенські легенди вихлопів з карбоновими корпусами глушників та теплозахисними екранами.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Airtech',
    country: '🇺🇸 USA',
    specialty: { en: 'Streetfighter', ua: 'Стрітфайтер' },
    description: {
      en: 'American fiberglass specialist with vintage and streetfighter bodywork options.',
      ua: 'Американський спеціаліст склопластику з вінтажними та стрітфайтер варіантами обвісу.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
];

const carbonTypes = [
  {
    name: { en: 'Full Fairing Sets', ua: 'Повні комплекти обтічників' },
    description: {
      en: 'Complete race fairing sets with upper, lowers and belly pan for track transformation.',
      ua: 'Повні гоночні комплекти обтічників з верхнім, нижніми та піддоном для трекової трансформації.',
    },
    icon: Bike,
    color: 'text-red-400',
  },
  {
    name: { en: 'Tank Covers', ua: 'Накладки на бак' },
    description: {
      en: 'Carbon fiber tank covers and protectors for scratch protection and weight savings.',
      ua: 'Карбонові накладки та протектори бака для захисту від подряпин та зниження ваги.',
    },
    icon: Shield,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Fenders', ua: 'Крила' },
    description: {
      en: 'Front and rear fenders in carbon or fiberglass for lighter unsprung weight.',
      ua: 'Передні та задні крила з карбону або склопластику для легшої непідресореної маси.',
    },
    icon: Wrench,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Frame Covers', ua: 'Накладки рами' },
    description: {
      en: 'Carbon fiber frame sliders and covers for crash protection with minimal weight.',
      ua: 'Карбонові слайдери та накладки рами для захисту від падінь з мінімальною вагою.',
    },
    icon: Cog,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Swingarm Covers', ua: 'Накладки маятника' },
    description: {
      en: 'Carbon swingarm protectors and chain guard covers for rear-end protection.',
      ua: 'Карбонові протектори маятника та накладки ланцюгозахисту для захисту задньої частини.',
    },
    icon: Link2,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Heat Shields', ua: 'Теплозахисні екрани' },
    description: {
      en: 'Exhaust heat shields and engine covers in carbon for heat management and style.',
      ua: 'Теплозахисні екрани вихлопу та накладки двигуна з карбону для управління теплом та стилю.',
    },
    icon: Flame,
    color: 'text-orange-400',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Pre-preg Carbon', ua: 'Препрег-карбон' },
    description: { en: 'Autoclave-cured aerospace-grade carbon fiber', ua: 'Автоклавний аерокосмічний карбон' },
    color: 'from-gray-800 to-black',
  },
  {
    name: { en: 'Dry Carbon', ua: 'Сухий карбон' },
    description: { en: 'Lightest carbon with no resin excess', ua: 'Найлегший карбон без надлишку смоли' },
    color: 'from-zinc-600 to-zinc-800',
  },
  {
    name: { en: 'Fiberglass', ua: 'Склопластик' },
    description: { en: 'Cost-effective race bodywork option', ua: 'Бюджетний варіант гоночного обвісу' },
    color: 'from-amber-400 to-orange-500',
  },
  {
    name: { en: 'Kevlar Blend', ua: 'Кевлар-бленд' },
    description: { en: 'Carbon-Kevlar for extra impact resistance', ua: 'Карбон-кевлар для додаткової ударостійкості' },
    color: 'from-yellow-500 to-amber-600',
  },
];

export default function MotoCarbonCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof carbonBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Moto Category', ua: 'Мото категорія' },
      title: { en: 'Carbon & Aero', ua: 'Карбон та аеро' },
      subtitle: {
        en: 'Pre-preg carbon fairings, tank covers, fenders and crash protection engineered for weight savings and track legality. FIM-approved kits with paint-to-sample finishing.',
        ua: 'Препрег-карбон обтічники, накладки бака, крила та краш-захист для зниження ваги та трекової легальності. FIM-сертифіковані комплекти з індивідуальним фарбуванням.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-neutral-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-400/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400/80 sm:text-xs">
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
            {carbonTypes.map((type, i) => (
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
            {carbonBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Готові до карбонової трансформації?' : 'Ready for carbon transformation?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо карбонових компонентів для вашого мотоцикла.'
                : 'Contact us for a consultation on carbon components for your motorcycle.'}
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
