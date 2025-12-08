'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

import {
  allMotoBrands,
  getBrandsByNames,
  LocalBrand,
  getBrandMetadata,
  getLocalizedCountry,
  getLocalizedSubcategory,
} from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { categoryData } from '@/lib/categoryData';

type LocalizedCopy = { en: string; ua: string; [key: string]: string };

type MotoModuleCard = {
  key: string;
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  description: LocalizedCopy;
  chips: string[];
  accent: string;
};

type PitChecklistItem = {
  label: LocalizedCopy;
  detail: LocalizedCopy;
  meta: LocalizedCopy;
};

const TOP_MOTO_BRANDS = [
  'Akrapovic',
  'SC-Project',
  'Termignoni',
  'Arrow',
  'Ohlins',
  'Bitubo',
  'Brembo',
  'Marchesini',
  'OZ Racing',
  'SparkExhaust',
  'Accossato',
  'ValterMoto',
];

// Legendary 9 moto brands for showcase section
/* eslint-disable @typescript-eslint/no-unused-vars */
const LEGENDARY_MOTO_BRANDS = [
  'Akrapovic',
  'SC-Project', 
  'Termignoni',
  'Brembo',
  'Ohlins',
  'Marchesini',
  'OZ Racing',
  'Arrow',
  'SparkExhaust',
  'Bitubo',
];

// Brand metadata for legendary section
/* eslint-disable @typescript-eslint/no-unused-vars */
const LEGENDARY_MOTO_CONFIG: Record<string, {
  country: string;
  flag: string;
  category: { en: string; ua: string };
  tagline: { en: string; ua: string };
  gradient: string;
  glowColor: string;
}> = {
  'Akrapovic': {
    country: 'Slovenia',
    flag: '????',
    category: { en: 'Performance Exhaust', ua: 'Вихлопні системи' },
    tagline: { en: 'Titanium exhaust mastery', ua: 'Титанові вихлопні системи' },
    gradient: 'from-red-500/40 via-orange-500/20 to-transparent',
    glowColor: 'rgba(255,100,50,0.4)',
  },
  'SC-Project': {
    country: 'Italy',
    flag: '????',
    category: { en: 'Race Exhaust', ua: 'Гоночні вихлопи' },
    tagline: { en: 'MotoGP-proven technology', ua: 'Технології з MotoGP' },
    gradient: 'from-emerald-500/30 via-teal-500/15 to-transparent',
    glowColor: 'rgba(16,185,129,0.3)',
  },
  'Termignoni': {
    country: 'Italy',
    flag: '????',
    category: { en: 'Exhaust Systems', ua: 'Вихлопні системи' },
    tagline: { en: 'Italian exhaust heritage', ua: 'Італійська спадщина вихлопів' },
    gradient: 'from-amber-500/30 via-yellow-500/15 to-transparent',
    glowColor: 'rgba(245,158,11,0.3)',
  },
  'Brembo': {
    country: 'Italy',
    flag: '????',
    category: { en: 'Braking Systems', ua: 'Гальмівні системи' },
    tagline: { en: 'The art of stopping', ua: 'Мистецтво гальмування' },
    gradient: 'from-red-600/35 via-red-500/15 to-transparent',
    glowColor: 'rgba(220,38,38,0.35)',
  },
  'Ohlins': {
    country: 'Sweden',
    flag: '????',
    category: { en: 'Suspension', ua: 'Підвіска' },
    tagline: { en: 'Advanced suspension technology', ua: 'Передові технології підвіски' },
    gradient: 'from-yellow-500/30 via-amber-500/15 to-transparent',
    glowColor: 'rgba(234,179,8,0.3)',
  },
  'Marchesini': {
    country: 'Italy',
    flag: '????',
    category: { en: 'Forged Wheels', ua: 'Ковані диски' },
    tagline: { en: 'Magnesium racing wheels', ua: 'Магнієві гоночні диски' },
    gradient: 'from-blue-600/30 via-indigo-500/15 to-transparent',
    glowColor: 'rgba(37,99,235,0.3)',
  },
  'OZ Racing': {
    country: 'Italy',
    flag: '????',
    category: { en: 'Racing Wheels', ua: 'Гоночні диски' },
    tagline: { en: 'Winning wheel technology', ua: 'Переможні технології дисків' },
    gradient: 'from-zinc-500/30 via-zinc-600/15 to-transparent',
    glowColor: 'rgba(82,82,91,0.3)',
  },
  'Arrow': {
    country: 'Italy',
    flag: '????',
    category: { en: 'Exhaust Systems', ua: 'Вихлопні системи' },
    tagline: { en: 'World champion exhausts', ua: 'Вихлопи чемпіонів світу' },
    gradient: 'from-orange-500/30 via-yellow-500/15 to-transparent',
    glowColor: 'rgba(249,115,22,0.3)',
  },
  'SparkExhaust': {
    country: 'Italy',
    flag: '🇮🇹',
    category: { en: 'High Performance', ua: 'Висока продуктивність' },
    tagline: { en: 'Italian passion & sound', ua: 'Італійська пристрасть та звук' },
    gradient: 'from-rose-500/30 via-red-500/15 to-transparent',
    glowColor: 'rgba(244,63,94,0.3)',
  },
  'Bitubo': {
    country: 'Italy',
    flag: '🇮🇹',
    category: { en: 'Suspension', ua: 'Підвіска' },
    tagline: { en: 'Race suspension', ua: 'Трекова підвіска' },
    gradient: 'from-red-500/30 via-red-600/15 to-transparent',
    glowColor: 'rgba(220,38,38,0.3)',
  },
};

