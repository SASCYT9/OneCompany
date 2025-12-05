// src/app/[locale]/auto/AutoPageClient.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

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
  'Brabus',
  'Mansory',
  'HRE wheels',
  'Urban Automotive',
  'Eventuri',
  'KW Suspension',
  'Novitec',
  'ABT',
];

const heroStats: { value: string | LocalizedCopy; label: LocalizedCopy; caption: LocalizedCopy }[] = [
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
    value: { en: 'Kyiv', ua: 'Київ' },
    label: { en: 'Baseina St, 21B', ua: 'вул. Басейна, 21Б' },
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
  'KW Suspension': {
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
  'HRE wheels': {
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
  'ABT': {
    headline: { en: 'ABT Sportsline Power Programs', ua: 'ABT Sportsline — програми потужності' },
    description: {
      en: 'Official Audi tuning partner with ECU calibrations, aero kits and forged wheels for the VAG platform.',
      ua: 'Офіційний тюнінг-партнер Audi з прошивками ECU, аеро-китами та кованими дисками для платформи VAG.',
    },
    highlights: [
      { en: 'ABT Power S stages with warranty', ua: 'ABT Power S з гарантією' },
      { en: 'RS & RSQ aero programs', ua: 'Аеро програми для RS та RSQ' },
      { en: 'Sport wheels & suspension kits', ua: 'Спортивні диски та комплекти підвіски' },
    ],
  },
};

const automotiveCategories = categoryData.filter((cat) => cat.segment === 'auto');

// Brand configurations for the legendary grid
/* eslint-disable @typescript-eslint/no-unused-vars */
const LEGENDARY_BRAND_CONFIG: Record<string, {
  flag: string;
  country: string;
  tag?: string;
  tagColor?: string;
  accentColor: string;
  description: { en: string; ua: string };
  invertLogo?: boolean;
}> = {
  'Akrapovic': {
    flag: '🇸🇮',
    country: 'Slovenia',
    tag: 'Performance Exhaust',
    accentColor: 'red',
    description: { en: 'Premium titanium exhaust systems', ua: 'Титанові вихлопні системи преміум класу' },
  },
  'Brabus': {
    flag: '🇩🇪',
    country: 'Germany',
    accentColor: 'zinc',
    description: { en: 'Premium tuning', ua: 'Преміум тюнінг' },
    invertLogo: true,
  },
  'Mansory': {
    flag: '🇩🇪',
    country: 'Germany',
    tag: 'Luxury',
    tagColor: 'amber',
    accentColor: 'amber',
    description: { en: 'Premium body kits', ua: 'Преміум обвіси' },
    invertLogo: true,
  },
  'HRE wheels': {
    flag: '🇺🇸',
    country: 'USA',
    tag: 'Forged Wheels',
    accentColor: 'sky',
    description: { en: 'Premium forged wheels', ua: 'Ковані диски преміум класу' },
  },
  'Urban Automotive': {
    flag: '🇬🇧',
    country: 'UK',
    tag: 'Body Kits',
    accentColor: 'emerald',
    description: { en: 'Premium body kits', ua: 'Преміум обвіси' },
    invertLogo: true,
  },
  'Eventuri': {
    flag: '🇬🇧',
    country: 'UK',
    accentColor: 'cyan',
    description: { en: 'Intake systems', ua: 'Впускні системи' },
    invertLogo: true,
  },
  'KW Suspension': {
    flag: '🇩🇪',
    country: 'Germany',
    accentColor: 'orange',
    description: { en: 'Suspension', ua: 'Підвіска' },
  },
  'Novitec': {
    flag: '🇩🇪',
    country: 'Germany',
    tag: 'Supercars',
    accentColor: 'rose',
    description: { en: 'Supercar tuning', ua: 'Тюнінг суперкарів' },
    invertLogo: true,
  },
  'ABT': {
    flag: '🇩🇪',
    country: 'Germany',
    tag: 'VAG',
    accentColor: 'violet',
    description: { en: 'Premium VAG tuning', ua: 'Преміум тюнінг VAG' },
    invertLogo: true,
  },
};

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

  // Helper to find brand by name
  const findBrandByName = useCallback((name: string) => {
    return topBrands.find(b => b.name === name) || allAutomotiveBrands.find(b => b.name === name);
  }, [topBrands]);

  // Click handler for legendary brand cards
  const handleBrandClick = useCallback((brandName: string) => {
    const brand = findBrandByName(brandName);
    if (brand) {
      setSelectedBrand(brand);
    }
  }, [findBrandByName]);

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
    <div className="min-h-screen bg-black text-white font-sans">
      <section className="relative isolate overflow-hidden rounded-b-[40px] border-b border-white/10">
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover opacity-70 sm:opacity-60"
            poster="/images/eventuri/carbon-intake.jpg"
          >
            <source src="/videos/rollsbg-v3.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black sm:from-black sm:via-black/70 sm:to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)] sm:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
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

      <section className="relative border-b border-white/5 bg-black/60 py-12 sm:py-16 md:py-20">
        <div className="absolute inset-x-0 top-0 mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:gap-5 sm:px-6 md:grid-cols-3 md:gap-6">
          {programHighlights.map((card) => (
            <div
              key={card.title.en}
              className="h-full flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] sm:rounded-3xl sm:p-6"
            >
              <div className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em]">{card.eyebrow[locale]}</div>
              <h3 className="mt-3 text-xl font-light text-white sm:mt-4 sm:text-2xl">{card.title[locale]}</h3>
              <p className="mt-2 flex-1 text-xs text-white/70 sm:mt-3 sm:text-sm">{card.description[locale]}</p>
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
              href={`/${locale}/auto/categories/${cat.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-black transition-all duration-300 hover:translate-y-[-4px] sm:rounded-3xl h-full"
            >
              {/* Multi-layer box shadows for depth */}
              <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),inset_0_0_0_1px_rgba(255,255,255,0.05)] sm:rounded-3xl" />
              
              {/* Bottom glow on hover */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              
              <div className="relative p-6 sm:p-7 md:p-8 flex flex-col flex-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.6)] group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_16px_40px_rgba(0,0,0,0.7)] transition-shadow duration-300">
                {/* Title & Description */}
                <div className="min-h-[120px] sm:min-h-[140px]">
                  <h3 className="text-xl font-light text-white text-balance sm:text-2xl">{locale === 'ua' ? cat.title.ua : cat.title.en}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/60 text-pretty sm:text-[15px]">{locale === 'ua' ? cat.description.ua : cat.description.en}</p>
                  <p className="mt-2 text-[11px] text-white/40 text-pretty sm:text-xs">{locale === 'ua' ? cat.spotlight.ua : cat.spotlight.en}</p>
                </div>
                
                {/* Brand tags with relief */}
                <div className="mt-5 min-h-[80px] grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider content-start sm:text-[11px]">
                  {cat.brands.map((name) => (
                    <span key={name} className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent px-3 py-1.5 text-center font-medium text-white/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-colors duration-200 hover:border-white/[0.12] hover:from-white/[0.08]">
                      {name}
                    </span>
                  ))}
                </div>
                
                {/* Open button - clear affordance */}
                <div className="mt-auto pt-6 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-white transition-all duration-300 group-hover:gap-3">
                    {locale === 'ua' ? 'Відкрити' : 'Open'}
                    <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-white/30">{cat.brands.length} брендів</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* LEGENDARY BRANDS SHOWCASE */}
      <section className="relative py-24 sm:py-32 md:py-40 overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover opacity-30 sm:opacity-25"
          >
            <source src="/videos/rollsbg-v3.mp4" type="video/mp4" />
          </video>
        </div>
        {/* Epic Background Overlays */}
        <div className="absolute inset-0 bg-black/70 sm:bg-black/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(120,50,255,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_90%,rgba(255,150,50,0.1),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,rgba(255,50,100,0.08),transparent_40%)]" />
        
        {/* Animated Glow Orbs */}
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-20 right-1/3 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-10 w-[300px] h-[300px] bg-red-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-16 sm:mb-20 md:mb-28 text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="text-5xl font-extralight tracking-tight text-white sm:text-6xl md:text-8xl"
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
              {locale === 'ua' ? 'Бренди, що формують індустрію' : 'Brands that shape the industry'}
            </motion.p>
          </div>
          
          {/* Legendary Grid */}
          <div className="grid grid-cols-12 gap-4 sm:gap-5 lg:gap-6 auto-rows-[minmax(180px,auto)]">
            
            {/* AKRAPOVIC - Hero Card */}
            <motion.button
              onClick={() => handleBrandClick('Akrapovic')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="group relative col-span-12 lg:col-span-8 row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              {/* Gradient Border */}
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-red-500/40 via-orange-500/20 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-black" />
              </div>
              
              {/* Animated Glow on Hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-1000">
                <div className="absolute -inset-4 bg-gradient-to-r from-red-500/25 via-orange-500/15 to-yellow-500/10 rounded-[3rem] blur-3xl" />
              </div>
              
              {/* Content */}
              <div className="relative h-full min-h-[320px] sm:min-h-[380px] p-6 sm:p-8 lg:p-12 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇸🇮</span>
                    <span className="text-xs sm:text-sm uppercase tracking-[0.2em] text-red-400/90 font-medium">
                      Slovenia
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full">
                    Performance Exhaust
                  </span>
                </div>
                
                <div className="flex-1 flex items-center justify-center py-6 sm:py-10">
                  <div className="relative w-full max-w-[420px] h-28 sm:h-36 lg:h-44">
                    <Image
                      src={getBrandLogo('Akrapovic')}
                      alt="Akrapovic"
                      fill
                      className="object-contain drop-shadow-[0_0_60px_rgba(255,100,50,0.4)] transition-all duration-700 group-hover:scale-110 group-hover:drop-shadow-[0_0_80px_rgba(255,100,50,0.5)]"
                      unoptimized
                    />
                  </div>
                </div>
                
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Akrapovic</p>
                    <p className="text-sm sm:text-base text-zinc-400 mt-2">{locale === 'ua' ? 'Титанові вихлопні системи преміум класу' : 'Premium titanium exhaust systems'}</p>
                  </div>
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/20 border border-red-500/30 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-red-400/50 group-hover:shadow-[0_0_40px_rgba(255,100,50,0.4)]">
                    <svg className="h-6 w-6 sm:h-7 sm:w-7 text-red-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* BRABUS - Tall Card */}
            <motion.button
              onClick={() => handleBrandClick('Brabus')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="group relative col-span-6 lg:col-span-4 row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-zinc-400/30 via-zinc-500/10 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 to-black" />
              </div>
              
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-zinc-400/20 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              
              <div className="relative h-full min-h-[320px] sm:min-h-[380px] p-5 sm:p-6 lg:p-8 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇩🇪</span>
                  <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-zinc-400 font-medium">Germany</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="relative w-full max-w-[200px] h-16 sm:h-20 lg:h-24">
                    <Image
                      src={getBrandLogo('Brabus')}
                      alt="Brabus"
                      fill
                      className="object-contain brightness-0 invert drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-700 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                </div>
                
                <div>
                  <p className="text-xl sm:text-2xl font-light text-white">BRABUS</p>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-1">{locale === 'ua' ? 'Преміум тюнінг' : 'Premium tuning'}</p>
                </div>
                
                <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:bg-white/10 group-hover:border-white/20">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white/70 transition-transform duration-500 group-hover:-rotate-45 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </div>
              </div>
            </motion.button>

            {/* MANSORY - Wide Card */}
            <motion.button
              onClick={() => handleBrandClick('Mansory')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="group relative col-span-6 lg:col-span-5 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-amber-400/40 via-yellow-500/15 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
              </div>
              
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-amber-500/25 via-yellow-500/15 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              
              <div className="relative h-full p-5 sm:p-6 lg:p-8 flex flex-col min-h-[200px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇩🇪</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-amber-400/80 font-medium">Germany</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs uppercase tracking-widest text-amber-400/70 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    <span className="text-amber-400">★</span> Luxury
                  </span>
                </div>
                
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[220px] h-12 sm:h-16">
                    <Image
                      src={getBrandLogo('Mansory')}
                      alt="Mansory"
                      fill
                      className="object-contain brightness-0 invert opacity-95 drop-shadow-[0_0_25px_rgba(255,200,50,0.25)] transition-all duration-700 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                </div>
                
                <p className="text-lg sm:text-xl font-light text-white">Mansory</p>
              </div>
              
              <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-amber-400/40">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </div>
            </motion.button>

            {/* HRE */}
            <motion.button
              onClick={() => handleBrandClick('HRE wheels')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="group relative col-span-6 sm:col-span-6 lg:col-span-4 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-sky-500/30 to-blue-600/10 p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(1.5rem-1.5px)] sm:rounded-[calc(2rem-1.5px)] bg-gradient-to-br from-zinc-900 to-zinc-950" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative h-full p-5 sm:p-6 flex flex-col min-h-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇺🇸</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-sky-400/80 font-medium">USA</span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-2.5 py-1 rounded-full">Forged Wheels</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[160px] h-16 sm:h-20">
                    <Image src={getBrandLogo('HRE wheels')} alt="HRE" fill className="object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.2)] transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-base sm:text-lg font-medium text-white">HRE Wheels</p>
                    <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">{locale === 'ua' ? 'Ковані диски преміум класу' : 'Premium forged wheels'}</p>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* URBAN AUTOMOTIVE */}
            <motion.button
              onClick={() => handleBrandClick('Urban Automotive')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="group relative col-span-6 sm:col-span-4 lg:col-span-4 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-emerald-500/25 to-transparent p-[1px]">
                <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] sm:rounded-[calc(2rem-1px)] bg-zinc-900" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇬🇧</span>
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-emerald-400/70">UK</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-600">Body Kits</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[140px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Urban Automotive')} alt="Urban Automotive" fill className="object-contain brightness-0 invert opacity-85 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Urban Automotive</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5">{locale === 'ua' ? 'Преміум обвіси' : 'Premium body kits'}</p>
              </div>
            </motion.button>

            {/* EVENTURI */}
            <motion.button
              onClick={() => handleBrandClick('Eventuri')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="group relative col-span-6 sm:col-span-4 lg:col-span-3 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-cyan-500/25 to-transparent p-[1px]">
                <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] sm:rounded-[calc(2rem-1px)] bg-zinc-900" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇬🇧</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-cyan-400/70">UK</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[110px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Eventuri')} alt="Eventuri" fill className="object-contain brightness-0 invert opacity-85 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Eventuri</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5">{locale === 'ua' ? 'Впускні системи' : 'Intake systems'}</p>
              </div>
            </motion.button>

            {/* KW */}
            <motion.button
              onClick={() => handleBrandClick('KW Suspension')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="group relative col-span-6 sm:col-span-4 lg:col-span-3 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-orange-500/25 to-transparent p-[1px]">
                <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] sm:rounded-[calc(2rem-1px)] bg-zinc-900" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇩🇪</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-orange-400/70">Germany</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[90px] h-10 sm:h-12">
                    <Image src={getBrandLogo('KW Suspension')} alt="KW" fill className="object-contain transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">KW Suspensions</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5">{locale === 'ua' ? 'Підвіска' : 'Suspension'}</p>
              </div>
            </motion.button>

            {/* NOVITEC */}
            <motion.button
              onClick={() => handleBrandClick('Novitec')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="group relative col-span-12 sm:col-span-8 lg:col-span-6 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-rose-500/30 via-pink-500/15 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 to-black" />
              </div>
              
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-rose-500/20 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              
              <div className="relative h-full p-5 sm:p-6 lg:p-8 flex flex-col min-h-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇩🇪</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-rose-400/80 font-medium">Germany</span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full">Ferrari • Lamborghini</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[180px] h-14 sm:h-16">
                    <Image
                      src={getBrandLogo('Novitec')}
                      alt="Novitec"
                      fill
                      className="object-contain brightness-0 invert opacity-95 drop-shadow-[0_0_20px_rgba(255,100,150,0.2)] transition-all duration-700 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg sm:text-xl font-light text-white">Novitec</p>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-1">{locale === 'ua' ? 'Суперкар тюнінг' : 'Supercar tuning'}</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-rose-400/40">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* ABT */}
            <motion.button
              onClick={() => handleBrandClick('ABT')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="group relative col-span-12 sm:col-span-4 lg:col-span-6 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-violet-500/30 via-purple-500/15 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 to-black" />
              </div>
              
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-violet-500/20 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              
              <div className="relative h-full p-5 sm:p-6 lg:p-8 flex flex-col min-h-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇩🇪</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-violet-400/80 font-medium">Germany</span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full">Audi • VW</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[140px] h-14 sm:h-16">
                    <Image
                      src={getBrandLogo('ABT')}
                      alt="ABT"
                      fill
                      className="object-contain brightness-0 invert opacity-95 drop-shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-700 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg sm:text-xl font-light text-white">ABT Sportsline</p>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-1">{locale === 'ua' ? 'Audi та VW тюнінг' : 'Audi & VW tuning'}</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-violet-400/40">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* +160 BRANDS CTA */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="group relative col-span-12 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
              onClick={() => {
                const catalogSection = document.getElementById('brand-catalog');
                catalogSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {/* Animated Gradient Border */}
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-orange-500/30 p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
              </div>
              
              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
                  <div className="text-center lg:text-left">
                    <div className="flex items-baseline gap-3 justify-center lg:justify-start">
                      <span className="text-5xl sm:text-6xl lg:text-7xl font-extralight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                        +160
                      </span>
                      <span className="text-lg sm:text-xl text-zinc-400 font-light">
                        {locale === 'ua' ? 'брендів' : 'brands'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {locale === 'ua' ? 'Повний каталог преміум автозапчастин та аксесуарів' : 'Complete catalog of premium auto parts & accessories'}
                    </p>
                  </div>
                  
                  {/* CTA Button */}
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/15 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-white/30 group-hover:shadow-[0_0_50px_rgba(255,255,255,0.15)]">
                    <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
                
                {/* Infinite Scrolling Carousel */}
                <div className="relative overflow-hidden">
                  {/* Gradient fades */}
                  <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />
                  
                  {/* First row - scrolling left */}
                  <div className="flex gap-6 mb-4 animate-scroll-left">
                    {[...allAutomotiveBrands.slice(0, 20), ...allAutomotiveBrands.slice(0, 20)].map((brand, idx) => (
                      <div 
                        key={`row1-${brand.name}-${idx}`} 
                        className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                      >
                        <div className="relative w-full h-full">
                          <Image 
                            src={getBrandLogo(brand.name)} 
                            alt={brand.name} 
                            fill 
                            className="object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" 
                            unoptimized 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Second row - scrolling right */}
                  <div className="flex gap-6 animate-scroll-right">
                    {[...allAutomotiveBrands.slice(20, 40), ...allAutomotiveBrands.slice(20, 40)].map((brand, idx) => (
                      <div 
                        key={`row2-${brand.name}-${idx}`} 
                        className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                      >
                        <div className="relative w-full h-full">
                          <Image 
                            src={getBrandLogo(brand.name)} 
                            alt={brand.name} 
                            fill 
                            className="object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity" 
                            unoptimized 
                          />
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

      <section id="brand-catalog" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
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
                    {/* Radial backlight for dark logos */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-[120%] h-[120%] transition-all duration-500 ${
                        isDark 
                          ? 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.9)_0%,_rgba(255,255,255,0.6)_40%,_transparent_70%)]' 
                          : 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.3)_0%,_rgba(255,255,255,0.1)_50%,_transparent_70%)]'
                      }`} />
                    </div>
                    <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.3))' }}>
                      <Image
                        src={logoSrc}
                        alt={brand.name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 20vw"
                        unoptimized
                      />
                    </div>
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
                <div className="relative h-16 w-40 sm:h-20 sm:w-48 md:h-24 md:w-56">
                  {/* Radial backlight for dark logos */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-[120%] h-[120%] ${
                      isDarkLogo(getBrandLogo(selectedBrand.name))
                        ? 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.9)_0%,_rgba(255,255,255,0.6)_40%,_transparent_70%)]' 
                        : 'bg-[radial-gradient(ellipse,_rgba(255,255,255,0.3)_0%,_rgba(255,255,255,0.1)_50%,_transparent_70%)]'
                    }`} />
                  </div>
                  <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.3))' }}>
                    <Image
                      src={getBrandLogo(selectedBrand.name)}
                      alt={selectedBrand.name}
                      fill
                      className="object-contain"
                      sizes="224px"
                      unoptimized
                    />
                  </div>
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
