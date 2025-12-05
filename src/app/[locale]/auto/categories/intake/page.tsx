// src/app/[locale]/auto/categories/intake/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { Wind, Fan, Filter, MoveRight, Zap, Activity } from 'lucide-react';

type Locale = 'en' | 'ua';

const intakeBrands = [
  {
    name: 'Eventuri',
    country: '🇬🇧 UK',
    specialty: { en: 'Carbon Intakes', ua: 'Карбонові впуски' },
    description: {
      en: 'Premium carbon fiber intakes with venturi velocity stack design. Handcrafted in the UK with aerospace-grade materials.',
      ua: 'Преміальні карбонові впуски з дизайном вентурі. Ручна робота у Великобританії з аерокосмічних матеріалів.',
    },
    featured: true,
    accentColor: 'from-cyan-500/30 to-blue-500/20',
  },
  {
    name: 'Gruppe-M',
    country: '🇯🇵 Japan',
    specialty: { en: 'Ram Air', ua: 'Ram Air' },
    description: {
      en: 'Japanese precision engineering. Ram Air systems with carbon fiber construction and heat shields.',
      ua: 'Японська точна інженерія. Системи Ram Air з карбоновою конструкцією та теплозахистом.',
    },
    accentColor: 'from-red-500/30 to-orange-500/20',
  },
  {
    name: 'BMC',
    country: '🇮🇹 Italy',
    specialty: { en: 'Air Filters', ua: 'Повітряні фільтри' },
    description: {
      en: 'Italian filter technology used in F1 and MotoGP. High-flow cotton gauze filters with lifetime warranty.',
      ua: 'Італійська технологія фільтрів для F1 та MotoGP. Високопродуктивні бавовняні фільтри з довічною гарантією.',
    },
    accentColor: 'from-red-600/30 to-rose-500/20',
  },
  {
    name: 'ARMA Speed',
    country: '🇹🇼 Taiwan',
    specialty: { en: 'Carbon Systems', ua: 'Карбонові системи' },
    description: {
      en: 'Full carbon fiber intake systems with OEM-fit precision and aggressive styling.',
      ua: 'Повні карбонові впускні системи з OEM точністю та агресивним стайлінгом.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Alpha-N',
    country: '🇩🇪 Germany',
    specialty: { en: 'German Engineering', ua: 'Німецький інжиніринг' },
    description: {
      en: 'German-engineered carbon intakes with dyno-proven power gains and perfect OEM integration.',
      ua: 'Німецькі карбонові впуски з підтвердженим на стенді приростом потужності та ідеальною OEM інтеграцією.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'MST Performance',
    country: '🇹🇼 Taiwan',
    specialty: { en: 'Cold Air', ua: 'Cold Air' },
    description: {
      en: 'Cold air intake specialists with sealed airbox designs for maximum temperature reduction.',
      ua: 'Спеціалісти з холодних впусків із герметичними повітрозбірниками для максимального зниження температури.',
    },
    accentColor: 'from-blue-500/30 to-sky-500/20',
  },
  {
    name: 'do88',
    country: '🇸🇪 Sweden',
    specialty: { en: 'Charge Pipes', ua: 'Charge Pipes' },
    description: {
      en: 'Swedish precision. Silicone hoses, charge pipes and intercooler upgrades for turbocharged platforms.',
      ua: 'Шведська точність. Силіконові патрубки, charge pipes та інтеркулери для турбованих платформ.',
    },
    accentColor: 'from-yellow-500/30 to-amber-500/20',
  },
  {
    name: 'Karbonius',
    country: '🇵🇱 Poland',
    specialty: { en: 'Carbon Fiber', ua: 'Карбон' },
    description: {
      en: 'Handcrafted carbon fiber intakes with exposed weave finish and competition-proven performance.',
      ua: 'Карбонові впуски ручної роботи з відкритим плетінням та перевіреною на змаганнях продуктивністю.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
];

const intakeTypes = [
  {
    name: { en: 'Cold Air Intakes', ua: 'Холодні впуски' },
    description: {
      en: 'Sealed airbox systems that draw cooler air from outside the engine bay for denser air charge.',
      ua: 'Герметичні системи, що забирають холодніше повітря ззовні моторного відсіку для щільнішого заряду.',
    },
    icon: Wind,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Carbon Velocity Stacks', ua: 'Карбонові воронки' },
    description: {
      en: 'Venturi-shaped carbon fiber stacks that accelerate and smooth airflow into the throttle body.',
      ua: 'Вентурі-подібні карбонові воронки, що прискорюють і згладжують потік повітря до дроселя.',
    },
    icon: Fan,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Ram Air Systems', ua: 'Ram Air системи' },
    description: {
      en: 'Dynamic pressure intakes that force air into the engine at speed for increased volumetric efficiency.',
      ua: 'Динамічні впуски, що нагнітають повітря в двигун на швидкості для збільшення об\'ємної ефективності.',
    },
    icon: Filter,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Charge Pipes', ua: 'Charge Pipes' },
    description: {
      en: 'Upgraded boost pipes with larger diameter and smoother bends for turbocharged applications.',
      ua: 'Апгрейдовані буст-патрубки з більшим діаметром та плавнішими вигинами для турбо застосувань.',
    },
    icon: MoveRight,
    color: 'text-amber-400',
  },
  {
    name: { en: 'High-Flow Filters', ua: 'Високопродуктивні фільтри' },
    description: {
      en: 'Reusable cotton gauze or foam filters with improved airflow and filtration efficiency.',
      ua: 'Багаторазові бавовняні або поролонові фільтри з покращеним потоком та ефективністю фільтрації.',
    },
    icon: Zap,
    color: 'text-red-400',
  },
  {
    name: { en: 'Heat Shields', ua: 'Теплозахист' },
    description: {
      en: 'Thermal barriers that isolate the intake from engine heat for consistent inlet temperatures.',
      ua: 'Термобар\'єри, що ізолюють впуск від тепла двигуна для стабільних температур на вході.',
    },
    icon: Activity,
    color: 'text-emerald-400',
  },
];

export default function IntakeCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof intakeBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Air Intake', ua: 'Впускна система' },
      subtitle: {
        en: 'Carbon velocity stacks, sealed intakes and charge pipes that stabilise IAT and airflow on tuned platforms. Ideal for turbo upgrades and track cars.',
        ua: 'Карбонові тракти, герметичні впуски та пайпінг для стабільних температур і потоку на тюнінгованих авто. Ідеально для апгрейду турбо та трекових авто.',
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
            {intakeTypes.map((type, i) => (
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
            {intakeBrands.map((brand, i) => (
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
                    {/* Radial white backlight for dark logos */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[120%] h-[120%] bg-[radial-gradient(circle,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0.04)_40%,_transparent_70%)] group-hover:bg-[radial-gradient(circle,_rgba(255,255,255,0.18)_0%,_rgba(255,255,255,0.08)_40%,_transparent_70%)] transition-all duration-500 rounded-full" />
                    </div>
                    
                    <div className="relative w-full h-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-all duration-500">
                      <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
                        <Image
                          src={getBrandLogo(brand.name)}
                          alt={brand.name}
                          fill
                          className="object-contain object-center transition-all duration-300 group-hover:scale-110"
                          unoptimized
                        />
                      </div>
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
                ? 'Зв\'яжіться з нами для консультації щодо вибору оптимальної впускної системи для вашого автомобіля.'
                : 'Contact us for a consultation on choosing the optimal intake system for your vehicle.'}
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
                {/* Radial backlight for dark logos */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[120%] h-[120%] bg-[radial-gradient(circle,_rgba(255,255,255,0.12)_0%,_rgba(255,255,255,0.04)_40%,_transparent_70%)] rounded-full" />
                </div>
                <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}>
                  <Image
                    src={getBrandLogo(selectedBrand.name)}
                    alt={selectedBrand.name}
                    fill
                    className="object-contain object-left"
                    unoptimized
                  />
                </div>
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
