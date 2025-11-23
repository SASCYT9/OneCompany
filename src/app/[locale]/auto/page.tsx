// src/app/[locale]/auto/page.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { TiltedCard } from '@/components/ui/TiltedCard';

import {
  allAutomotiveBrands,
  getBrandsByNames,
  LocalBrand,
  getBrandMetadata,
  getLocalizedCountry,
  getLocalizedSubcategory,
} from '@/lib/brands';
import { getBrandLogo } from '@/lib/brandLogos';
import { isDarkLogo } from '@/lib/darkLogos';
import { categoryData } from '@/lib/categoryData';
import type { CategoryData } from '@/lib/categoryData';

type LocalizedCopy = { en: string; ua: string; [key: string]: string };

type BrandStory = {
  headline: LocalizedCopy;
  description: LocalizedCopy;
  highlights?: LocalizedCopy[];
};

const TOP_AUTOMOTIVE_BRANDS = [
  'Akrapovic',
  'Eventuri',
  'KW',
  'HRE',
  'Brembo',
  'Vorsteiner',
  'Armytrix',
  'CSF',
  'Manhart',
  'Renntech',
  'Velos',
  'Weistec',
];

const heroStats: { value: string; label: LocalizedCopy; caption: LocalizedCopy }[] = [
  {
    value: '160+',
    label: { en: 'brands curated', ua: 'брендів у каталозі' },
    caption: { en: 'Official programs since 2007', ua: 'Офіційні програми з 2007 року' },
  },
  {
    value: '5',
    label: { en: 'countries installed', ua: 'країн з інсталяціями' },
    caption: { en: 'Certified partner garages', ua: 'Сертифіковані партнерські майстерні' },
  },
  {
    value: '21B',
    label: { en: 'Baseina St · Kyiv', ua: 'Київ · вул. Басейна, 21Б' },
    caption: { en: 'Headquarters & logistics hub', ua: 'Штаб-квартира та логістичний хаб' },
  },
];

