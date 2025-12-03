// src/app/[locale]/moto/categories/moto-suspension/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { Wrench, Cog, Trophy, Target, ArrowUpDown, Microscope } from 'lucide-react';

type Locale = 'en' | 'ua';

const suspensionBrands = [
  {
    name: 'Öhlins',
    country: '🇸🇪 Sweden',
    specialty: { en: 'MotoGP Supplier', ua: 'Постачальник MotoGP' },
    description: {
      en: 'Swedish suspension legends. NIX forks, TTX shocks and electronic semi-active systems for ultimate control.',
      ua: 'Шведські легенди підвіски. Вилки NIX, амортизатори TTX та електронні напівактивні системи для максимального контролю.',
    },
    featured: true,
    accentColor: 'from-yellow-500/30 to-amber-500/20',
  },
  {
    name: 'Bitubo',
    country: '🇮🇹 Italy',
    specialty: { en: 'Italian Engineering', ua: 'Італійська інженерія' },
    description: {
      en: 'Italian suspension manufacturer with WME, WMB and XXF series for sport, touring and adventure bikes.',
      ua: 'Італійський виробник підвіски з серіями WME, WMB та XXF для спортів, турерів та адвенчурів.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Nitron',
    country: '🇬🇧 UK',
    specialty: { en: 'British Precision', ua: 'Британська точність' },
    description: {
      en: 'British suspension specialist. NTR R1 and R3 shocks with trackside revalving and rebuild services.',
      ua: 'Британський спеціаліст підвіски. Амортизатори NTR R1 та R3 з можливістю ревалвінгу та обслуговування на треку.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'K-Tech',
    country: '🇬🇧 UK',
    specialty: { en: 'BSB Proven', ua: 'Перевірено BSB' },
    description: {
      en: 'British Superbike Championship proven suspension. DDS and Razor shocks, cartridge fork kits.',
      ua: 'Підвіска, перевірена British Superbike Championship. Амортизатори DDS та Razor, картриджні кіти вилок.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'WP Suspension',
    country: '🇦🇹 Austria',
    specialty: { en: 'KTM Partner', ua: 'Партнер KTM' },
    description: {
      en: 'Official KTM suspension partner. XACT PRO components, cone valve technology for off-road and street.',
      ua: 'Офіційний партнер підвіски KTM. Компоненти XACT PRO, технологія конусних клапанів для off-road та вулиці.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Andreani',
    country: '🇮🇹 Italy',
    specialty: { en: 'Cartridge Kits', ua: 'Картриджні кіти' },
    description: {
      en: 'Italian suspension tuning specialist. Misano Evo cartridge kits and factory shock rebuilds.',
      ua: 'Італійський спеціаліст тюнінгу підвіски. Картриджні кіти Misano Evo та заводське відновлення амортизаторів.',
    },
    accentColor: 'from-violet-500/30 to-purple-500/20',
  },
  {
    name: 'HyperPro',
    country: '🇳🇱 Netherlands',
    specialty: { en: 'Progressive Springs', ua: 'Прогресивні пружини' },
    description: {
      en: 'Dutch suspension specialist known for progressive springs and RSC shocks for improved comfort and control.',
      ua: 'Голландський спеціаліст підвіски, відомий прогресивними пружинами та амортизаторами RSC для комфорту та контролю.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Showa',
    country: '🇯🇵 Japan',
    specialty: { en: 'OEM Excellence', ua: 'OEM досконалість' },
    description: {
      en: 'Japanese OEM supplier to Honda, Kawasaki and Suzuki. BPF and SFF-BP forks for racing applications.',
      ua: 'Японський OEM постачальник Honda, Kawasaki та Suzuki. Вилки BPF та SFF-BP для гоночних застосувань.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
];

const suspensionTypes = [
  {
    name: { en: 'Front Fork Cartridges', ua: 'Картриджі передньої вилки' },
    description: {
      en: 'Pressurized or open cartridge kits that replace stock internals for adjustable damping.',
      ua: 'Газові або відкриті картриджні кіти на заміну стокових внутрішностей для регульованого демпфування.',
    },
    icon: Wrench,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Rear Shocks', ua: 'Задні амортизатори' },
    description: {
      en: 'Fully adjustable mono-shocks with high/low speed compression and rebound control.',
      ua: 'Повністю регульовані моноамортизатори з контролем стиснення на високій/низькій швидкості та відбоєм.',
    },
    icon: Cog,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Complete Fork Assemblies', ua: 'Повні вилки в зборі' },
    description: {
      en: 'Race-spec fork assemblies with prestige internals and custom spring rates.',
      ua: 'Гоночні вилки в зборі з преміальними внутрішностями та кастомними пружинами.',
    },
    icon: Trophy,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Steering Dampers', ua: 'Стабілізатори керма' },
    description: {
      en: 'Rotary and linear steering dampers for high-speed stability and headshake prevention.',
      ua: 'Ротаційні та лінійні стабілізатори керма для стабільності на швидкості та запобігання розгойдуванню.',
    },
    icon: Target,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Lowering & Raising Kits', ua: 'Комплекти заниження/підняття' },
    description: {
      en: 'Ride height adjusters and dog-bone links for custom ergonomics and stance.',
      ua: 'Регулятори висоти посадки та лінки для кастомної ергономіки та стійки.',
    },
    icon: ArrowUpDown,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Suspension Service', ua: 'Сервіс підвіски' },
    description: {
      en: 'Fork and shock rebuilds, revalving, spring changes and dyno testing.',
      ua: 'Ребілд вилок та амортизаторів, ревалвінг, заміна пружин та діно-тестування.',
    },
    icon: Microscope,
    color: 'text-orange-400',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Aluminum Billet', ua: 'Білетний алюміній' },
    description: { en: 'CNC-machined fork clamps and shock bodies', ua: 'CNC-оброблені кріплення вилок та корпуси амортизаторів' },
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: { en: 'Titanium Springs', ua: 'Титанові пружини' },
    description: { en: '30% lighter than steel with identical rates', ua: 'На 30% легше сталі з однаковими характеристиками' },
    color: 'from-blue-400 to-purple-500',
  },
  {
    name: { en: 'Chrome Steel', ua: 'Хромована сталь' },
    description: { en: 'Fork tubes and piston rods for smooth action', ua: 'Труби вилок та штоки для плавної роботи' },
    color: 'from-gray-500 to-gray-700',
  },
  {
    name: { en: 'Teflon Bushings', ua: 'Тефлонові втулки' },
    description: { en: 'Low-friction internal components', ua: 'Внутрішні компоненти з низьким тертям' },
    color: 'from-emerald-400 to-teal-500',
  },
];

export default function MotoSuspensionCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof suspensionBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Moto Category', ua: 'Мото категорія' },
      title: { en: 'Suspension & Chassis', ua: 'Підвіска та шасі' },
      subtitle: {
        en: 'Cartridge kits, fully adjustable forks and rear shocks with dyno-driven shim stacks. From street comfort to race-spec compression and rebound control.',
        ua: 'Картриджі, повністю регульовані вилки та задні амортизатори з діно-підбором шайб. Від вуличного комфорту до трекового контролю стиснення та відбою.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-950/30 via-black to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-yellow-400/80 sm:text-xs">
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
            {suspensionTypes.map((type, i) => (
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
            {suspensionBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Потрібна настройка підвіски?' : 'Need suspension setup?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо підбору підвіски під ваш стиль їзди та вагу.'
                : 'Contact us for a consultation on suspension selection for your riding style and weight.'}
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