const heroStats: { value: LocalizedCopy | string; label: LocalizedCopy; caption: LocalizedCopy }[] = [
  {
    value: '40+',
    label: { en: 'brands curated', ua: 'брендів у каталозі' },
    caption: { en: 'Official programs since 2007', ua: 'Офіційні програми з 2007 року' },
  },
  {
    value: { en: 'Network', ua: 'Мережа' },
    label: { en: 'partner garages', ua: 'партнерських майстерень' },
    caption: { en: 'Installation & setup', ua: 'Встановлення та налаштування' },
  },
  {
    value: { en: 'Kyiv', ua: 'Київ' },
    label: { en: 'Baseina St, 21B', ua: 'вул. Басейна, 21Б' },
    caption: { en: 'Headquarters', ua: 'Штаб-квартира' },
  },
];

const programHighlights: Array<{
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  description: LocalizedCopy;
  meta: LocalizedCopy;
}> = [
  {
    eyebrow: { en: 'Expert sourcing', ua: 'Експертне постачання' },
    title: { en: 'Bespoke part selection', ua: 'Індивідуальний підбір' },
    description: {
      en: 'We audit build sheets, plan compatibility and secure allocations before money moves.',
      ua: 'Аналізуємо проєкт, перевіряємо сумісність та надаємо рекомендації.',
    },
    meta: { en: 'Spec verification', ua: 'Підтвердження сумісності' },
  },
  {
    eyebrow: { en: 'Logistics', ua: 'Логістика' },
    title: { en: 'Global delivery windows', ua: 'Глобальна доставка' },
    description: {
      en: 'Air freight, EU road convoys and customs supervision to Kyiv, Warsaw, Dubai and beyond.',
      ua: 'Доставляємо клієнтам по всьому світу. Оптимальні та гнучкі умови.',
    },
    meta: { en: 'Insurance & tracking every 48h', ua: 'One Company Global · Надійність та безпека' },
  },
  {
    eyebrow: { en: 'Installation network', ua: 'Світові бренди' },
    title: { en: 'OEM-safe partners', ua: 'Топові світові бренди' },
    description: {
      en: 'Certified importer partners for titanium welding, ECU calibration and track alignment.',
      ua: 'Ми працюємо виключно з провідними світовими виробниками авто та мото тюнінгу.',
    },
    meta: { en: '18 countries · on-site inspection', ua: 'Гарантія якості та автентичності' },
  },
];