const programHighlights: {
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  description: LocalizedCopy;
  meta: LocalizedCopy;
}[] = [
  {
    eyebrow: { en: 'Expert sourcing', ua: 'Експертне постачання' },
    title: { en: 'Bespoke part selection', ua: 'Індивідуальний підбір' },
    description: {
      en: 'We audit build sheets, plan compatibility and secure allocations before money moves.',
      ua: 'Аналізуємо проєкт, перевіряємо сумісність та надаємо рекомендації.',
    },
    meta: { en: 'VIN verification & spec sheets', ua: 'Перевірка VIN та підтвердження сумісності' },
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

const curatedBrandStories: Record<string, BrandStory> = {
  Akrapovic: {
    headline: {
      en: 'Akrapovic Titanium Sound Architecture',
      ua: 'Akrapovic — титановий саунд-дизайн',
    },
    description: {
      en: 'Factory-backed titanium exhaust solutions tuned on European proving grounds with expert logistics.',
      ua: 'Заводські титанові системи, налаштовані на європейських полігонах, з логістикою під ключ.',
    },
    highlights: [
      { en: 'Evolution Line allocations & race support', ua: 'Квоти Evolution Line та трекова підтримка' },
      { en: 'Custom branding + heat treatment options', ua: 'Кастомний брендинг та термообробка' },
      { en: 'Door-to-door insured delivery', ua: 'Door-to-door доставка зі страхуванням' },
    ],
  },
  Eventuri: {
    headline: { en: 'Eventuri Carbon Intake Lab', ua: 'Eventuri — лабораторія карбону' },
    description: {
      en: 'Autoclave carbon assemblies that stabilise IAT and add theatre to every throttle input.',
      ua: 'Автоклавні карбонові системи, що стабілізують IAT та додають драму кожному натисканню.',
    },
    highlights: [
      { en: 'Pre-preg carbon options with kevlar cores', ua: 'Препрег-карбон з кевларовими осердями' },
      { en: 'Dyno-verified gains for M, RS, AMG platforms', ua: 'Діно-підтвердження для платформ M, RS, AMG' },
      { en: 'Coordinated install + ECU calibration', ua: 'Координація встановлення та калібрування ECU' },
    ],
  },
  'KW': {
    headline: { en: 'KW · Adaptive Control', ua: 'KW · адаптивний контроль' },
    description: {
      en: 'Variant, Clubsport and DDC plug & play kits with geo setup plans from our chassis lab.',
      ua: 'Variant, Clubsport та DDC-комплекти з налаштуванням геометрії від нашої шасі-лабораторії.',
    },
    highlights: [
      { en: 'Track sheets + corner-weighting in Kyiv', ua: 'Налаштування кутів та ваги в Києві' },
      { en: 'Road + snow presets for SUVs', ua: 'Налаштування для доріг та снігу для SUV' },
      { en: 'Warranty preserved via OEM torque specs', ua: 'Збережена гарантія завдяки OEM моментам затягування' },
    ],
  },
  'HRE': {
    headline: { en: 'HRE Wheels Forged Program', ua: 'HRE Wheels — програма forged' },
    description: {
      en: 'Bespoke monoblock, 2-piece and 3-piece sets engineered for hypercar tolerances.',
      ua: 'Кастомні моноблоки, дво- та трисекційні диски з допусками гіперкарів.',
    },
    highlights: [
      { en: 'Aerospace-grade forgings + TÜV paperwork', ua: 'Авіаційні заготовки та документи TÜV' },
      { en: 'Finish library + transparent timelines', ua: 'Бібліотека фінішів та прозорі строки' },
      { en: 'Ceramic coating + TPMS setup on delivery', ua: 'Керамічне покриття та TPMS при видачі' },
    ],
  },
  Brembo: {
    headline: { en: 'Brembo GT & Race Systems', ua: 'Brembo — GT та гоночні системи' },
    description: {
      en: 'Monoblock brake solutions with track-proven pad libraries and telemetry guidance.',
      ua: 'Моноблочні гальма з трековими колодками та телеметрією.',
    },
    highlights: [
      { en: 'BBK conversions with hub machining', ua: 'BBK-конверсії з фрезеруванням маточин' },
      { en: 'Brake-in procedures + fluid packages', ua: 'Процедури обкатки та комплекти рідин' },
      { en: 'On-site pedal feel tuning', ua: 'Тонке налаштування педалі на місці' },
    ],
  },
  Vorsteiner: {
    headline: { en: 'Vorsteiner Carbon Importer', ua: 'Vorsteiner — карбоновий імпортер' },
    description: {
      en: 'Carbon aero programs for Lamborghini, Porsche, BMW and SUV flagships with factory-level fit.',
      ua: 'Карбонові аеропакети для Lamborghini, Porsche, BMW та флагманських SUV з OEM-пасуванням.',
    },
    highlights: [
      { en: 'Autoclave dry carbon & forged options', ua: 'Сухий та кований карбон з автоклава' },
      { en: 'Paint-to-sample & PPF ready finishing', ua: 'Індивідуальне фарбування та готовність під PPF' },
      { en: 'Install supervision + alignment presets', ua: 'Контроль монтажу та налаштування сходження' },
    ],
  },
  Armytrix: {
    headline: { en: 'Armytrix Valvetronic Theatre', ua: 'Armytrix — клапанний саунд' },
    description: {
      en: 'Valvetronic exhausts with smart remotes, bluetooth control and night stealth modes.',
      ua: 'Клапанні вихлопи зі смарт-брелоками, bluetooth-контролем та тихими режимами.',
    },
    highlights: [
      { en: 'Titanium + stainless options in stock', ua: 'Титанові та сталеві опції на складі' },
      { en: 'ECU-safe valve modules', ua: 'Блоки клапанів без помилок ECU' },
      { en: 'Install + wiring diagrams translated', ua: 'Схеми монтажу та проводки українською' },
    ],
  },
  CSF: {
    headline: { en: 'CSF Cooling Program', ua: 'CSF — програма охолодження' },
    description: {
      en: 'Billet end-tank intercoolers and radiators that keep intake temps repeatable on stage 3 builds.',
      ua: 'Інтеркулери та радіатори з білетними баками для стабільних температур на stage 3.',
    },
    highlights: [
      { en: 'Drag + track proven cores', ua: 'Перевірені на драгу та треку ядра' },
      { en: 'Heat exchanger bundles in stock', ua: 'Готові комплекти теплообмінників' },
      { en: 'Coolant bleeding with telemetry report', ua: 'Прокачка з рипортом телеметрії' },
    ],
  },
  Manhart: {
    headline: { en: 'Manhart Bespoke Builds', ua: 'Manhart — індивідуальний сервіс' },
    description: {
      en: 'Complete conversion kits with aero, wheels and ECU calibrations for BMW, Audi and Mercedes.',
      ua: 'Повні комплекти конверсій з аеро, дисками та прошивками для BMW, Audi, Mercedes.',
    },
    highlights: [
      { en: 'Stage packages shipped as one crate', ua: 'Stage-комплекти в одному ящику' },
      { en: 'Interior trims + steering wheels included', ua: 'Включені інтерʼєрні елементи та керма' },
      { en: 'On-site coding and warranty docs', ua: 'Кодування та гарантійні документи на місці' },
    ],
  },
  Renntech: {
    headline: { en: 'Renntech AMG Power Stages', ua: 'Renntech — ступені потужності AMG' },
    description: {
      en: 'Turbo, cooling and ECU programs engineered by ex-AMG powertrain teams.',
      ua: 'Турбіни, охолодження та ECU від екс-команди AMG.',
    },
    highlights: [
      { en: 'Stage 1-4 calibrations with dyno sheets', ua: 'Stage 1-4 з діно-рапортами' },
      { en: 'TCU + gearbox cooling upgrades', ua: 'TCU та охолодження КПП' },
      { en: 'Worldwide warranty honoured via us', ua: 'Гарантія по всьому світу через нас' },
    ],
  },
  'Velos': {
    headline: { en: 'Velos Forged Luxury', ua: 'Velos — розкішне кування' },
    description: {
      en: 'Luxury-focused forged sets with marble, brushed and two-tone finishes for SUVs and limousines.',
      ua: 'Розкішні ковані комплекти з мармуровими, брашованими та двотоновими фінішами для SUV та лімузинів.',
    },
    highlights: [
      { en: '24-26 inch fitments verified for Maybach & Cullinan', ua: '24-26" підбори для Maybach та Cullinan' },
      { en: 'Floating centre caps + bespoke engraving', ua: 'Плаваючі ковпачки та гравіювання' },
      { en: 'TPMS + run-flat compatible', ua: 'Сумісність з TPMS та run-flat' },
    ],
  },
  'Weistec': {
    headline: { en: 'Weistec Engineering Power Lab', ua: 'Weistec Engineering — лабораторія потужності' },
    description: {
      en: 'Billet turbos, meth kits and calibration suites for AMG, McLaren and exotic SUV platforms.',
      ua: 'Білетні турбіни, метанольні комплекти та калібрування для AMG, McLaren та екзотичних SUV.',
    },
    highlights: [
      { en: 'Complete fuel system solutions', ua: 'Повні паливні системи' },
      { en: 'Built transmissions with break-in support', ua: 'Підготовлені КПП з підтримкою обкатки' },
      { en: 'Remote + on-site calibration days', ua: 'Віддалені й виїзні дні калібрування' },
    ],
  },
};

const automotiveCategories = categoryData.filter((cat) => cat.segment === 'auto');

export default function AutomotivePage() {
  const params = useParams();
  const locale = (params.locale === 'en' ? 'en' : 'ua') as 'en' | 'ua';
  const t = useTranslations('auto');
  const tPage = useTranslations('autoPage');
  const isUa = locale === 'ua';
  const typography = {
    heroTitle: isUa ? 'text-4xl sm:text-5xl lg:text-6xl' : 'text-5xl sm:text-6xl lg:text-7xl',
    heroSubtitle: isUa ? 'text-base sm:text-lg' : 'text-lg sm:text-xl',
    statValue: isUa ? 'text-3xl' : 'text-4xl',
    sectionHeading: isUa ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl',
  } as const;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<LocalBrand | null>(null);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const filteredBrands = allAutomotiveBrands.filter((brand) => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLetter = activeLetter ? brand.name.toUpperCase().startsWith(activeLetter) : true;
    return matchesSearch && matchesLetter;
  });

  const topBrands = useMemo(() => getBrandsByNames(TOP_AUTOMOTIVE_BRANDS, 'auto'), []);

  const brandCategoryMap = useMemo(() => {
    const map = new Map<string, CategoryData[]>();
    categoryData.forEach((cat) => {
      cat.brands.forEach((brandName) => {
        const key = brandName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(cat);
      });
    });
    return map;
  }, []);

  const getBrandOrigin = useCallback(
    (brand: LocalBrand) => {
      const metadata = getBrandMetadata(brand.name);
      if (metadata) {
        return getLocalizedCountry(metadata.country, locale);
      }
      return locale === 'ua' ? 'Світовий портфель' : 'Global portfolio';
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

  const getBrandCollections = useCallback(
    (brandName: string) => brandCategoryMap.get(brandName.trim().toLowerCase()) ?? [],
    [brandCategoryMap]
  );

  const getBrandStory = useCallback((brand: LocalBrand): BrandStory => {
    if (curatedBrandStories[brand.name]) {
      return curatedBrandStories[brand.name];
    }
    return {
      headline: {
        en: `${brand.name} — Official Import`,
        ua: `${brand.name} — офіційний імпорт`,
      },
      description: {
        en: 'Direct manufacturer supply, authenticity guarantee and professional component selection.',
        ua: 'Прямі поставки від виробника, гарантія автентичності та професійний підбір компонентів.',
      },
      highlights: [
        {
          en: 'Official warranty & service support',
          ua: 'Офіційна гарантія та сервісна підтримка',
        },
        {
          en: 'Fast logistics from Europe & USA',
          ua: 'Швидка логістика з Європи та США',
        },
        {
          en: 'Qualified installation network',
          ua: 'Кваліфіковане встановлення партнерами',
        },
      ],
    };
  }, []);

  const selectedBrandStory = selectedBrand ? getBrandStory(selectedBrand) : null;
  const selectedBrandCollections = selectedBrand ? getBrandCollections(selectedBrand.name) : [];
  const selectedBrandOrigin = selectedBrand ? getBrandOrigin(selectedBrand) : null;
  const selectedBrandSubcategory = selectedBrand ? getBrandSubcategory(selectedBrand) : null;

  return (
    <div className="min-h-screen bg-black text-white font-[family:var(--font-sans)]">
      <section className="relative isolate overflow-hidden rounded-b-[40px] border-b border-white/10">
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover opacity-60"
            poster="/images/eventuri/carbon-intake.jpg"
          >
            <source src="/videos/hero-main.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:gap-8 sm:px-6 sm:py-20 md:gap-10 md:py-28">
          <div className="text-[9px] uppercase tracking-[0.4em] text-white/60 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">
            {locale === 'ua' ? 'Преміум програми · авто' : 'Premium programs · auto'}
          </div>
          <div className="max-w-4xl space-y-4 sm:space-y-5 md:space-y-6">
            <h1 className={`font-light leading-tight text-balance ${typography.heroTitle}`}>
              {t('title')}<span className="text-white/50"> · </span>
              <span className="text-white/70">{t('subtitle')}</span>
            </h1>
            <p className={`text-white/70 text-pretty ${typography.heroSubtitle}`}>
              {locale === 'ua'
                ? 'Створюємо автомобілі з характером з 2007 року.'
                : 'We build characterful cars with titanium, carbon and electronic suites curated since 2007.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {heroStats.map((stat) => (
              <div
                key={stat.label.en}
                className="flex flex-col items-center text-center rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] sm:rounded-3xl sm:p-5 md:p-6"
              >
                <div className={`${typography.statValue} font-light text-white`}>{stat.value}</div>
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.3em] text-white/60 sm:mt-2 sm:text-xs sm:tracking-[0.4em]">{stat.label[locale]}</div>
                <p className="mt-2 text-xs text-white/60 sm:mt-3 sm:text-sm">{stat.caption[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/5 bg-black/60 py-12 sm:py-16 md:py-20">
        <div className="absolute inset-x-0 top-0 mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:gap-5 sm:px-6 md:grid-cols-3 md:gap-6">
          {programHighlights.map((card) => (
            <div
              key={card.title.en}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:rounded-3xl sm:p-6"
            >
              <div className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em]">{card.eyebrow[locale]}</div>
              <h3 className="mt-3 text-xl font-light text-white sm:mt-4 sm:text-2xl">{card.title[locale]}</h3>
              <p className="mt-2 text-xs text-white/70 sm:mt-3 sm:text-sm">{card.description[locale]}</p>
              <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:mt-6 sm:text-xs sm:tracking-[0.3em]">{card.meta[locale]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{t('productCategories')}</p>
          <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>
            {locale === 'ua' ? 'Модулі, які складають авто' : 'Modules we compose cars from'}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 auto-rows-fr">
          {automotiveCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/${locale}/categories/${cat.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30 p-5 transition-all duration-500 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-zinc-900/50 hover:border-white/20 hover:scale-[1.02] hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:p-6 md:p-8 h-full"
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{
                backgroundImage:
                  'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 55%)',
              }} />
              <div className="relative flex flex-col gap-3 sm:gap-4 flex-1">
                <h3 className="text-xl font-light text-white sm:text-2xl text-balance">{locale === 'ua' ? cat.title.ua : cat.title.en}</h3>
                <p className="text-xs text-white/70 sm:text-sm text-pretty">{locale === 'ua' ? cat.description.ua : cat.description.en}</p>
                <p className="text-[11px] text-white/50 sm:text-xs text-pretty">{locale === 'ua' ? cat.spotlight.ua : cat.spotlight.en}</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/50 sm:mt-4 sm:gap-2 sm:text-[11px] sm:tracking-[0.3em]">
                  {cat.brands.map((name) => (
                    <span key={name} className="flex items-center justify-center rounded-full border border-white/10 px-2.5 py-0.5 text-center text-white/70 sm:px-3 sm:py-1">
                      {name}
                    </span>
                  ))}
                </div>
                <div className="mt-auto pt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/70 sm:gap-3 sm:text-xs sm:tracking-[0.35em]">
                  <span className="transition-colors duration-300 group-hover:text-white">
                    {locale === 'ua' ? 'Переглянути' : 'Open'}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent transition-all duration-300 group-hover:from-white/50" />
                  <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative border-y border-white/5 bg-gradient-to-b from-black via-black/80 to-black py-12 sm:py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center sm:mb-12 md:mb-16">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{t('featuredBrands')}</p>
            <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>
              {locale === 'ua' ? 'Ікони, що задають темп' : 'Icons that set the tempo'}
            </h2>
          </div>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 perspective-1000">
            {topBrands.map((brand) => {
              const logoSrc = getBrandLogo(brand.name);
              const isPlaceholder = logoSrc === '/logos/placeholder.svg';
              const isDark = isDarkLogo(logoSrc);
              
              return (
              <TiltedCard
                key={brand.name}
                onClick={() => setSelectedBrand(brand)}
                className="flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-8 p-8 text-center group"
              >
                <div className="absolute right-4 top-4" style={{ transform: 'translateZ(20px)' }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white">
                    ↗
                  </div>
                </div>
                
                <div className="relative h-32 w-full transition-transform duration-500 group-hover:scale-110" style={{ transform: 'translateZ(40px)' }}>
                  {isPlaceholder ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-2xl font-bold text-white/20 uppercase tracking-widest">{brand.name}</span>
                    </div>
                  ) : (
                    <Image
                      src={logoSrc}
                      alt={brand.name}
                      fill
                      className={`object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] ${isDark ? 'brightness-0 invert' : ''}`}
                      sizes="(max-width: 768px) 100vw, 300px"
                      unoptimized
                    />
                  )}
                </div>

                <div className="space-y-4" style={{ transform: 'translateZ(30px)' }}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 transition-colors group-hover:text-white/60">
                    {locale === 'ua' ? 'Офіційна програма' : 'Official Program'}
                  </p>
                  
                  <div className="relative mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10">
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/80">
                      {locale === 'ua' ? 'Відкрити' : 'Explore'}
                    </span>
                    <span className="text-white/60 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white">→</span>
                  </div>
                </div>
              </TiltedCard>
            )})}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{locale === 'ua' ? 'Каталог' : 'Atlas'}</p>
          <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>{t('allBrands')}</h2>
        </div>

        <div className="flex justify-center">
          <div className="relative w-full max-w-3xl">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-gradient-to-r from-white/10 to-white/[0.02] px-6 py-3 text-base text-white placeholder-white/40 shadow-[0_0_40px_rgba(255,255,255,0.07)] focus:outline-none focus:ring-2 focus:ring-white/40 sm:rounded-3xl sm:px-8 sm:py-3.5 sm:text-lg md:px-10 md:py-4"
            />
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/40 sm:right-6 md:right-8">⌕</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:mt-12 xl:grid-cols-4">
          {filteredBrands.length > 0 ? (
            filteredBrands.map((brand) => {
              const origin = getBrandOrigin(brand);
              const subcategory = getBrandSubcategory(brand);
              const collections = getBrandCollections(brand.name);
              const logoSrc = getBrandLogo(brand.name);
              const isDark = isDarkLogo(logoSrc);

              return (
                <motion.button
                  key={brand.name}
                  onClick={() => setSelectedBrand(brand)}
                  whileHover={{ y: -6 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:p-5 md:p-6"
                >
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{
                    background:
                      'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 60%)',
                  }} />
                  <div className="relative flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/50 sm:text-xs sm:tracking-[0.3em]">
                    <div className="flex items-center gap-2">
                      <span>{origin}</span>
                      {subcategory && (
                        <>
                          <span className="text-white/30">·</span>
                          <span className="text-white/60">{subcategory}</span>
                        </>
                      )}
                    </div>
                    <span className="text-white/70 group-hover:text-white">↗</span>
                  </div>
                  <div className="relative mt-3 h-16 sm:mt-4 sm:h-20">
                    <Image
                      src={logoSrc}
                      alt={brand.name}
                      fill
                      className={`object-contain ${isDark ? 'brightness-0 invert' : ''}`}
                      sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 20vw"
                      unoptimized
                    />
                  </div>
                  <div className="mt-3 text-xl font-light text-white sm:mt-4 sm:text-2xl">{brand.name}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                    {collections.length > 0
                      ? collections.slice(0, 3).map((collection) => (
                          <span key={collection.slug} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-white/70 sm:px-3 sm:py-1 sm:text-xs">
                            {locale === 'ua' ? collection.title.ua : collection.title.en}
                          </span>
                        ))
                      : (
                          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-white/50 sm:px-3 sm:py-1 sm:text-xs">
                            {locale === 'ua' ? 'Індивідуально' : 'Bespoke'}
                          </span>
                        )}
                  </div>
                </motion.button>
              );
            })
          ) : (
            <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-xl text-white/70">
              {t('noBrands')}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-1.5 sm:mt-8 sm:gap-2 md:mt-12">
          <button
            onClick={() => setActiveLetter(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition sm:px-4 sm:py-2 sm:text-sm sm:tracking-[0.3em] ${
              !activeLetter
                ? 'bg-white text-black'
                : 'border border-white/20 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            {t('all')}
          </button>
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => setActiveLetter(letter)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-[0.3em] ${
                activeLetter === letter
                  ? 'bg-white text-black'
                  : 'border border-white/15 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              {letter}
            </button>
          ))}
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
              className="mx-4 mt-6 max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-black to-white/[0.05] p-5 text-white shadow-2xl sm:mx-auto sm:mt-10 sm:rounded-3xl sm:p-6 md:mt-16 md:rounded-[32px] md:p-8"
              style={{ maxHeight: 'calc(100vh - 3rem)' }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="relative h-12 w-32 sm:h-14 sm:w-36 md:h-16 md:w-40">
                  <Image
                    src={getBrandLogo(selectedBrand.name)}
                    alt={selectedBrand.name}
                    fill
                    className={`object-contain ${isDarkLogo(getBrandLogo(selectedBrand.name)) ? 'brightness-0 invert' : ''}`}
                    sizes="160px"
                    unoptimized
                  />
                </div>
                <button
                  onClick={() => setSelectedBrand(null)}
                  className="self-start rounded-full border border-white/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-white/70 hover:border-white hover:text-white sm:self-auto sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.4em]"
                >
                  {tPage('close')}
                </button>
              </div>

              <div className="mt-5 grid gap-6 sm:mt-6 sm:gap-7 md:mt-6 md:grid-cols-2 md:gap-8">
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
                  <h3 className="mt-1.5 text-2xl font-light sm:mt-2 sm:text-3xl">{selectedBrandStory.headline[locale]}</h3>
                  <p className="mt-3 text-xs text-white/70 sm:mt-4 sm:text-sm">{selectedBrandStory.description[locale]}</p>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {selectedBrandStory.highlights?.map((highlight, index) => (
                    <div key={highlight.en + index} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80 sm:rounded-2xl sm:p-4 sm:text-sm">
                      {highlight[locale]}
                    </div>
                  ))}
                  <div className="rounded-xl border border-white/10 p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 sm:text-xs sm:tracking-[0.4em]">
                      {tPage('categories')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                      {selectedBrandCollections.length > 0 ? (
                        selectedBrandCollections.map((collection) => (
                          <span key={collection.slug} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-white/70 sm:px-3 sm:py-1 sm:text-xs">
                            {locale === 'ua' ? collection.title.ua : collection.title.en}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-white/50 sm:px-3 sm:py-1 sm:text-xs">
                          {tPage('bespokeBuilds')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80 sm:mt-7 sm:gap-4 sm:rounded-3xl sm:p-5 sm:text-sm md:mt-8 md:flex-row md:items-center md:justify-between md:p-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 sm:text-xs sm:tracking-[0.4em]">
                    {tPage('expertSupport')}
                  </p>
                  <p className="mt-1.5 text-sm text-white sm:mt-2 sm:text-base">
                    {tPage('expertMessage')}
                  </p>
                </div>
                <Link
                  href={`/${locale}/contact`}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white bg-white px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-transparent hover:text-white sm:px-6 sm:py-3 sm:text-sm"
                >
                  {tPage('requestProgram')}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pb-10" />
    </div>
  );
}
