// src/app/[locale]/auto/categories/exhaust/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { ExhaustSystemIcon, MufflerIcon, CatIcon, TurboIcon, EngineIcon, SpoilerIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

// Exhaust brands with detailed info
const exhaustBrands = [
  {
    name: 'Akrapovic',
    country: '🇸🇮 Slovenia',
    specialty: { en: 'Titanium Systems', ua: 'Титанові системи' },
    description: {
      en: 'World-renowned for MotoGP and F1 heritage. Titanium and carbon fiber exhausts with signature sound.',
      ua: 'Світовий лідер з MotoGP та F1 спадщиною. Титанові та карбонові системи з фірмовим звуком.',
    },
    featured: true,
    accentColor: 'from-red-500/30 to-orange-500/20',
  },
  {
    name: 'Armytrix',
    country: '🇹🇼 Taiwan',
    specialty: { en: 'Valvetronic', ua: 'Клапанні системи' },
    description: {
      en: 'Pioneers of smartphone-controlled valvetronic exhaust technology with aggressive sound modes.',
      ua: 'Піонери смартфон-керованих клапанних систем з агресивними режимами звуку.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'Capristo',
    country: '🇩🇪 Germany',
    specialty: { en: 'Supercar Specialist', ua: 'Спеціаліст суперкарів' },
    description: {
      en: 'Bespoke exhaust systems for Ferrari, Lamborghini, McLaren with remote valve control.',
      ua: 'Індивідуальні системи для Ferrari, Lamborghini, McLaren з дистанційним керуванням клапанами.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'FI Exhaust',
    country: '🇹🇼 Taiwan',
    specialty: { en: 'Frequency Intelligent', ua: 'Частотний інтелект' },
    description: {
      en: 'Frequency Intelligent technology for perfect sound tuning. Premium finishes and exotic materials.',
      ua: 'Технологія частотного інтелекту для ідеального налаштування звуку. Преміальні фініші.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'Ryft',
    country: '🇺🇸 USA',
    specialty: { en: 'American Power', ua: 'Американська потужність' },
    description: {
      en: 'High-flow systems designed for maximum power gains on American muscle and European sports cars.',
      ua: 'Високопродуктивні системи для максимального приросту потужності на американських та європейських авто.',
    },
    accentColor: 'from-red-600/30 to-rose-500/20',
  },
  {
    name: 'Tubi Style',
    country: '🇮🇹 Italy',
    specialty: { en: 'Italian Craftsmanship', ua: 'Італійська майстерність' },
    description: {
      en: 'Hand-crafted in Italy since 1978. Iconic sound for Ferrari, Maserati, Porsche and more.',
      ua: 'Ручна робота в Італії з 1978 року. Легендарний звук для Ferrari, Maserati, Porsche.',
    },
    accentColor: 'from-emerald-500/30 to-teal-500/20',
  },
  {
    name: 'Fabspeed',
    country: '🇺🇸 USA',
    specialty: { en: 'Track Performance', ua: 'Трекова продуктивність' },
    description: {
      en: 'Competition-proven exhaust systems with dyno-verified power gains and track-ready durability.',
      ua: 'Перевірені на змаганнях системи з підтвердженим приростом потужності та трековою надійністю.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Supersprint',
    country: '🇮🇹 Italy',
    specialty: { en: 'European Excellence', ua: 'Європейська якість' },
    description: {
      en: 'Over 65 years of Italian exhaust engineering. Complete systems for BMW, Mercedes, Audi.',
      ua: 'Понад 65 років італійського інжинірингу. Повні системи для BMW, Mercedes, Audi.',
    },
    accentColor: 'from-violet-500/30 to-indigo-500/20',
  },
  {
    name: 'iPE',
    country: '🇹🇼 Taiwan',
    specialty: { en: 'Innotech Performance', ua: 'Innotech Performance' },
    description: {
      en: 'Premium valvetronic systems with titanium options and smartphone app control.',
      ua: 'Преміальні клапанні системи з титановими опціями та керуванням через смартфон.',
    },
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Milltek',
    country: '🇬🇧 UK',
    specialty: { en: 'British Engineering', ua: 'Британський інжиніринг' },
    description: {
      en: 'Precision-engineered cat-back and turbo-back systems with EC type approval.',
      ua: 'Точно спроєктовані cat-back та turbo-back системи з EC сертифікацією.',
    },
    accentColor: 'from-rose-500/30 to-red-500/20',
  },
  {
    name: 'Borla',
    country: '🇺🇸 USA',
    specialty: { en: 'American Legend', ua: 'Американська легенда' },
    description: {
      en: 'Since 1978, T-304 stainless steel systems with ATAK, S-Type and Touring sound levels.',
      ua: 'З 1978 року, системи з нержавіючої сталі T-304 з рівнями звуку ATAK, S-Type, Touring.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'Remus',
    country: '🇦🇹 Austria',
    specialty: { en: 'Austrian Precision', ua: 'Австрійська точність' },
    description: {
      en: 'TÜV-approved sport exhaust systems with EC homologation and signature racing sound.',
      ua: 'TÜV-сертифіковані спортивні системи з EC гомологацією та фірмовим гоночним звуком.',
    },
    accentColor: 'from-lime-500/30 to-green-500/20',
  },
];

// Exhaust types/categories
const exhaustTypes = [
  {
    name: { en: 'Cat-Back Systems', ua: 'Cat-Back системи' },
    description: {
      en: 'Complete replacement from catalytic converter to tailpipes. Optimal balance of sound and performance.',
      ua: 'Повна заміна від каталізатора до вихлопних труб. Оптимальний баланс звуку та продуктивності.',
    },
    icon: ExhaustSystemIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Downpipes', ua: 'Даунпайпи' },
    description: {
      en: 'High-flow downpipes for turbocharged engines. Significant power gains with reduced backpressure.',
      ua: 'Високопродуктивні даунпайпи для турбо двигунів. Значний приріст потужності зі зменшенням опору.',
    },
    icon: TurboIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Headers & Manifolds', ua: 'Колектори' },
    description: {
      en: 'Equal-length headers and performance manifolds for naturally aspirated power delivery.',
      ua: 'Рівнодовгі колектори для атмосферних двигунів з покращеною віддачею потужності.',
    },
    icon: EngineIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Valvetronic Systems', ua: 'Клапанні системи' },
    description: {
      en: 'Electronically controlled valves for on-demand sound adjustment. Quiet to aggressive at a button press.',
      ua: 'Електронно керовані клапани для налаштування звуку. Від тихого до агресивного одним натиском.',
    },
    icon: MufflerIcon,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Titanium Systems', ua: 'Титанові системи' },
    description: {
      en: 'Lightweight titanium construction with weight savings up to 50%. Ultimate performance choice.',
      ua: 'Легкі титанові конструкції зі зменшенням ваги до 50%. Найвищий вибір для продуктивності.',
    },
    icon: SpoilerIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Race Systems', ua: 'Гоночні системи' },
    description: {
      en: 'Track-only systems without catalytic converters. Maximum flow and power for competition use.',
      ua: 'Трекові системи без каталізаторів. Максимальний потік та потужність для змагань.',
    },
    icon: CatIcon,
    color: 'text-emerald-400',
  },
];

// Materials info
const materials = [
  {
    name: { en: 'Titanium', ua: 'Титан' },
    description: { en: '40-50% lighter than steel, extreme heat resistance', ua: 'На 40-50% легше сталі, екстремальна термостійкість' },
    color: 'from-blue-400 to-purple-500',
  },
  {
    name: { en: 'Inconel', ua: 'Інконель' },
    description: { en: 'Superalloy for F1 & aerospace, 1000°C+ tolerance', ua: 'Суперсплав для F1 та космосу, витримує 1000°C+' },
    color: 'from-orange-400 to-red-500',
  },
  {
    name: { en: 'T-304 Stainless', ua: 'Нержавіюча T-304' },
    description: { en: 'Industry standard, corrosion resistant, durable', ua: 'Галузевий стандарт, корозійностійка, довговічна' },
    color: 'from-zinc-400 to-zinc-600',
  },
  {
    name: { en: 'Carbon Fiber', ua: 'Карбон' },
    description: { en: 'Premium tips and heat shields, lightweight styling', ua: 'Преміальні насадки та теплозахист, легкий стайлінг' },
    color: 'from-gray-800 to-black',
  },
];

export default function ExhaustCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof exhaustBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Exhaust Systems', ua: 'Системи випуску' },
      subtitle: {
        en: 'Valved cat-backs, titanium downpipes and Inconel manifolds. Dyno-tuned for power gains and signature sound.',
        ua: 'Клапанні катбеки з нержавіючої сталі, титану та інконель, випускні колектори. Налаштовані на стендах для приросту потужності та фірмового тембру.',
      },
    },
    sections: {
      brands: { en: 'Featured Brands', ua: 'Провідні бренди' },
      types: { en: 'System Types', ua: 'Типи систем' },
      materials: { en: 'Materials', ua: 'Матеріали' },
      cta: { en: 'Request Quote', ua: 'Запросити ціну' },
    },
    back: { en: '← Back to Auto', ua: '← Назад до Авто' },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-orange-950/20" />
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

      {/* Exhaust Types Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.types[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exhaustTypes.map((type, i) => (
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
            {exhaustBrands.map((brand, i) => (
              <motion.button
                key={brand.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                onClick={() => setSelectedBrand(brand)}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 p-6 text-left transition-all duration-300 hover:border-white/20 ${
                  brand.featured ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${brand.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative">
                  <div className="flex items-center mb-4">
                    <span className="text-xs text-white/50">{brand.country}</span>
                  </div>
                  
                  <div className="relative h-16 mb-4">
                    {/* Radial backlight for dark logos - intensified */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-[120%] h-[120%] transition-all duration-500 ${
                        isDarkLogo(getBrandLogo(brand.name))
                          ? 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.9)_0%,_rgba(255,255,255,0.6)_40%,_transparent_70%)]' 
                          : 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.3)_0%,_rgba(255,255,255,0.1)_50%,_transparent_70%)]'
                      }`} />
                    </div>
                    <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.3))' }}>
                      <Image
                        src={getBrandLogo(brand.name)}
                        alt={brand.name}
                        fill
                        className="object-contain object-center transition-all duration-300 group-hover:scale-110"
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
                ? 'Зв\'яжіться з нами для консультації щодо вибору оптимальної системи випуску для вашого автомобіля.'
                : 'Contact us for a consultation on choosing the optimal exhaust system for your vehicle.'}
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
                  <div className={`w-[120%] h-[120%] ${
                    isDarkLogo(getBrandLogo(selectedBrand.name))
                      ? 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.9)_0%,_rgba(255,255,255,0.6)_40%,_transparent_70%)]' 
                      : 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.3)_0%,_rgba(255,255,255,0.1)_50%,_transparent_70%)]'
                  }`} />
                </div>
                <Image
                  src={getBrandLogo(selectedBrand.name)}
                  alt={selectedBrand.name}
                  fill
                  className="object-contain object-left"
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
