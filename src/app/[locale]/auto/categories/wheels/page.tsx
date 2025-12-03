// src/app/[locale]/auto/categories/wheels/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { WheelIcon, TireIcon, BrakeDiscIcon, CaliperIcon, CoiloverIcon, SpoilerIcon } from '@/components/icons/CategoryIcons';

type Locale = 'en' | 'ua';

const wheelBrands = [
  {
    name: 'HRE Wheels',
    country: '🇺🇸 USA',
    specialty: { en: 'Forged Luxury', ua: 'Ковані лакшері' },
    description: {
      en: 'American forged wheel manufacturer. Classic, Series P, Series S and FlowForm lines for supercars and luxury vehicles.',
      ua: 'Американський виробник кованих дисків. Лінійки Classic, Series P, Series S та FlowForm для суперкарів та лакшері авто.',
    },
    featured: true,
    accentColor: 'from-zinc-400/30 to-zinc-500/20',
  },
  {
    name: 'Vossen Wheels',
    country: '🇺🇸 USA',
    specialty: { en: 'Custom Forged', ua: 'Кастом ковані' },
    description: {
      en: 'Miami-based custom wheel designer. Forged, Hybrid Forged and ERA series with signature concave designs.',
      ua: 'Майамі-базований дизайнер дисків. Серії Forged, Hybrid Forged та ERA з фірмовими вгнутими дизайнами.',
    },
    accentColor: 'from-blue-500/30 to-cyan-500/20',
  },
  {
    name: 'BBS',
    country: '🇩🇪 Germany',
    specialty: { en: 'Motorsport Heritage', ua: 'Мотоспорт спадщина' },
    description: {
      en: 'Legendary German wheel manufacturer. FI-R, RI-A, CI-R forged lines and classic RS/LM designs.',
      ua: 'Легендарний німецький виробник дисків. Ковані лінійки FI-R, RI-A, CI-R та класичні дизайни RS/LM.',
    },
    accentColor: 'from-green-500/30 to-emerald-500/20',
  },
  {
    name: 'OZ Racing',
    country: '🇮🇹 Italy',
    specialty: { en: 'F1 Partner', ua: 'Партнер F1' },
    description: {
      en: 'Italian motorsport wheel supplier to F1 and WRC. Ultraleggera, Superturismo and Racing lines.',
      ua: 'Італійський постачальник дисків для F1 та WRC. Лінійки Ultraleggera, Superturismo та Racing.',
    },
    accentColor: 'from-red-500/30 to-rose-500/20',
  },
  {
    name: 'Rays Engineering',
    country: '🇯🇵 Japan',
    specialty: { en: 'JDM Legend', ua: 'JDM легенда' },
    description: {
      en: 'Japanese forged wheel pioneers. Volk Racing TE37, GT and G-series icons of the automotive world.',
      ua: 'Японські піонери кованих дисків. Volk Racing TE37, GT та G-серії — ікони автосвіту.',
    },
    accentColor: 'from-amber-500/30 to-yellow-500/20',
  },
  {
    name: 'Enkei',
    country: '🇯🇵 Japan',
    specialty: { en: 'Performance Cast', ua: 'Performance лиття' },
    description: {
      en: 'Japanese wheel specialists with MAT technology. RPF1, NT03, and PF series for track and street.',
      ua: 'Японські спеціалісти дисків з технологією MAT. Серії RPF1, NT03 та PF для треку та вулиці.',
    },
    accentColor: 'from-orange-500/30 to-amber-500/20',
  },
  {
    name: 'ADV.1',
    country: '🇺🇸 USA',
    specialty: { en: 'Supercar Forged', ua: 'Суперкар ковані' },
    description: {
      en: 'Miami luxury forged wheel manufacturer specializing in exotic car fitments with track-proven designs.',
      ua: 'Майамі лакшері виробник кованих дисків, що спеціалізується на екзотичних авто з трек-перевіреними дизайнами.',
    },
    accentColor: 'from-purple-500/30 to-pink-500/20',
  },
  {
    name: 'Brixton Forged',
    country: '🇺🇸 USA',
    specialty: { en: 'Modern Design', ua: 'Модерн дизайн' },
    description: {
      en: 'California-based forged wheel manufacturer with distinctive contemporary designs and custom finishes.',
      ua: 'Каліфорнійський виробник кованих дисків з характерними сучасними дизайнами та кастомними фінішами.',
    },
    accentColor: 'from-teal-500/30 to-cyan-500/20',
  },
  {
    name: 'Rotiform',
    country: '🇺🇸 USA',
    specialty: { en: 'Street Culture', ua: 'Вулична культура' },
    description: {
      en: 'California wheel brand rooted in car culture. Cast, Flow Formed and Forged lines with unique designs.',
      ua: 'Каліфорнійський бренд дисків з коренями в автокультурі. Литі, Flow Formed та Ковані лінійки з унікальними дизайнами.',
    },
    accentColor: 'from-sky-500/30 to-blue-500/20',
  },
  {
    name: 'Ferrada',
    country: '🇺🇸 USA',
    specialty: { en: 'Deep Concave', ua: 'Глибоке вгнуття' },
    description: {
      en: 'Miami wheel brand known for aggressive concave profiles and luxury vehicle fitments.',
      ua: 'Майамі бренд дисків, відомий агресивними вгнутими профілями та посадками для лакшері авто.',
    },
    accentColor: 'from-violet-500/30 to-indigo-500/20',
  },
  {
    name: 'Work Wheels',
    country: '🇯🇵 Japan',
    specialty: { en: 'JDM Classic', ua: 'JDM класика' },
    description: {
      en: 'Japanese wheel manufacturer with VIP and drift heritage. Meister, Emotion and Gnosis series.',
      ua: 'Японський виробник дисків з VIP та дрифт спадщиною. Серії Meister, Emotion та Gnosis.',
    },
    accentColor: 'from-rose-500/30 to-pink-500/20',
  },
  {
    name: 'Vorsteiner',
    country: '🇺🇸 USA',
    specialty: { en: 'V-FF Series', ua: 'Серія V-FF' },
    description: {
      en: 'American performance brand with Flow Forged V-FF wheels combining lightweight construction with style.',
      ua: 'Американський performance бренд з Flow Forged V-FF дисками, що поєднують легку конструкцію зі стилем.',
    },
    accentColor: 'from-indigo-500/30 to-blue-500/20',
  },
];

