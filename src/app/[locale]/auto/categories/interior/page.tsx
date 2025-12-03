// src/app/[locale]/auto/categories/interior/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';

type Locale = 'en' | 'ua';

// Custom SVG Icons for Interior
const CarbonIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 8L16 16M16 8L8 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const LeatherIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 9C7 7.34315 8.34315 6 10 6H14C15.6569 6 17 7.34315 17 9V15C17 16.6569 15.6569 18 14 18H10C8.34315 18 7 16.6569 7 15V9Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 10H15M9 12H15M9 14H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const AlcantaraIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L14 8L19 9L15 13L16 18L12 16L8 18L9 13L5 9L10 8L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const SeatIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 20V10C6 8.89543 6.89543 8 8 8H16C17.1046 8 18 8.89543 18 10V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M4 20H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const SteeringWheelIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 3V9M12 15V21M3 12H9M15 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const RollCageIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 4V20M16 4V20M4 8H20M4 16H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const interiorBrands = [
  {
    name: 'Brabus',
    country: '🇩🇪 Germany',
    specialty: { en: 'Mercedes Luxury', ua: 'Mercedes Лакшері' },
    description: {
      en: 'Complete interior transformations for Mercedes with finest leather, Alcantara and carbon fiber throughout.',
      ua: 'Повні інтер\'єрні трансформації для Mercedes з найкращою шкірою, алькантарою та карбоном.',
    },
    featured: true,
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Mansory',
    country: '🇩🇪 Germany',
    specialty: { en: 'Ultra Luxury', ua: 'Ультра Лакшері' },
    description: {
      en: 'Ultra-luxury interior packages with exotic materials, custom stitching and forged carbon accents.',
      ua: 'Ультра-лакшері інтер\'єрні пакети з екзотичними матеріалами, кастомним шиттям та кованим карбоном.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Vilner',
    country: '🇧🇬 Bulgaria',
    specialty: { en: 'Custom Design', ua: 'Кастом дизайн' },
    description: {
      en: 'Bespoke interior design studio known for creative leather work and complete cabin transformations.',
      ua: 'Bespoke студія інтер\'єрного дизайну, відома креативною роботою зі шкірою та повними трансформаціями салону.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'Carlex Design',
    country: '🇵🇱 Poland',
    specialty: { en: 'Interior Art', ua: 'Інтер\'єрне мистецтво' },
    description: {
      en: 'Artistic interior designs combining traditional craftsmanship with modern technology and materials.',
      ua: 'Мистецькі інтер\'єрні дизайни, що поєднують традиційну майстерність з сучасними технологіями та матеріалами.',
    },
    accentColor: 'from-teal-500/30 to-cyan-500/20',
  },
  {
    name: 'Kahn Design',
    country: '🇬🇧 UK',
    specialty: { en: 'British Luxury', ua: 'Британський Лакшері' },
    description: {
      en: 'British luxury interiors with quilted leather, bespoke colors and premium trim pieces.',
      ua: 'Британські лакшері інтер\'єри зі стьобаною шкірою, bespoke кольорами та преміальним оздобленням.',
    },
    accentColor: 'from-blue-500/30 to-indigo-500/20',
  },
  {
    name: 'Neidfaktor',
    country: '🇩🇪 Germany',
    specialty: { en: 'OEM+ Quality', ua: 'OEM+ якість' },
    description: {
      en: 'OEM+ interior upgrades that look factory-installed with premium leather and Alcantara work.',
      ua: 'OEM+ інтер\'єрні апгрейди, що виглядають як заводські, з преміальною шкірою та алькантарою.',
    },
    accentColor: 'from-emerald-500/30 to-green-500/20',
  },
  {
    name: 'Alcantara',
    country: '🇮🇹 Italy',
    specialty: { en: 'Suede Material', ua: 'Замшеві матеріали' },
    description: {
      en: 'The original Italian suede-like material used by OEMs and tuners worldwide for premium interiors.',
      ua: 'Оригінальний італійський замшеподібний матеріал, що використовується OEM та тюнерами по всьому світу.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Schroth',
    country: '🇩🇪 Germany',
    specialty: { en: 'Racing Harness', ua: 'Гоночні паси' },
    description: {
      en: 'FIA-certified racing harnesses and safety equipment for track and street applications.',
      ua: 'FIA-сертифіковані гоночні паси та обладнання безпеки для треку та вулиці.',
    },
    accentColor: 'from-red-500/30 to-orange-500/20',
  },
  {
    name: 'Recaro',
    country: '🇩🇪 Germany',
    specialty: { en: 'Sport Seats', ua: 'Спортивні сидіння' },
    description: {
      en: 'Legendary German sport seat manufacturer with OEM partnerships and aftermarket performance seats.',
      ua: 'Легендарний німецький виробник спортивних сидінь з OEM партнерствами та aftermarket сидіннями.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Sparco',
    country: '🇮🇹 Italy',
    specialty: { en: 'Motorsport', ua: 'Мотоспорт' },
    description: {
      en: 'Italian motorsport brand with racing seats, steering wheels and interior safety equipment.',
      ua: 'Італійський мотоспорт бренд з гоночними сидіннями, кермами та обладнанням безпеки.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
];

const interiorTypes = [
  {
    name: { en: 'Carbon Trim', ua: 'Карбонове оздоблення' },
    description: {
      en: 'Carbon fiber interior trim panels, console covers and dashboard accents in various weave patterns.',
      ua: 'Карбонові інтер\'єрні панелі, накладки консолі та акценти приладової панелі різних текстур.',
    },
    icon: CarbonIcon,
    color: 'text-zinc-400',
  },
  {
    name: { en: 'Custom Leather', ua: 'Кастомна шкіра' },
    description: {
      en: 'Complete leather retrim with custom colors, stitching patterns and exotic leather options.',
      ua: 'Повна перетяжка шкірою з кастомними кольорами, візерунками шиття та екзотичною шкірою.',
    },
    icon: LeatherIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Alcantara Work', ua: 'Алькантара' },
    description: {
      en: 'Alcantara headliner, door panels, steering wheel and trim upgrades for sporty luxury feel.',
      ua: 'Алькантара на стелі, дверних панелях, кермі та оздобленні для спортивного лакшері відчуття.',
    },
    icon: AlcantaraIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Sport Seats', ua: 'Спортивні сидіння' },
    description: {
      en: 'Aftermarket sport and racing bucket seats with improved bolstering and weight savings.',
      ua: 'Aftermarket спортивні та гоночні ковші з покращеною боковою підтримкою та зниженою вагою.',
    },
    icon: SeatIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Steering Wheels', ua: 'Кермові колеса' },
    description: {
      en: 'Custom steering wheels with carbon fiber, Alcantara wrap and performance features.',
      ua: 'Кастомні кермові колеса з карбоном, обшивкою алькантарою та performance функціями.',
    },
    icon: SteeringWheelIcon,
    color: 'text-emerald-400',
  },
  {
    name: { en: 'Roll Cages', ua: 'Каркаси безпеки' },
    description: {
      en: 'FIA-certified roll cages and harness bars for track safety and structural rigidity.',
      ua: 'FIA-сертифіковані каркаси безпеки та harness бари для безпеки на треку та жорсткості кузова.',
    },
    icon: RollCageIcon,
    color: 'text-cyan-400',
  },
];

export default function InteriorCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof interiorBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Interior & Trim', ua: 'Інтер\'єр та оздоблення' },
      subtitle: {
        en: 'Premium leather, Alcantara, carbon fiber trim and bespoke interior transformations. From subtle OEM+ upgrades to complete cabin makeovers.',
        ua: 'Преміальна шкіра, алькантара, карбонове оздоблення та bespoke інтер\'єрні трансформації. Від OEM+ апгрейдів до повних перетворень салону.',
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
        <div className="absolute inset-0 bg-gradient-to-br from-rose-950/30 via-black to-purple-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/10 via-transparent to-transparent" />
        
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-rose-400/80 sm:text-xs">
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
            {interiorTypes.map((type, i) => (
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
            {interiorBrands.map((brand, i) => (
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
              {locale === 'ua' ? 'Мрієте про ідеальний інтер\'єр?' : 'Dreaming of the perfect interior?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо кастомізації інтер\'єру вашого автомобіля.'
                : 'Contact us for a consultation on customizing your vehicle interior.'}
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
