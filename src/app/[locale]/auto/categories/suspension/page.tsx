// src/app/[locale]/auto/categories/suspension/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { ShockAbsorberIcon, CoiloverIcon, SwaybарIcon, BrakeDiscIcon, WheelIcon, TireIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const suspensionBrands = [
  {
    name: 'KW Suspensions',
    country: '🇩🇪 Germany',
    specialty: { en: 'Coilovers', ua: 'Койловери' },
    description: {
      en: 'German engineering excellence in adjustable coilovers. V1, V2, V3, V4, Clubsport and Competition lines for street and track.',
      ua: 'Німецька інженерна досконалість регульованих койловерів. Лінійки V1, V2, V3, V4, Clubsport та Competition для вулиці та треку.',
    },
    featured: true,
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Öhlins',
    country: '🇸🇪 Sweden',
    specialty: { en: 'Motorsport', ua: 'Мотоспорт' },
    description: {
      en: 'Swedish motorsport suspension legends. Road & Track, DFV technology and TTX dampers for ultimate performance.',
      ua: 'Шведські легенди мотоспорт підвіски. Road & Track, технологія DFV та демпфери TTX для максимальної продуктивності.',
    },
    accentColor: 'from-yellow-500/30 to-amber-500/20',
  },
  {
    name: 'Bilstein',
    country: '🇩🇪 Germany',
    specialty: { en: 'OEM Partner', ua: 'OEM партнер' },
    description: {
      en: 'OEM partner for Porsche, Ferrari, Mercedes-AMG. B6, B8, B12, B14, B16 kits and motorsport dampers.',
      ua: 'OEM партнер Porsche, Ferrari, Mercedes-AMG. Комплекти B6, B8, B12, B14, B16 та мотоспорт демпфери.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'H&R',
    country: '🇩🇪 Germany',
    specialty: { en: 'Springs & Spacers', ua: 'Пружини та проставки' },
    description: {
      en: 'World leader in sport springs, spacers and coilovers. OE Sport, Sport, Super Sport and Race spring options.',
      ua: 'Світовий лідер спортивних пружин, проставок та койловерів. Опції OE Sport, Sport, Super Sport та Race.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Eibach',
    country: '🇩🇪 Germany',
    specialty: { en: 'Performance Springs', ua: 'Performance пружини' },
    description: {
      en: 'Pro-Kit, Sportline and Multi-Pro-R coilovers. Anti-roll bars and complete suspension packages.',
      ua: 'Койловери Pro-Kit, Sportline та Multi-Pro-R. Стабілізатори та комплексні пакети підвіски.',
    },
    accentColor: 'from-green-500/30 to-emerald-500/20',
  },
  {
    name: 'Air Lift Performance',
    country: '🇺🇸 USA',
    specialty: { en: 'Air Suspension', ua: 'Пневмопідвіска' },
    description: {
      en: 'Premium air suspension systems with 3P and 3H management. Performance Series struts for ultimate stance.',
      ua: 'Преміальні пневмопідвіски з 3P та 3H управлінням. Стійки Performance Series для ідеальної стійки.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Tein',
    country: '🇯🇵 Japan',
    specialty: { en: 'JDM Coilovers', ua: 'JDM койловери' },
    description: {
      en: 'Japanese coilover specialists. Flex Z, Street Basis, Mono Sport and Super Racing lines.',
      ua: 'Японські спеціалісти койловерів. Лінійки Flex Z, Street Basis, Mono Sport та Super Racing.',
    },
    accentColor: 'from-rose-500/30 to-pink-500/20',
  },
  {
    name: 'BC Racing',
    country: '🇹🇼 Taiwan',
    specialty: { en: 'Value Coilovers', ua: 'Доступні койловери' },
    description: {
      en: 'Value-oriented coilovers with BR, DS, DR, ER and RM series for street and drift applications.',
      ua: 'Доступні койловери з серіями BR, DS, DR, ER та RM для вулиці та дрифту.',
    },
    accentColor: 'from-violet-500/30 to-purple-500/20',
  },
  {
    name: 'Whiteline',
    country: '🇦🇺 Australia',
    specialty: { en: 'Chassis Parts', ua: 'Деталі шасі' },
    description: {
      en: 'Australian suspension component specialists. Sway bars, bushings, alignment parts and chassis bracing.',
      ua: 'Австралійські спеціалісти компонентів підвіски. Стабілізатори, втулки, деталі розвалу та підсилення шасі.',
    },
    accentColor: 'from-teal-500/30 to-cyan-500/20',
  },
  {
    name: 'Powerflex',
    country: '🇬🇧 UK',
    specialty: { en: 'Poly Bushings', ua: 'Полі втулки' },
    description: {
      en: 'British polyurethane bushing specialists. Street and race compounds for improved handling response.',
      ua: 'Британські спеціалісти поліуретанових втулок. Вуличні та гоночні склади для покращеного відгуку керування.',
    },
    accentColor: 'from-indigo-500/30 to-blue-500/20',
  },
];

const suspensionTypes = [
  {
    name: { en: 'Coilovers', ua: 'Койловери' },
    description: {
      en: 'Fully adjustable height and damping coilover kits for street, track and competition use.',
      ua: 'Повністю регульовані по висоті та жорсткості койловери для вулиці, треку та змагань.',
    },
    icon: BrakeDiscIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Air Suspension', ua: 'Пневмопідвіска' },
    description: {
      en: 'Adjustable air suspension systems with digital management for ultimate stance flexibility.',
      ua: 'Регульовані пневмопідвіски з цифровим управлінням для максимальної гнучкості стійки.',
    },
    icon: CoiloverIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Lowering Springs', ua: 'Занижуючі пружини' },
    description: {
      en: 'Sport springs that lower ride height while maintaining factory damper compatibility.',
      ua: 'Спортивні пружини, що занижують авто зі збереженням сумісності із заводськими амортизаторами.',
    },
    icon: ShockAbsorberIcon,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Sway Bars', ua: 'Стабілізатори' },
    description: {
      en: 'Anti-roll bars that reduce body roll and improve cornering stability and response.',
      ua: 'Стабілізатори поперечної стійкості, що зменшують крени та покращують стабільність у поворотах.',
    },
    icon: SwaybарIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Camber Kits', ua: 'Розвальні важелі' },
    description: {
      en: 'Adjustable camber arms and plates for proper alignment after lowering.',
      ua: 'Регульовані розвальні важелі та пластини для правильного розвалу після заниження.',
    },
    icon: WheelIcon,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Bushings', ua: 'Втулки' },
    description: {
      en: 'Polyurethane and solid bushings for improved suspension response and reduced flex.',
      ua: 'Поліуретанові та суцільні втулки для покращеного відгуку підвіски та зменшення люфтів.',
    },
    icon: TireIcon,
    color: 'text-red-400',
  },
];

export default function SuspensionCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof suspensionBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Suspension', ua: 'Підвіска' },
      subtitle: {
        en: 'Coilovers, air suspension, springs and chassis components from the world\'s leading manufacturers. Engineered for street comfort, track performance or show stance.',
        ua: 'Койловери, пневмопідвіска, пружини та компоненти шасі від провідних світових виробників. Для вуличного комфорту, трекової продуктивності чи шоу стенсу.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/30 via-black to-amber-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-orange-400/80 sm:text-xs">
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
              {locale === 'ua' ? 'Готові покращити керованість?' : 'Ready to improve handling?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо вибору оптимальної підвіски для вашого автомобіля.'
                : 'Contact us for a consultation on choosing the optimal suspension setup for your vehicle.'}
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