const motoModuleCards: MotoModuleCard[] = [
  {
    key: 'race-exhaust',
    eyebrow: { en: 'Sound & flow', ua: 'Звук та потік' },
    title: { en: 'Race exhaust & ECU', ua: 'Трековий вихлоп та ECU' },
    description: {
      en: 'Homologated and race-only systems paired with ECUStudio, Jetprime and MoTeC strategies.',
      ua: 'Гомологовані й трекові вихлопи з ECUStudio, Jetprime та MoTeC стратегіями.',
    },
    chips: ['Akrapovic', 'SC-Project', 'Austin Racing'],
    accent: 'from-pink-500/40 via-rose-400/20 to-transparent',
  },
  {
    key: 'chassis',
    eyebrow: { en: 'Control', ua: 'Контроль' },
    title: { en: 'Chassis & suspension', ua: 'Шасі та підвіска' },
    description: {
      en: 'Bitubo, Nitron and HyperPro sets with dyno-driven shims, linkages and steering dampers.',
      ua: 'Комплекти Bitubo, Nitron, HyperPro з діно-підбором шайб, лінків та демпферів.',
    },
    chips: ['Bitubo Suspension', 'HyperPro', 'Nitron Suspension'],
    accent: 'from-orange-500/40 via-amber-400/20 to-transparent',
  },
  {
    key: 'carbon',
    eyebrow: { en: 'Weight saving', ua: 'Зниження ваги' },
    title: { en: 'Carbon & aero', ua: 'Карбон та аеро' },
    description: {
      en: 'Rotobox, Ilmberger and CRC kits with FIM paperwork and paint-to-sample finishing.',
      ua: 'Комплекти Rotobox, Ilmberger, CRC з FIM документами та індивідуальним фарбуванням.',
    },
    chips: ['Rotobox', 'Ilmberger Carbon', 'CRC Fairings'],
    accent: 'from-cyan-500/40 via-blue-500/20 to-transparent',
  },
  {
    key: 'controls',
    eyebrow: { en: 'Ergonomics', ua: 'Ергономіка' },
    title: { en: 'Controls & braking', ua: 'Керування та гальма' },
    description: {
      en: 'CNC Racing, Accossato and ValterMoto rearsets, clip-ons and billet master cylinders.',
      ua: 'Rearsets, кліпони та білетні гальмівні циліндри від CNC Racing, Accossato, ValterMoto.',
    },
    chips: ['CNC Racing', 'Accossato', 'ValterMoto'],
    accent: 'from-purple-500/40 via-indigo-500/20 to-transparent',
  },
  {
    key: 'safety',
    eyebrow: { en: 'Protection', ua: 'Захист' },
    title: { en: 'Safety & data', ua: 'Захист та телеметрія' },
    description: {
      en: 'GBracing, Bonamici and Starlane telemetry packages with crash, lever and data redundancy.',
      ua: 'Комплекти GBracing, Bonamici та Starlane для краш-захисту й телеметрії.',
    },
    chips: ['GBracing', 'Bonamici', 'Starlane'],
    accent: 'from-emerald-500/40 via-green-500/20 to-transparent',
  },
  {
    key: 'track-support',
    eyebrow: { en: 'Pit logistics', ua: 'Піт-логістика' },
    title: { en: 'Track support kits', ua: 'Трекові комплекти підтримки' },
    description: {
      en: 'Racefoxx, Samco Sport and Domino provisioning: tire warmers, pit tools, crash kits in one crate.',
      ua: 'Racefoxx, Samco Sport, Domino: підігрівачі, піт-інструмент та crash-комплекти в одному ящику.',
    },
    chips: ['Racefoxx', 'Samco Sport', 'Domino'],
    accent: 'from-yellow-500/40 via-orange-500/20 to-transparent',
  },
];

/* eslint-disable @typescript-eslint/no-unused-vars */
const pitCrewChecklist: PitChecklistItem[] = [
  {
    label: {
      en: '48h pit window',
      ua: '48h pit-вікно',
    },
    detail: {
      en: 'Door-to-door ATA carnet handling, customs and insurance updates pushed every 12h.',
      ua: 'ATA-карнет, митниця й страхування з апдейтами кожні 12 годин.',
    },
    meta: {
      en: 'Logistics support',
      ua: 'Логістична підтримка',
    },
  },
  {
    label: {
      en: 'Setup rehearsal',
      ua: 'Репетиція сетапу',
    },
    detail: {
      en: 'Remote video walk-through with Bitubo/Brembo tech moments before loading.',
      ua: 'Віддалена відео-сесія з Bitubo/Brembo техніком перед завантаженням.',
    },
    meta: {
      en: 'Track engineering',
      ua: 'Трек-інженерія',
    },
  },
  {
    label: {
      en: 'Rider support',
      ua: 'Підтримка райдера',
    },
    detail: {
      en: 'Travel, paddock passes and hotel coordination with a single WhatsApp thread.',
      ua: 'Подорож, паддок-паси та готелі в одному WhatsApp-треді.',
    },
    meta: {
      en: 'Lifestyle desk',
      ua: 'Lifestyle-деск',
    },
  },
];

import { curatedBrandStories, BrandStory } from '@/lib/brandStories';

