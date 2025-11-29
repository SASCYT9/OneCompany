// src/app/[locale]/moto/categories/moto-wheels/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';

type Locale = 'en' | 'ua';

const wheelBrands = [
  {
    name: 'Rotobox',
    country: '🇸🇮 Slovenia',
    specialty: { en: 'Carbon Wheels', ua: 'Карбонові диски' },
    description: {
      en: 'Slovenian carbon wheel pioneers. Boost and Bullet designs with 45% weight reduction vs. OEM forged.',
      ua: 'Словенські піонери карбонових дисків. Дизайни Boost та Bullet зі зниженням ваги 45% порівняно з OEM кованими.',
    },
    featured: true,
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'BST Carbon Fiber',
    country: '🇿🇦 South Africa',
    specialty: { en: 'MotoGP Spec', ua: 'MotoGP специфікація' },
    description: {
      en: 'South African carbon wheel manufacturer used in MotoGP and WorldSBK. Black Diamond and Rapid TEK series.',
      ua: 'Південноафриканський виробник карбонових дисків для MotoGP та WorldSBK. Серії Black Diamond та Rapid TEK.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Marchesini',
    country: '🇮🇹 Italy',
    specialty: { en: 'Forged Aluminum', ua: 'Ковані алюмінієві' },
    description: {
      en: 'Italian forged wheel legends. M10RS Corse and M7RS Genesi for superbikes and track use.',
      ua: 'Італійські легенди кованих дисків. M10RS Corse та M7RS Genesi для суперспортів та треку.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Brembo',
    country: '🇮🇹 Italy',
    specialty: { en: 'Racing Brakes', ua: 'Гоночні гальма' },
    description: {
      en: 'Italian brake legends. GP4-RX, Stylema and M4 radial calipers, T-Drive rotors for ultimate stopping power.',
      ua: 'Італійські легенди гальм. Радіальні супорти GP4-RX, Stylema та M4, ротори T-Drive для максимального гальмування.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Accossato',
    country: '🇮🇹 Italy',
    specialty: { en: 'Master Cylinders', ua: 'Головні циліндри' },
    description: {
      en: 'Italian brake component specialist. Radial master cylinders, brake levers and complete brake systems.',
      ua: 'Італійський спеціаліст гальмівних компонентів. Радіальні головні циліндри, важелі та комплексні системи.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Galfer',
    country: '🇪🇸 Spain',
    specialty: { en: 'Brake Discs', ua: 'Гальмівні диски' },
    description: {
      en: 'Spanish brake specialist with Wave and Floatech rotors. Racing brake lines and performance pads.',
      ua: 'Іспанський спеціаліст гальм з роторами Wave та Floatech. Гоночні магістралі та performance колодки.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'EBC Brakes',
    country: '🇬🇧 UK',
    specialty: { en: 'Brake Pads', ua: 'Гальмівні колодки' },
    description: {
      en: 'British brake pad manufacturer. GPFA, EPFA and HH sintered compounds for all conditions.',
      ua: 'Британський виробник гальмівних колодок. Спечені компаунди GPFA, EPFA та HH для всіх умов.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'CNC Racing',
    country: '🇮🇹 Italy',
    specialty: { en: 'Billet Parts', ua: 'Білетні деталі' },
    description: {
      en: 'Italian CNC specialist. Brake and clutch levers, rearsets, triple clamps and billet accessories.',
      ua: 'Італійський CNC спеціаліст. Важелі гальма та зчеплення, підніжки, траверси та білетні аксесуари.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
];

const productTypes = [
  {
    name: { en: 'Carbon Fiber Wheels', ua: 'Карбонові диски' },
    description: {
      en: 'Pre-preg carbon wheels for 40-50% unsprung weight reduction. Improved acceleration and handling.',
      ua: 'Препрег-карбонові диски для зниження непідресореної маси на 40-50%. Покращене прискорення та керованість.',
    },
    icon: '⚫',
  },
  {
    name: { en: 'Forged Aluminum', ua: 'Ковані алюмінієві' },
    description: {
      en: 'Lightweight forged wheels from aerospace-grade aluminum for street and track performance.',
      ua: 'Легкі ковані диски з аерокосмічного алюмінію для вуличної та трекової продуктивності.',
    },
    icon: '💎',
  },
  {
    name: { en: 'Radial Calipers', ua: 'Радіальні супорти' },
    description: {
      en: 'Monoblock radial-mount calipers for improved rigidity and consistent braking performance.',
      ua: 'Моноблочні радіальні супорти для підвищеної жорсткості та стабільного гальмування.',
    },
    icon: '🔧',
  },
  {
    name: { en: 'Floating Rotors', ua: 'Плаваючі диски' },
    description: {
      en: 'T-Drive and floating disc designs for heat management and reduced warping.',
      ua: 'Дизайни T-Drive та плаваючих дисків для управління теплом та зменшення викривлення.',
    },
    icon: '🌀',
  },
  {
    name: { en: 'Master Cylinders', ua: 'Головні циліндри' },
    description: {
      en: 'Radial and axial master cylinders with adjustable ratio for precise brake feel.',
      ua: 'Радіальні та аксіальні головні циліндри з регульованим співвідношенням для точного відчуття гальма.',
    },
    icon: '⚙️',
  },
  {
    name: { en: 'Brake Lines', ua: 'Гальмівні магістралі' },
    description: {
      en: 'Braided steel brake lines for improved pedal feedback and reduced expansion.',
      ua: 'Армовані сталеві магістралі для кращого зворотного зв\'язку та зменшеного розширення.',
    },
    icon: '🔗',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Carbon Fiber', ua: 'Карбон' },
    description: { en: 'Pre-preg autoclave carbon for 50% weight reduction', ua: 'Препрег-автоклавний карбон для зниження ваги на 50%' },
    color: 'from-gray-800 to-black',
  },
  {
    name: { en: 'Forged Aluminum', ua: 'Кований алюміній' },
    description: { en: 'Aerospace-grade 7075-T6 aluminum alloy', ua: 'Аерокосмічний алюміній 7075-T6' },
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: { en: 'Billet Aluminum', ua: 'Білетний алюміній' },
    description: { en: 'CNC-machined calipers and master cylinders', ua: 'CNC-оброблені супорти та головні циліндри' },
    color: 'from-blue-400 to-cyan-500',
  },
  {
    name: { en: 'Stainless Steel', ua: 'Нержавіюча сталь' },
    description: { en: 'Rotors and braided brake lines', ua: 'Ротори та армовані гальмівні магістралі' },
    color: 'from-amber-400 to-orange-500',
  },
];

export default function MotoWheelsCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof wheelBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Moto Category', ua: 'Мото категорія' },
      title: { en: 'Wheels & Brakes', ua: 'Диски та гальма' },
      subtitle: {
        en: 'Carbon and forged aluminum wheels paired with radial master cylinders, racing pads and floating rotors. Unsprung weight reduction and repeatable braking for superbikes.',
        ua: 'Карбонові та ковані алюмінієві диски з радіальними циліндрами, гоночними колодками та плаваючими дисками. Зниження непідресореної маси та стабільне гальмування для суперспортів.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-zinc-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-400/80 sm:text-xs">
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
            {productTypes.map((type, i) => (
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
            {wheelBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Готові до апгрейду?' : 'Ready to upgrade?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо підбору дисків та гальмівної системи.'
                : 'Contact us for a consultation on wheels and brake system selection.'}
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
