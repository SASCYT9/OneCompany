// src/app/[locale]/auto/categories/exterior/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { Car, ArrowDown, ChevronDown, Trophy, Wrench, Sparkles } from 'lucide-react';

type Locale = 'en' | 'ua';

const exteriorBrands = [
  {
    name: 'Mansory',
    country: '🇩🇪 Germany',
    specialty: { en: 'Luxury Widebody', ua: 'Лакшері Widebody' },
    description: {
      en: 'Ultra-luxury carbon fiber transformations for Rolls-Royce, Bentley, Ferrari and more. Complete widebody programs.',
      ua: 'Ультра-лакшері карбонові трансформації для Rolls-Royce, Bentley, Ferrari. Повні widebody програми.',
    },
    featured: true,
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Manhart',
    country: '🇩🇪 Germany',
    specialty: { en: 'BMW Specialist', ua: 'Спеціаліст BMW' },
    description: {
      en: 'German tuner known for aggressive BMW and Mercedes builds with signature gold accents.',
      ua: 'Німецький тюнер, відомий агресивними BMW та Mercedes з фірмовими золотими акцентами.',
    },
    accentColor: 'from-yellow-500/30 to-amber-500/20',
  },
  {
    name: 'Lumma',
    country: '🇩🇪 Germany',
    specialty: { en: 'CLR Design', ua: 'CLR дизайн' },
    description: {
      en: 'CLR widebody programs for Range Rover, BMW X-series and luxury SUVs with aggressive stance.',
      ua: 'CLR widebody програми для Range Rover, BMW X-series та лакшері SUV з агресивною стійкою.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Larte Design',
    country: '🇩🇪 Germany',
    specialty: { en: 'SUV Aero', ua: 'SUV аеро' },
    description: {
      en: 'Aerodynamic body kits for Mercedes, BMW, Lexus and Tesla with CFD-optimized designs.',
      ua: 'Аеродинамічні обвіси для Mercedes, BMW, Lexus та Tesla з CFD-оптимізованим дизайном.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Liberty Walk',
    country: '🇯🇵 Japan',
    specialty: { en: 'Widebody', ua: 'Widebody' },
    description: {
      en: 'Japanese widebody culture icons. Bolt-on and full carbon widebody kits for supercars and JDM.',
      ua: 'Японські ікони widebody культури. Bolt-on та повні карбонові widebody для суперкарів та JDM.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Keyvany',
    country: '🇩🇪 Germany',
    specialty: { en: 'Carbon Art', ua: 'Карбонове мистецтво' },
    description: {
      en: 'Exclusive carbon fiber styling for Lamborghini, Ferrari and Porsche with unique forged carbon.',
      ua: 'Ексклюзивний карбоновий стайлінг для Lamborghini, Ferrari та Porsche з унікальним кованим карбоном.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'Renegade Design',
    country: '🇬🇧 UK',
    specialty: { en: 'Land Rover', ua: 'Land Rover' },
    description: {
      en: 'British body kit specialists for Land Rover Defender and Range Rover with military-inspired designs.',
      ua: 'Британські спеціалісти обвісів для Land Rover Defender та Range Rover з мілітарі-дизайном.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'Ronin Design',
    country: '🇺🇦 Ukraine',
    specialty: { en: 'Premium Carbon', ua: 'Преміум карбон' },
    description: {
      en: 'Ukrainian carbon fiber manufacturer. Premium aero components for BMW, Mercedes, Porsche.',
      ua: 'Український виробник карбону. Преміальні аеро-компоненти для BMW, Mercedes, Porsche.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Vorsteiner',
    country: '🇺🇸 USA',
    specialty: { en: 'Carbon Aero', ua: 'Карбонове аеро' },
    description: {
      en: 'American carbon fiber specialists with aerospace-grade construction and wind tunnel testing.',
      ua: 'Американські спеціалісти карбону з аерокосмічною конструкцією та тестуванням в аеродинамічній трубі.',
    },
    accentColor: 'from-violet-500/30 to-indigo-500/20',
  },
  {
    name: '1016 Industries',
    country: '🇺🇸 USA',
    specialty: { en: 'Forged Carbon', ua: 'Кований карбон' },
    description: {
      en: 'Forged carbon specialists for Lamborghini and McLaren with signature marble-pattern finish.',
      ua: 'Спеціалісти кованого карбону для Lamborghini та McLaren з фірмовим мармуровим фінішем.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
];

const exteriorTypes = [
  {
    name: { en: 'Widebody Kits', ua: 'Widebody обвіси' },
    description: {
      en: 'Complete wide body transformations with extended fenders, side skirts and bumpers.',
      ua: 'Повні widebody трансформації з розширеними крилами, порогами та бамперами.',
    },
    icon: Car,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Carbon Splitters', ua: 'Карбонові сплітери' },
    description: {
      en: 'Front splitters and lip spoilers for increased downforce and aggressive front-end styling.',
      ua: 'Передні сплітери та ліп-спойлери для збільшення притискної сили та агресивного стайлінгу.',
    },
    icon: ArrowDown,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Diffusers', ua: 'Дифузори' },
    description: {
      en: 'Rear diffusers that accelerate airflow under the car for reduced lift and better stability.',
      ua: 'Задні дифузори, що прискорюють потік під автомобілем для зменшення підйому та кращої стабільності.',
    },
    icon: ChevronDown,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Spoilers & Wings', ua: 'Спойлери та антикрила' },
    description: {
      en: 'Rear spoilers and wings from subtle lip designs to full GT wings for maximum downforce.',
      ua: 'Задні спойлери та антикрила від мінімальних ліпів до повних GT антикрил для максимального притиску.',
    },
    icon: Trophy,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Hood & Trunk', ua: 'Капот та багажник' },
    description: {
      en: 'Carbon fiber hoods, trunk lids and vented designs for weight reduction and heat extraction.',
      ua: 'Карбонові капоти, кришки багажника та вентильовані дизайни для зниження ваги та відведення тепла.',
    },
    icon: Wrench,
    color: 'text-red-400',
  },
  {
    name: { en: 'Mirror Caps & Trim', ua: 'Накладки дзеркал' },
    description: {
      en: 'Carbon fiber mirror caps, grille inserts and exterior trim pieces for subtle upgrades.',
      ua: 'Карбонові накладки дзеркал, вставки решітки та зовнішній декор для м\'яких апгрейдів.',
    },
    icon: Sparkles,
    color: 'text-emerald-400',
  },
];

export default function ExteriorCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof exteriorBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Exterior & Aero', ua: 'Екстер\'єр та аеро' },
      subtitle: {
        en: 'Widebody kits, carbon splitters, diffusers and spoilers engineered for downforce and aggressive stance. From subtle OEM+ carbon accents to full widebody transformations.',
        ua: 'Widebody-обвіси, карбонові сплітери, дифузори та спойлери для притискної сили та агресивного вигляду. Від карбонових акцентів OEM+ до повних widebody трансформацій.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-black to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-400/80 sm:text-xs">
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
            {exteriorTypes.map((type, i) => (
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
            {exteriorBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Готові до трансформації?' : 'Ready for a transformation?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо вибору ідеального аеро-пакету для вашого автомобіля.'
                : 'Contact us for a consultation on choosing the perfect aero package for your vehicle.'}
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