export default function MotoPage() {
  const params = useParams();
  const locale = (params.locale === 'en' ? 'en' : 'ua') as 'en' | 'ua';
  const t = useTranslations('moto');
  const tPage = useTranslations('autoPage');
  const isUa = locale === 'ua';
  const typography = {
    heroTitle: isUa ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-2xl sm:text-3xl lg:text-4xl',
    heroSubtitle: isUa ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
    statValue: isUa ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl',
    sectionHeading: isUa ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl',
  } as const;

  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<LocalBrand | null>(null);
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isBrandsOpen, setIsBrandsOpen] = useState(false);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const filteredBrands = allMotoBrands.filter((brand) => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLetter = activeLetter ? brand.name.toUpperCase().startsWith(activeLetter) : true;
    return matchesSearch && matchesLetter;
  });

  const topBrands = useMemo(() => getBrandsByNames(TOP_MOTO_BRANDS, 'moto'), []);

  // Helper to find brand by name
  const findBrandByName = useCallback((name: string) => {
    return topBrands.find(b => b.name === name) || allMotoBrands.find(b => b.name === name);
  }, [topBrands]);

  // Click handler for legendary brand cards
  const handleBrandClick = useCallback((brandName: string) => {
    const brand = findBrandByName(brandName);
    if (brand) {
      setSelectedBrand(brand);
    }
  }, [findBrandByName]);

  const getBrandOrigin = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedCountry(metadata.country, locale);
      }
      return locale === 'ua' ? 'Світовий портфель' : 'Global program';
    },
    [locale]
  );

  const getBrandSubcategory = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedSubcategory(metadata.subcategory, locale);
      }
      return null;
    },
    [locale]
  );

  const getBrandStory = useCallback((brand: LocalBrand): BrandStory => {
    if (curatedBrandStories[brand.name]) {
      return curatedBrandStories[brand.name];
    }
    return {
      headline: {
        en: `${brand.name} — bespoke moto supply`,
        ua: `${brand.name} — індивідуальне постачання`,
      },
      description: {
        en: 'Expert sourcing, homologation paperwork and paddock-ready logistics directed from our Kyiv headquarters.',
        ua: 'Персональний підбір, гомологаційні документи та паддок-логістика з Басейної, 21Б.',
      },
      highlights: [
        { en: 'Pit support in 18 countries', ua: 'Pit-підтримка у 18 країнах' },
        { en: 'Air & road logistics w/ customs', ua: 'Авіа та авто логістика з митницею' },
        { en: 'Status updates every 48h', ua: 'Статус-апдейти кожні 48 годин' },
      ],
    };
  }, []);

  const selectedBrandStory = selectedBrand ? getBrandStory(selectedBrand) : null;
  const selectedBrandOrigin = selectedBrand ? getBrandOrigin(selectedBrand) : null;
  const selectedBrandSubcategory = selectedBrand ? getBrandSubcategory(selectedBrand) : null;
  const selectedBrandPrograms = selectedBrand
    ? motoModuleCards.filter((card) =>
        card.chips.some((chip) => chip.toLowerCase() === selectedBrand.name.trim().toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen bg-black text-white font-sans relative">
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-40"
        >
          <source src="/videos/MotoBG-web.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="relative z-10">
      <section className="relative isolate overflow-hidden rounded-b-[40px] border-b border-white/10">
        <div className="absolute inset-0">
          
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/80 sm:from-black sm:via-black/70 sm:to-black/80" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)] sm:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-32 pb-16 sm:gap-8 sm:px-6 sm:pt-40 sm:pb-20 md:gap-10 md:pt-48 md:pb-28">
          <div className="text-[9px] uppercase tracking-[0.4em] text-white/60 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">
            {locale === 'ua' ? 'Преміум програми · мото' : 'Premium programs · moto'}
          </div>
          <div className="max-w-4xl space-y-4 sm:space-y-5 md:space-y-6">
            <h1 className={`font-light leading-tight ${typography.heroTitle}`}>
              {t('title')}
              <span className="text-white/50"> · </span>
              <span className="text-white/70">{t('subtitle')}</span>
            </h1>
            <p className={`text-white/70 ${typography.heroSubtitle}`}>
              {locale === 'ua'
                ? 'Створюємо мотоцикли з характером з 2007 року.'
                : 'Creating motorcycles with character since 2007.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {heroStats.map((stat) => (
              <div
                key={stat.label.en}
                className="flex flex-col items-center text-center rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] sm:rounded-3xl sm:p-5 md:p-6"
              >
                <div className={`${typography.statValue} font-light text-white`}>
                  {typeof stat.value === 'string' ? stat.value : stat.value[locale]}
                </div>
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.3em] text-white/60 sm:mt-2 sm:text-xs sm:tracking-[0.4em]">{stat.label[locale]}</div>
                <p className="mt-2 text-xs text-white/60 sm:mt-3 sm:text-sm">{stat.caption[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/5 bg-black/30 py-12 sm:py-16 md:py-20">
        <div className="absolute inset-x-0 top-0 mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:gap-5 sm:px-6 md:grid-cols-3 md:gap-6">
          {programHighlights.map((card) => (
            <div
              key={card.title.en}
              className="h-full flex flex-col rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:rounded-3xl sm:p-6"
            >
              <div className="text-[7px] uppercase tracking-[0.4em] text-white/50 sm:text-[8px] sm:tracking-[0.5em]">{card.eyebrow[locale]}</div>
              <h3 className="mt-3 text-xl font-light text-white sm:mt-4 sm:text-2xl">{card.title[locale]}</h3>
              <p className="mt-2 flex-1 text-[10px] text-white/70 sm:mt-3 sm:text-[11px] leading-relaxed">{card.description[locale]}</p>
              <p className="mt-4 text-[7px] uppercase tracking-[0.25em] text-white/60 sm:mt-6 sm:text-[9px] sm:tracking-[0.3em]">{card.meta[locale]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product Categories Section */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{t('productCategories')}</p>
          <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>
            {locale === 'ua' ? 'Мото ' : 'Engineering Modules'}
          </h2>
          <button
            onClick={() => setIsModulesOpen(!isModulesOpen)}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white transition-all hover:bg-white/10 hover:border-white/40"
          >
            <span>{isModulesOpen ? (locale === 'ua' ? 'Згорнути' : 'Collapse') : (locale === 'ua' ? 'Відкрити список' : 'Open list')}</span>
            <motion.div
              animate={{ rotate: isModulesOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 10 10" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path 
                  d="M1 3L5 7L9 3" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </button>
        </div>
        <AnimatePresence>
          {isModulesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 auto-rows-fr pb-4">
          {categoryData.filter(cat => cat.segment === 'moto').map((cat) => (
            <Link
              key={cat.slug}
              href={`/${locale}/moto/categories/${cat.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white/10 border border-white/20 transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:translate-y-[-4px] sm:rounded-3xl h-full backdrop-blur-3xl"
            >
              {/* Multi-layer box shadows for depth */}
              <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] sm:rounded-3xl" />
              
              {/* Bottom glow on hover */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              
              <div className="relative p-6 sm:p-7 md:p-8 flex flex-col flex-1">
                {/* Title & Description */}
                <div className="min-h-[120px] sm:min-h-[140px]">
                  <h3 className="text-xl font-normal text-white text-balance sm:text-2xl tracking-wide">{locale === 'ua' ? cat.title.ua : cat.title.en}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/80 text-pretty sm:text-[15px] font-light">{locale === 'ua' ? cat.description.ua : cat.description.en}</p>
                  <p className="mt-2 text-[11px] text-white/50 text-pretty sm:text-xs">{locale === 'ua' ? cat.spotlight.ua : cat.spotlight.en}</p>
                </div>
                
                {/* Brand tags with relief */}
                <div className="mt-5 min-h-[80px] flex flex-wrap content-start gap-2 text-[10px] uppercase tracking-wider sm:text-[11px]">
                  {cat.brands.slice(0, 4).map((name) => (
                    <span key={name} className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center font-medium text-white/90 transition-colors duration-200 group-hover:border-white/20 group-hover:bg-white/10">
                      {name}
                    </span>
                  ))}
                  {cat.brands.length > 4 && (
                    <span className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center font-medium text-white/50">
                      +{cat.brands.length - 4} {tPage('more')}
                    </span>
                  )}
                </div>
                
                {/* Open button - clear affordance */}
                <div className="mt-auto pt-6 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white transition-all duration-300 group-hover:gap-3 group-hover:text-white">
                    {tPage('open')}
                    <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">{cat.brands.length} брендів</span>
                </div>
              </div>
            </Link>
          ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* LEGENDARY MOTO BRANDS SHOWCASE */}
      <section className="relative py-24 sm:py-32 md:py-40 overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          
        </div>
        {/* Epic Background Overlays */}
        <div className="absolute inset-0 bg-black/40 sm:bg-black/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(239,68,68,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_90%,rgba(16,185,129,0.1),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,rgba(59,130,246,0.08),transparent_40%)]" />
        
        {/* Animated Glow Orbs */}
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-20 right-1/3 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-10 w-[300px] h-[300px] bg-blue-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-16 sm:mb-20 md:mb-28 text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="text-4xl font-extralight tracking-tight text-white sm:text-5xl md:text-6xl"
            >
              <span className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent">
                {locale === 'ua' ? 'Легенди' : 'Legends'}
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="mt-4 text-lg sm:text-xl text-zinc-500 max-w-xl mx-auto"
            >
              {locale === 'ua' ? 'Бренди, що формують індустрію мото' : 'Brands that shape the moto industry'}
            </motion.p>
          </div>
          
          {/* Legendary Grid - Equal Width Masonry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 auto-rows-max">
            
            {/* SC-PROJECT - Hero Card (Replaces Akrapovic as Hero) */}
            <motion.button
              onClick={() => handleBrandClick('SC-Project')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-1000">
                <div className="absolute -inset-4 bg-gradient-to-r from-white/10 via-white/5 to-transparent rounded-[3rem] blur-3xl" />
              </div>
              <div className="relative h-full min-h-[320px] sm:min-h-[380px] p-6 sm:p-8 lg:p-12 flex flex-col">

                <div className="flex-1 flex items-center justify-center py-6 sm:py-10">
                  <div className="relative w-full max-w-[420px] h-28 sm:h-36 lg:h-44">
                    <Image src={getBrandLogo('SC-Project')} alt="SC-Project" fill className="object-contain drop-shadow-[0_0_60px_rgba(255,255,255,0.1)] transition-all duration-700 group-hover:scale-110 group-hover:drop-shadow-[0_0_80px_rgba(255,255,255,0.2)]" unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">SC-Project</p>
                    <p className="text-sm sm:text-base text-white/60 mt-2">{locale === 'ua' ? 'Вихлопні системи чемпіонів' : 'Exhaust systems of champions'}</p>
                  </div>
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-white/40 group-hover:bg-white/20">
                    <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* TERMIGNONI - Tall Card */}
            <motion.button
              onClick={() => handleBrandClick('Termignoni')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="group relative lg:row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              <div className="relative h-full min-h-[320px] sm:min-h-[380px] p-5 sm:p-6 lg:p-8 flex flex-col">

                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="relative w-full max-w-[200px] h-16 sm:h-20 lg:h-24">
                    <Image src={getBrandLogo('Termignoni')} alt="Termignoni" fill className="object-contain opacity-95 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-700 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-light text-white">Termignoni</p>
                  <p className="text-xs sm:text-sm text-white/60 mt-1">{locale === 'ua' ? 'Італійська пристрасть' : 'Italian passion'}</p>
                </div>
                <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:bg-white/20 group-hover:border-white/40">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </div>
              </div>
            </motion.button>

            {/* BREMBO - Wide Card */}
            <motion.button
              onClick={() => handleBrandClick('Brembo')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="group relative cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-white/10 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              <div className="relative h-full p-5 sm:p-6 lg:p-8 flex flex-col min-h-[200px]">

                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[220px] h-12 sm:h-16">
                    <Image src={getBrandLogo('Brembo')} alt="Brembo" fill className="object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.1)] transition-all duration-700 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-light text-white">Brembo</p>
              </div>
              <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-white/40 group-hover:bg-white/20">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </div>
            </motion.button>

            {/* AKRAPOVIC - Small Card (Moved from Hero) */}
            <motion.button
              onClick={() => handleBrandClick('Akrapovic')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-5 sm:p-6 flex flex-col min-h-[180px]">

                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[160px] h-16 sm:h-20">
                    <Image src={getBrandLogo('Akrapovic')} alt="Akrapovic" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-base sm:text-lg font-medium text-white">Akrapovic</p>
                    <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Титанові системи' : 'Titanium systems'}</p>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* OHLINS */}
            <motion.button
              onClick={() => handleBrandClick('Ohlins')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">

                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[140px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Ohlins')} alt="Ohlins" fill className="object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Ohlins</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Золотий стандарт' : 'The Gold Standard'}</p>
              </div>
            </motion.button>

            {/* MARCHESINI */}
            <motion.button
              onClick={() => handleBrandClick('Marchesini')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">

                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[110px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Marchesini')} alt="Marchesini" fill className="object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Marchesini</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Легендарні диски' : 'Legendary wheels'}</p>
              </div>
            </motion.button>

            {/* OZ RACING */}
            <motion.button
              onClick={() => handleBrandClick('OZ Racing')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">

                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[100px] h-10 sm:h-12">
                    <Image src={getBrandLogo('OZ Racing')} alt="OZ Racing" fill className="object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">OZ Racing</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Технології перемог' : 'Winning technology'}</p>
              </div>
            </motion.button>

            {/* ARROW */}
            <motion.button
              onClick={() => handleBrandClick('Arrow')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇮🇹</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/60">Italy</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[140px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Arrow')} alt="Arrow" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Arrow</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Італійський звук' : 'Italian sound'}</p>
              </div>
            </motion.button>

            {/* SPARK EXHAUST */}
            <motion.button
              onClick={() => handleBrandClick('SparkExhaust')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇮🇹</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/60">Italy</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[120px] h-10 sm:h-12">
                    <Image src={getBrandLogo('SparkExhaust')} alt="SparkExhaust" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Spark</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Італійська пристрасть' : 'Italian passion'}</p>
              </div>
            </motion.button>

            {/* BITUBO */}
            <motion.button
              onClick={() => handleBrandClick('Bitubo')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇮🇹</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/60">Italy</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[140px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Bitubo')} alt="Bitubo" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Bitubo</p>
                <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{locale === 'ua' ? 'Трекова підвіска' : 'Race suspension'}</p>
              </div>
            </motion.button>

            {/* +40 BRANDS CTA with Carousel */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="group relative sm:col-span-2 lg:col-span-3 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left min-h-[200px]"
              onClick={() => {
                const catalogSection = document.getElementById('moto-brand-catalog');
                catalogSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {/* Background */}
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 bg-white/10 backdrop-blur-3xl" />
              
              <div className="relative p-6 sm:p-8 lg:p-10 h-full flex flex-col justify-center">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
                  <div className="text-center lg:text-left">
                    <div className="flex items-baseline gap-3 justify-center lg:justify-start">
                      <span className="text-5xl sm:text-6xl lg:text-7xl font-extralight text-white">
                        +40
                      </span>
                      <span className="text-lg sm:text-xl text-white/60 font-light">
                        {locale === 'ua' ? 'брендів' : 'brands'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/50">
                      {locale === 'ua' ? 'Повний каталог мото-компонентів преміум класу' : 'Complete catalog of premium moto parts & accessories'}
                    </p>
                  </div>
                  {/* CTA Button */}
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-white/40 group-hover:bg-white/20 group-hover:shadow-[0_0_50px_rgba(255,255,255,0.15)]">
                    <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
                {/* Infinite Scrolling Carousel */}
                <div className="relative overflow-hidden">
                  <div className="flex gap-6 mb-4 animate-scroll-left">
                    {[...allMotoBrands.slice(0, 15), ...allMotoBrands.slice(0, 15)].map((brand, idx) => (
                      <div key={`row1-${brand.name}-${idx}`} className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                        <div className="relative w-full h-full">
                          <Image src={getBrandLogo(brand.name)} alt={brand.name} fill className="object-contain opacity-70 hover:opacity-100 transition-opacity" unoptimized />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedBrand && selectedBrandStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur"
            onClick={(e) => {
              if (e.currentTarget === e.target) {
                setSelectedBrand(null);
              }
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mx-auto mt-16 max-w-4xl rounded-[32px] border border-white/20 bg-zinc-900 p-8 text-white shadow-2xl"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="relative h-20 w-full sm:h-24 sm:w-64 md:h-28 md:w-72">
                  <Image
                    src={getBrandLogo(selectedBrand.name)}
                    alt={selectedBrand.name}
                    fill
                    className="object-contain object-left sm:object-center"
                    sizes="(max-width: 640px) 100vw, 300px"
                    unoptimized
                  />
                </div>
                <button
                  onClick={() => setSelectedBrand(null)}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/70 hover:border-white hover:text-white"
                >
                  {locale === 'ua' ? 'Закрити' : 'Close'}
                </button>
              </div>

              <div className="mt-6 grid gap-8 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/50 sm:text-xs sm:tracking-[0.4em]">
                    <span>{selectedBrandOrigin}</span>
                    {selectedBrandSubcategory && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="text-white/60">{selectedBrandSubcategory}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-2 text-3xl font-light">{selectedBrandStory.headline[locale]}</h3>
                  <p className="mt-4 text-sm text-white/70">{selectedBrandStory.description[locale]}</p>
                </div>
                <div className="space-y-4">
                  {selectedBrandStory.highlights?.map((highlight, index) => (
                    <div
                      key={highlight.en + index}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80"
                    >
                      {highlight[locale]}
                    </div>
                  ))}
                  <div className="rounded-2xl border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                      {locale === 'ua' ? 'Модулі' : 'Modules'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBrandPrograms.length > 0 ? (
                        selectedBrandPrograms.map((module) => (
                          <span
                            key={module.key}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70"
                          >
                            {module.title[locale]}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
                          {locale === 'ua' ? 'Індивідуальні побудови' : 'Bespoke builds'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                    {locale === 'ua' ? 'Експертна підтримка' : 'Expert Support'}
                  </p>
                  <p className="mt-2 text-base text-white">
                    {locale === 'ua'
                      ? 'Залиште контакти — повернемося з таймінгами, слотами для інсталяції та гарантіями.'
                      : 'Share your contact and we will return with lead times, install slots and warranty coverage.'}
                  </p>
                </div>
                <Link
                  href={`/${locale}/contact`}
                  className="inline-flex items-center justify-center rounded-full border border-white bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-transparent hover:text-white"
                >
                  {locale === 'ua' ? 'Запросити програму' : 'Request program'}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* <section className="relative border-b border-white/5 bg-black/60 py-12 sm:py-16 md:py-20">
        <div className="absolute inset-x-0 top-0 mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center sm:mb-12 md:mb-16">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">
              {locale === 'ua' ? 'Наші можливості' : 'Our capabilities'}
            </p>
            <h2 className="mt-2 text-2xl font-light text-white sm:mt-3 sm:text-3xl md:text-4xl lg:text-5xl">
              {locale === 'ua' ? 'Що ми пропонуємо' : 'What we offer'}
            </h2>
          </div>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-3 md:gap-6">
            {programHighlights.map((card) => (
              <div
                key={card.title.en}
                className="h-full flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5 backdrop-blur sm:rounded-3xl sm:p-6"
              >
                <div className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em]">{card.eyebrow[locale]}</div>
                <h3 className="mt-3 text-xl font-light text-white sm:mt-4 sm:text-2xl">{card.title[locale]}</h3>
                <p className="mt-2 flex-1 text-xs text-white/70 sm:mt-3 sm:text-sm">{card.description[locale]}</p>
                <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:mt-6 sm:text-xs sm:tracking-[0.3em]">{card.meta[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/5 bg-black py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">
              {locale === 'ua' ? 'Наш досвід' : 'Our experience'}
            </p>
            <h2 className="mt-2 text-2xl font-light text-white sm:mt-3 sm:text-3xl md:text-4xl lg:text-5xl">
              {locale === 'ua' ? 'Ключові показники' : 'Key metrics'}
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {heroStats.map((stat) => (
              <div key={stat.label.en} className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-lg sm:rounded-3xl sm:p-5 md:p-6">
                <div className="text-2xl font-light text-white sm:text-3xl md:text-4xl">
                  {typeof stat.value === 'string' ? stat.value : stat.value[locale]}
                </div>
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.3em] text-white/60 sm:mt-2 sm:text-xs sm:tracking-[0.4em]">{stat.label[locale]}</div>
                <p className="mt-2 text-xs text-white/60 sm:mt-3 sm:text-sm">{stat.caption[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* All Brands Section - Moved Down */}
      <section id="moto-brand-catalog" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{locale === 'ua' ? 'Каталог' : 'Atlas'}</p>
          <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>{locale === 'ua' ? 'Атлас брендів' : 'Brand Atlas'}</h2>
          <p className="mt-4 text-base text-white/60 sm:text-lg">
            {locale === 'ua' ? `${allMotoBrands.length} брендів у портфелі` : `${allMotoBrands.length} brands in portfolio`}
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative w-full max-w-3xl">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white px-6 py-3 text-base text-black placeholder-black/40 shadow-[0_0_40px_rgba(255,255,255,0.07)] focus:outline-none focus:ring-2 focus:ring-white/40 sm:rounded-3xl sm:p-8 sm:py-3.5 sm:text-lg md:px-10 md:py-4"
            />
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/40 sm:right-6 md:right-8">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Alphabet Filter */}
          <div className="flex flex-wrap justify-center gap-2 px-4">
            <button
              onClick={() => setActiveLetter(null)}
              className={`h-8 w-8 rounded-full text-xs font-medium transition-all ${
                activeLetter === null
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              ALL
            </button>
            {alphabet.map((letter) => (
              <button
                key={letter}
                onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                className={`h-8 w-8 rounded-full text-xs font-medium transition-all ${
                  activeLetter === letter
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsBrandsOpen(!isBrandsOpen)}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white transition-all hover:bg-white/10 hover:border-white/40"
          >
            <span>{isBrandsOpen ? (locale === 'ua' ? 'Згорнути' : 'Collapse') : (locale === 'ua' ? 'Відкрити список' : 'Open list')}</span>
            <motion.div
              animate={{ rotate: isBrandsOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <svg 
                width="10" 
                height="10" 
                viewBox="0 0 10 10" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="opacity-70"
              >
                <path 
                  d="M1 3L5 7L9 3" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {isBrandsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:mt-12 lg:grid-cols-3 xl:grid-cols-4 pb-4">
          {filteredBrands.length > 0 ? (
            filteredBrands.map((brand) => {
              const origin = getBrandOrigin(brand);
              const subcategory = getBrandSubcategory(brand);
              return (
                <motion.button
                  key={brand.name}
                  onClick={() => setSelectedBrand(brand)}
                  whileHover={{ y: -6 }}
                  className="group relative flex flex-col items-center text-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-4 transition backdrop-blur-3xl shadow-sm hover:bg-white/20 hover:border-white/30 hover:shadow-md sm:rounded-3xl sm:p-5 md:p-6"
                >
                  <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: 'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 60%)',
                    }}
                  />
                  <div className="relative w-full flex items-center justify-center text-[10px] uppercase tracking-[0.25em] text-white/50 sm:text-xs sm:tracking-[0.3em]">
                    <div className="flex items-center gap-2">
                      <span>{origin}</span>
                      {subcategory && (
                        <>
                          <span className="text-white/30">·</span>
                          <span className="text-white/60">{subcategory}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="relative mt-4 h-20 w-full sm:mt-6 sm:h-24">
                    <Image
                      src={getBrandLogo(brand.name)}
                      alt={brand.name}
                      fill
                      className="object-contain object-center transition-all duration-500"
                      sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 20vw"
                      unoptimized
                    />
                  </div>
                  <div className="mt-4 text-lg font-light leading-tight text-white sm:mt-6 sm:text-xl w-full px-1 break-words">{brand.name}</div>
                </motion.button>
              );
            })
          ) : (
            <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-xl text-white/70">
              {t('noBrands')}
            </div>
          )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="pb-10" />
      </div>
    </div>
  );
}
