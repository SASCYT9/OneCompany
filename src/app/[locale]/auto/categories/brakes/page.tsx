// src/app/[locale]/auto/categories/brakes/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { BrakeDiscIcon, CaliperIcon, BrakeLinesIcon, WheelIcon, TireIcon, RadiatorIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const brakeBrands = [
  {
    name: 'Brembo',
    country: '🇮🇹 Italy',
    specialty: { en: 'OEM & Racing', ua: 'OEM та гонки' },
    description: {
      en: 'World leader in braking systems. OEM supplier to Ferrari, Porsche, Lamborghini. GT and Formula racing heritage.',
      ua: 'Світовий лідер гальмівних систем. OEM постачальник Ferrari, Porsche, Lamborghini. Спадщина GT та Формули.',
    },
    featured: true,
    accentColor: 'from-red-500/30 to-orange-500/20',
  },
  {
    name: 'Stoptech',
    country: '🇺🇸 USA',
    specialty: { en: 'Big Brake Kits', ua: 'BBK комплекти' },
    description: {
      en: 'Performance-focused BBK systems with AeroRotor technology and Trophy series for track use.',
      ua: 'Продуктивні BBK системи з технологією AeroRotor та серією Trophy для треку.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Girodisc',
    country: '🇺🇸 USA',
    specialty: { en: '2-Piece Rotors', ua: '2-секційні диски' },
    description: {
      en: 'Premium 2-piece floating rotors with aluminum hats. Weight savings and improved heat dissipation.',
      ua: 'Преміальні 2-секційні плаваючі диски з алюмінієвими хабами. Економія ваги та краще відведення тепла.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Paragon',
    country: '🇬🇧 UK',
    specialty: { en: 'Carbon Ceramic', ua: 'Карбон-кераміка' },
    description: {
      en: 'Carbon ceramic brake specialists. Lightweight systems with extreme heat resistance for supercars.',
      ua: 'Спеціалісти з карбон-керамічних гальм. Легкі системи з екстремальною термостійкістю для суперкарів.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'AP Racing',
    country: '🇬🇧 UK',
    specialty: { en: 'Motorsport', ua: 'Мотоспорт' },
    description: {
      en: 'Motorsport-grade braking systems. Radi-CAL calipers and competition-proven components.',
      ua: 'Гальмівні системи мотоспортивного класу. Супорти Radi-CAL та перевірені на змаганнях компоненти.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'Pagid Racing',
    country: '🇩🇪 Germany',
    specialty: { en: 'Racing Pads', ua: 'Гоночні колодки' },
    description: {
      en: 'OEM supplier for Porsche Motorsport. RSL and RSC compound pads for endurance and sprint racing.',
      ua: 'OEM постачальник для Porsche Motorsport. Колодки RSL та RSC для витривалих та спринтерських гонок.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'STOPART ceramic',
    country: '🇩🇪 Germany',
    specialty: { en: 'PCCB Replacement', ua: 'Заміна PCCB' },
    description: {
      en: 'Premium ceramic brake solutions. PCCB-equivalent systems at competitive pricing.',
      ua: 'Преміальні керамічні гальмівні рішення. Системи рівня PCCB за конкурентною ціною.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Sachs Performance',
    country: '🇩🇪 Germany',
    specialty: { en: 'OE Quality', ua: 'OE якість' },
    description: {
      en: 'ZF Group brand. OE-quality performance dampers and clutch systems with German engineering.',
      ua: 'Бренд ZF Group. Продуктивні демпфери та зчеплення OE-якості з німецьким інжинірингом.',
    },
    accentColor: 'from-violet-500/30 to-indigo-500/20',
  },
];

const brakeTypes = [
  {
    name: { en: 'Big Brake Kits', ua: 'BBK комплекти' },
    description: {
      en: 'Complete brake upgrades with larger rotors and multi-piston calipers for improved stopping power.',
      ua: 'Повні апгрейди гальм з більшими дисками та багатопоршневими супортами для кращого гальмування.',
    },
    icon: TireIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Carbon Ceramic', ua: 'Карбон-кераміка' },
    description: {
      en: 'Ultra-lightweight ceramic composite rotors with extreme heat tolerance for track and street.',
      ua: 'Надлегкі керамічні композитні диски з екстремальною термостійкістю для треку та вулиці.',
    },
    icon: BrakeDiscIcon,
    color: 'text-zinc-300',
  },
  {
    name: { en: '2-Piece Rotors', ua: '2-секційні диски' },
    description: {
      en: 'Floating rotors with aluminum hats reduce weight and allow for thermal expansion.',
      ua: 'Плаваючі диски з алюмінієвими хабами зменшують вагу та дозволяють термічне розширення.',
    },
    icon: WheelIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Racing Pads', ua: 'Гоночні колодки' },
    description: {
      en: 'High-friction compounds designed for track temperatures and repeated hard braking.',
      ua: 'Високофрикційні компаунди для трекових температур та повторного інтенсивного гальмування.',
    },
    icon: CaliperIcon,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Brake Lines', ua: 'Гальмівні шланги' },
    description: {
      en: 'Stainless steel braided lines for improved pedal feel and consistent pressure delivery.',
      ua: 'Плетені шланги з нержавіючої сталі для кращого відчуття педалі та стабільного тиску.',
    },
    icon: BrakeLinesIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Brake Fluid', ua: 'Гальмівна рідина' },
    description: {
      en: 'High-temperature DOT 4 and racing fluids to prevent brake fade under extreme conditions.',
      ua: 'Високотемпературні DOT 4 та гоночні рідини для запобігання затуханню гальм в екстремальних умовах.',
    },
    icon: RadiatorIcon,
    color: 'text-blue-400',
  },
];

export default function BrakesCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof brakeBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Brake Systems', ua: 'Гальмівні системи' },
      subtitle: {
        en: 'Monoblock calipers, floating rotors and racing pads for repeatable deceleration and pedal precision. From BBK conversions to track-only ceramic kits.',
        ua: 'Моноблочні супорти, плаваючі диски та спортивні колодки для стабільного гальмування та точності педалі. Від BBK-комплектів до трекових керамічних систем.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-rose-950/20" />
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

      {/* Product Types Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.types[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brakeTypes.map((type, i) => (
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
            {brakeBrands.map((brand, i) => (
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
                    <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
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
              {locale === 'ua' ? 'Готові до апгрейду?' : 'Ready to upgrade?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо вибору оптимальної гальмівної системи для вашого автомобіля.'
                : 'Contact us for a consultation on choosing the optimal braking system for your vehicle.'}
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