const wheelTypes = [
  {
    name: { en: 'Forged Monoblock', ua: 'Ковані моноблок' },
    description: {
      en: 'Single-piece forged from aerospace-grade aluminum for ultimate strength and weight savings.',
      ua: 'Одноцільні, ковані з аерокосмічного алюмінію для максимальної міцності та економії ваги.',
    },
    icon: WheelIcon,
    color: 'text-cyan-400',
  },
  {
    name: { en: 'Forged Multi-Piece', ua: 'Ковані збірні' },
    description: {
      en: '2 or 3-piece construction allowing custom widths, offsets and lip configurations.',
      ua: '2 або 3-частинна конструкція для кастомної ширини, вильоту та конфігурації полки.',
    },
    icon: TireIcon,
    color: 'text-violet-400',
  },
  {
    name: { en: 'Flow Formed', ua: 'Flow Formed' },
    description: {
      en: 'Cast center with forged barrel for near-forged strength at cast wheel pricing.',
      ua: 'Литий центр з кованим барелем для майже кованої міцності за ціною литих.',
    },
    icon: BrakeDiscIcon,
    color: 'text-blue-400',
  },
  {
    name: { en: 'Cast Wheels', ua: 'Литі диски' },
    description: {
      en: 'Gravity or low-pressure cast wheels offering great value with proven designs.',
      ua: 'Гравітаційні або низькотискові литі диски з відмінним співвідношенням ціни та якості.',
    },
    icon: CaliperIcon,
    color: 'text-amber-400',
  },
  {
    name: { en: 'Carbon Fiber', ua: 'Карбонові' },
    description: {
      en: 'Cutting-edge carbon fiber wheels for extreme weight savings and exotic aesthetics.',
      ua: 'Найсучасніші карбонові диски для екстремальної економії ваги та екзотичної естетики.',
    },
    icon: CoiloverIcon,
    color: 'text-red-400',
  },
  {
    name: { en: 'Motorsport', ua: 'Мотоспорт' },
    description: {
      en: 'Racing-specific wheels designed for endurance, sprint and circuit applications.',
      ua: 'Диски спеціально для перегонів — витривалість, спринт та кільцеві гонки.',
    },
    icon: SpoilerIcon,
    color: 'text-emerald-400',
  },
];

export default function WheelsCategoryPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'ua';
  const [selectedBrand, setSelectedBrand] = useState<typeof wheelBrands[0] | null>(null);

  const content = {
    hero: {
      eyebrow: { en: 'Category', ua: 'Категорія' },
      title: { en: 'Wheels & Rims', ua: 'Диски та колеса' },
      subtitle: {
        en: 'Premium forged, flow formed and cast wheels from legendary manufacturers. Custom fitments, finishes and widths for every vehicle.',
        ua: 'Преміальні ковані, flow formed та литі диски від легендарних виробників. Кастомні розміри, фініші та ширина для кожного авто.',
      },
    },
    sections: {
      brands: { en: 'Featured Brands', ua: 'Провідні бренди' },
      types: { en: 'Wheel Types', ua: 'Типи дисків' },
      cta: { en: 'Request Quote', ua: 'Запросити ціну' },
    },
    back: { en: '← Back to Auto', ua: '← Назад до Авто' },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-zinc-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-500/10 via-transparent to-transparent" />
        
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

      {/* Wheel Types Section */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-light sm:text-3xl mb-10">
            {content.sections.types[locale]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wheelTypes.map((type, i) => (
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
              {locale === 'ua' ? 'Готові знайти ідеальні диски?' : 'Ready to find the perfect wheels?'}
            </h2>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto">
              {locale === 'ua' 
                ? 'Зв\'яжіться з нами для консультації щодо підбору дисків для вашого автомобіля.'
                : 'Contact us for a consultation on wheel selection for your vehicle.'}
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
