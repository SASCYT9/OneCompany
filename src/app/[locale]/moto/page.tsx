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
import { isDarkLogo } from '@/lib/darkLogos';
import { categoryData } from '@/lib/categoryData';

type LocalizedCopy = { en: string; ua: string; [key: string]: string };

type BrandStory = {
  headline: LocalizedCopy;
  description: LocalizedCopy;
  highlights?: LocalizedCopy[];
};

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
  'Austin Racing',
  'Bitubo Suspension',
  'Brembo',
  'Ilmberger Carbon',
  'Rotobox',
  'CNC Racing',
  'Accossato',
  'ValterMoto',
];

// Legendary 8 moto brands for showcase section
const LEGENDARY_MOTO_BRANDS = [
  'Akrapovic',
  'SC-Project', 
  'Termignoni',
  'Brembo',
  'Ilmberger Carbon',
  'Rotobox',
  'Austin Racing',
  'CNC Racing',
];

// Brand metadata for legendary section
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
    flag: '🇸🇮',
    category: { en: 'Performance Exhaust', ua: 'Вихлопні системи' },
    tagline: { en: 'Titanium exhaust mastery', ua: 'Титанові вихлопні системи' },
    gradient: 'from-red-500/40 via-orange-500/20 to-transparent',
    glowColor: 'rgba(255,100,50,0.4)',
  },
  'SC-Project': {
    country: 'Italy',
    flag: '🇮🇹',
    category: { en: 'Race Exhaust', ua: 'Гоночні вихлопи' },
    tagline: { en: 'MotoGP-proven technology', ua: 'Технології з MotoGP' },
    gradient: 'from-emerald-500/30 via-teal-500/15 to-transparent',
    glowColor: 'rgba(16,185,129,0.3)',
  },
  'Termignoni': {
    country: 'Italy',
    flag: '🇮🇹',
    category: { en: 'Exhaust Systems', ua: 'Вихлопні системи' },
    tagline: { en: 'Italian exhaust heritage', ua: 'Італійська спадщина вихлопів' },
    gradient: 'from-amber-500/30 via-yellow-500/15 to-transparent',
    glowColor: 'rgba(245,158,11,0.3)',
  },
  'Brembo': {
    country: 'Italy',
    flag: '🇮🇹',
    category: { en: 'Braking Systems', ua: 'Гальмівні системи' },
    tagline: { en: 'The art of stopping', ua: 'Мистецтво гальмування' },
    gradient: 'from-red-600/35 via-red-500/15 to-transparent',
    glowColor: 'rgba(220,38,38,0.35)',
  },
  'Ilmberger Carbon': {
    country: 'Germany',
    flag: '🇩🇪',
    category: { en: 'Carbon Fiber', ua: 'Карбонові елементи' },
    tagline: { en: 'German carbon precision', ua: 'Німецька карбонова точність' },
    gradient: 'from-zinc-400/30 via-zinc-500/10 to-transparent',
    glowColor: 'rgba(161,161,170,0.25)',
  },
  'Rotobox': {
    country: 'Slovenia',
    flag: '🇸🇮',
    category: { en: 'Carbon Wheels', ua: 'Карбонові диски' },
    tagline: { en: 'Lightweight carbon wheels', ua: 'Легкі карбонові диски' },
    gradient: 'from-blue-500/30 via-cyan-500/15 to-transparent',
    glowColor: 'rgba(59,130,246,0.3)',
  },
  'Austin Racing': {
    country: 'UK',
    flag: '🇬🇧',
    category: { en: 'Race Exhaust', ua: 'Гоночні вихлопи' },
    tagline: { en: 'British racing exhaust', ua: 'Британські гоночні вихлопи' },
    gradient: 'from-purple-500/30 via-violet-500/15 to-transparent',
    glowColor: 'rgba(139,92,246,0.3)',
  },
  'CNC Racing': {
    country: 'Italy',
    flag: '🇮🇹',
    category: { en: 'Racing Components', ua: 'Гоночні компоненти' },
    tagline: { en: 'Precision billet parts', ua: 'Точні деталі з білета' },
    gradient: 'from-rose-500/30 via-pink-500/15 to-transparent',
    glowColor: 'rgba(244,63,94,0.3)',
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
    label: { en: 'partner garages', ua: 'партнерські майстерні' },
    caption: { en: 'Installation & setup', ua: 'Встановлення та налаштування' },
  },
  {
    value: { en: 'Kyiv', ua: 'Київ' },
    label: { en: 'Baseina St, 21B', ua: 'вул. Басейна, 21Б' },
    caption: { en: 'Headquarters & logistics hub', ua: 'Штаб-квартира та логістичний хаб' },
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
    title: { en: 'Street & Track selection', ua: 'Стріт та трек підбір' },
    description: {
      en: 'We audit build sheets, plan compatibility and secure allocations for road and race applications.',
      ua: 'Аналізуємо проєкт, перевіряємо сумісність та надаємо рекомендації для міста та треку.',
    },
    meta: { en: 'VIN verification & spec sheets', ua: 'Перевірка VIN та підтвердження сумісності' },
  },
  {
    eyebrow: { en: 'Logistics', ua: 'Логістика' },
    title: { en: 'Global delivery windows', ua: 'Глобальна доставка' },
    description: {
      en: 'Air freight and road convoys to Kyiv, Warsaw, Dubai and beyond.',
      ua: 'Доставляємо клієнтам по всьому світу. Оптимальні та гнучкі умови.',
    },
    meta: { en: 'Insurance & tracking every 48h', ua: 'One Company Global · Надійність та безпека' },
  },
  {
    eyebrow: { en: 'Installation network', ua: 'Світові бренди' },
    title: { en: 'Partner workshops', ua: 'Партнерські майстерні' },
    description: {
      en: 'Certified partners for suspension setup, ECU calibration and tire service.',
      ua: 'Ми працюємо з перевіреними майстернями для налаштування підвіски, ECU та шиномонтажу.',
    },
    meta: { en: 'Quality guarantee & authenticity', ua: 'Гарантія якості та автентичності' },
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

const curatedBrandStories: Record<string, BrandStory> = {
  Akrapovic: {
    headline: { en: 'Akrapovic MotoGP titanium lab', ua: 'Akrapovic · титановий MotoGP-центр' },
    description: {
      en: 'Full titanium systems with carbon sleeves, dyno verified for Ducati, BMW and liter-bike paddocks.',
      ua: 'Повні титанові системи з карбоновими кожухами, підтверджені діно для Ducati, BMW та літрових байків.',
    },
    highlights: [
      { en: 'Evolution Racing & Slip-On Street', ua: 'Evolution Racing та Slip-On Street' },
      { en: 'Custom logo badging + heat mapping', ua: 'Кастомні бейджі та термо-графіки' },
      { en: 'Door-to-door insured freight', ua: 'Door-to-door доставка зі страхуванням' },
    ],
  },
  'SC-Project': {
    headline: { en: 'SC-Project WSBK soundtrack', ua: 'SC-Project · звук WSBK' },
    description: {
      en: 'Valved and race-only exhausts with double-wall headers and Moto2-derived silencers.',
      ua: 'Клапанні та трекові вихлопи з двошаровими колекторами та глушниками з Moto2.',
    },
    highlights: [
      { en: 'CR-T, S1, S1-GP allocations', ua: 'CR-T, S1, S1-GP квоти' },
      { en: 'Lambda-safe bungs & hardware kits', ua: 'Лямбда-безпечні бонги й кріплення' },
      { en: 'Install supervision + ECU pairing', ua: 'Контроль монтажу та підбір ECU' },
    ],
  },
  Termignoni: {
    headline: { en: 'Termignoni Corse heritage', ua: 'Termignoni · спадок Corse' },
    description: {
      en: 'Signature systems for Ducati and Aprilia with matching ECU flashes and upmap slots.',
      ua: 'Фірмові системи Ducati та Aprilia з ECU-прошивками та upmap слотами.',
    },
    highlights: [
      { en: 'Corse and Relevance lines in stock', ua: 'Лінійки Corse та Relevance на складі' },
      { en: 'Track-legal paperwork bundles', ua: 'Пакети документів для треку' },
      { en: 'Paint-to-sample carbon shields', ua: 'Карбонові щитки з індивідуальним фарбуванням' },
    ],
  },
  Arrow: {
    headline: { en: 'Arrow Pro-Race studio', ua: 'Arrow Pro-Race студія' },
    description: {
      en: 'Slip-ons, headers and MotoGP-inspired silencers with titanium or nichrome options.',
      ua: 'Slip-on, колектори та глушники в стилі MotoGP з титану чи ніхрому.',
    },
    highlights: [
      { en: 'Road & race homologations', ua: 'Гомологації для дороги та треку' },
      { en: 'Quick-turn spare parts', ua: 'Швидкі поставки запчастин' },
      { en: 'Dyno-verified gains per platform', ua: 'Діно-графіки для кожної платформи' },
    ],
  },
  'Austin Racing': {
    headline: { en: 'Austin Racing handmade titanium', ua: 'Austin Racing · titanium hand-made' },
    description: {
      en: 'Handcrafted titanium exhausts for superbikes with bespoke geometry and custom branding.',
      ua: 'Титанові вихлопи ручної роботи для супербайків з індивідуальною геометрією та брендингом.',
    },
    highlights: [
      { en: 'TIG-welded race manifolds', ua: 'TIG-колектори для треку' },
      { en: 'Weight-saving titanium headers', ua: 'Титанові колектори з легкою вагою' },
      { en: 'Lifetime structural warranty', ua: 'Довічна структурна гарантія' },
    ],
  },
  'Bitubo Suspension': {
    headline: { en: 'Bitubo track-day suspension', ua: 'Bitubo · трекові підвіски' },
    description: {
      en: 'Competition-ready cartridge kits, steering dampers and full-rebuild services for race bikes.',
      ua: 'Конкурентні картриджі, демпфери керма та повний ребілд для трекових байків.',
    },
    highlights: [
      { en: 'Dyno-driven valving specs', ua: 'Діно-підібрані клапанні спеки' },
      { en: 'Track corner-weighting sessions', ua: 'Трекові сесії балансування ваги' },
      { en: 'Pit-side rebuild service', ua: 'Сервіс ребілду в піт-лейні' },
    ],
  },
  Brembo: {
    headline: { en: 'Brembo GP4 braking suites', ua: 'Brembo GP4 гальмівні комплекти' },
    description: {
      en: "Monoblock calipers, Corsa Corta masters and T-drive rotors spec'd for pit crews.",
      ua: 'Моноблок супорти, головні циліндри Corsa Corta та диски T-drive для трекових команд.',
    },
    highlights: [
      { en: 'Track bedding procedures', ua: 'Процедури обкатки для треку' },
      { en: 'Pad libraries for every compound', ua: 'Бібліотека колодок усіх сумішей' },
      { en: 'On-site pedal feel tuning', ua: 'Налаштування педалі на місці' },
    ],
  },
  'Ilmberger Carbon': {
    headline: { en: 'Ilmberger autoclave carbon', ua: 'Ilmberger · автоклавний карбон' },
    description: {
      en: 'Autoclave pre-preg carbon bodywork with FIM certification and paint-matched finishing.',
      ua: 'Автоклавний препрег-карбон з FIM сертифікацією та фарбуванням під ключ.',
    },
    highlights: [
      { en: 'UV-stable clear coat finishes', ua: 'UV-стабільні лакові покриття' },
      { en: 'Integrated mounting hardware', ua: 'Вбудоване кріплення' },
      { en: 'Lifetime structural warranty', ua: 'Довічна структурна гарантія' },
    ],
  },
  Rotobox: {
    headline: { en: 'Rotobox carbon wheel lab', ua: 'Rotobox · лабораторія карбонових дисків' },
    description: {
      en: 'Monocoque carbon wheels with TÜV paperwork and custom ceramic coating.',
      ua: 'Монококові карбонові диски з TÜV документами та кастомним керамічним покриттям.',
    },
    highlights: [
      { en: 'Engineered for ABS & TPMS', ua: 'Розроблені під ABS та TPMS' },
      { en: 'Integrated ceramic bearings', ua: 'Вбудовані керамічні підшипники' },
      { en: 'Precision balancing service', ua: 'Прецизійне балансування' },
    ],
  },
  'CNC Racing': {
    headline: { en: 'CNC Racing billet controls', ua: 'CNC Racing · білетний контроль' },
    description: {
      en: 'CNC-machined rearsets, clip-ons and master cylinders with ergonomic geometry for track use.',
      ua: 'CNC-фрезеровані rearsets, кліпони та головні циліндри з ергономічною геометрією для треку.',
    },
    highlights: [
      { en: 'Adjustable footpeg positioning', ua: 'Регульовані позиції підніжок' },
      { en: 'Quick-shifter compatible', ua: 'Сумісність з квік-шифтером' },
      { en: 'Anodized or ceramic finishes', ua: 'Анодовані або керамічні фініші' },
    ],
  },
  Accossato: {
    headline: { en: 'Accossato race controls', ua: 'Accossato · рейсинг-контролі' },
    description: {
      en: 'Radial master cylinders, folding levers and lightweight rearsets engineered for Italian superbikes.',
      ua: 'Радіальні головні циліндри, складні важелі та легкі rearsets для італійських супербайків.',
    },
    highlights: [
      { en: 'Billet aluminum construction', ua: 'Конструкція з білетного алюмінію' },
      { en: 'Lever ratio adjustment', ua: 'Регулювання передатного числа важеля' },
      { en: 'Race-proven ergonomics', ua: 'Перевірена трековою ергономіка' },
    ],
  },
  ValterMoto: {
    headline: { en: 'ValterMoto pit equipment', ua: 'ValterMoto · піт-обладнання' },
    description: {
      en: 'Track-side tools, paddock stands and quick-change kits for race-day efficiency.',
      ua: 'Трекові інструменти, паддок-стенди та швидкозмінні комплекти для ефективності в race-day.',
    },
    highlights: [
      { en: 'Universal fitment stands', ua: 'Універсальні стенди' },
      { en: 'Tire warmer bundles', ua: 'Комплекти підігрівачів' },
      { en: 'Pit-lane toolkits', ua: 'Піт-лейн тулкіти' },
    ],
  },
};

export default function MotoPage() {
  const params = useParams();
  const locale = (params.locale === 'en' ? 'en' : 'ua') as 'en' | 'ua';
  const t = useTranslations('moto');
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
        en: `\${brand.name} — bespoke moto supply`,
        ua: `\${brand.name} — індивідуальне постачання`,
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
            <source src="/videos/MotoBG-web.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black sm:from-black sm:via-black/70 sm:to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)] sm:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:gap-8 sm:px-6 sm:py-20 md:gap-10 md:py-28">
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
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] sm:rounded-3xl sm:p-5 md:p-6"
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

      {/* Product Categories Section */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{t('productCategories')}</p>
          <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>
            {locale === 'ua' ? 'Мото ' : 'Engineering Modules'}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 auto-rows-fr">
          {categoryData.filter(cat => cat.segment === 'moto').map((cat) => (
            <Link
              key={cat.slug}
              href={`/${locale}/moto/categories/${cat.slug}`}
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
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/50 sm:mt-4 sm:gap-2 sm:text-[11px] sm:tracking-[0.3em]">
                  {cat.brands.slice(0, 4).map((name) => (
                    <span key={name} className="rounded-full border border-white/10 px-2.5 py-0.5 text-white/70 sm:px-3 sm:py-1">
                      {name}
                    </span>
                  ))}
                  {cat.brands.length > 4 && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-white/50 sm:px-3 sm:py-1">
                      +{cat.brands.length - 4} {tPage('more')}
                    </span>
                  )}
                </div>
                <div className="mt-auto pt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/70 sm:pt-6 sm:gap-3 sm:text-xs sm:tracking-[0.35em]">
                  <span className="transition-colors duration-300 group-hover:text-white">
                    {tPage('open')}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent transition-all duration-300 group-hover:from-white/50" />
                  <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* LEGENDARY MOTO BRANDS SHOWCASE */}
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
            <source src="/videos/MotoBG-web.mp4" type="video/mp4" />
          </video>
        </div>
        {/* Epic Background Overlays */}
        <div className="absolute inset-0 bg-black/70 sm:bg-black/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(239,68,68,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_90%,rgba(16,185,129,0.1),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,rgba(59,130,246,0.08),transparent_40%)]" />
        
        {/* Animated Glow Orbs */}
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-20 right-1/3 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-10 w-[300px] h-[300px] bg-blue-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
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
              {locale === 'ua' ? 'Бренди, що формують індустрію мото' : 'Brands that shape the moto industry'}
            </motion.p>
          </div>
          
          {/* Legendary Grid - 12 columns layout like auto page */}
          <div className="grid grid-cols-12 gap-4 sm:gap-5 lg:gap-6 auto-rows-[minmax(180px,auto)]">
            
            {/* AKRAPOVIC - Hero Card (spans 8 cols, 2 rows) */}
            <motion.button
              onClick={() => handleBrandClick('Akrapovic')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="group relative col-span-12 lg:col-span-8 row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-red-500/40 via-orange-500/20 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-black" />
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-1000">
                <div className="absolute -inset-4 bg-gradient-to-r from-red-500/25 via-orange-500/15 to-yellow-500/10 rounded-[3rem] blur-3xl" />
              </div>
              <div className="relative h-full min-h-[280px] sm:min-h-[340px] p-5 sm:p-8 lg:p-10 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xl sm:text-2xl">🇸🇮</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-red-400/90 font-medium">Slovenia</span>
                  </div>
                  <span className="text-[9px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
                    Performance Exhaust
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center py-4 sm:py-8">
                  <div className="relative w-full max-w-[280px] sm:max-w-[350px] h-20 sm:h-28 lg:h-36">
                    <Image src={getBrandLogo('Akrapovic')} alt="Akrapovic" fill className="object-contain drop-shadow-[0_0_60px_rgba(255,100,50,0.4)] transition-all duration-700 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-light text-white tracking-tight">Akrapovic</p>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 sm:mt-2">{locale === 'ua' ? 'Титанові вихлопні системи' : 'Titanium exhaust mastery'}</p>
                  </div>
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/20 border border-red-500/30 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:border-red-400/50">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-red-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* SC-PROJECT - Tall Card (4 cols, 2 rows) */}
            <motion.button
              onClick={() => handleBrandClick('SC-Project')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="group relative col-span-6 lg:col-span-4 row-span-2 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-emerald-500/30 via-teal-500/15 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 to-black" />
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              <div className="relative h-full min-h-[320px] sm:min-h-[380px] p-5 sm:p-6 lg:p-8 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🇮🇹</span>
                  <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-emerald-400 font-medium">Italy</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="relative w-full max-w-[200px] h-16 sm:h-20 lg:h-24">
                    <Image src={getBrandLogo('SC-Project')} alt="SC-Project" fill className={`object-contain drop-shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-700 group-hover:scale-110 ${isDarkLogo(getBrandLogo('SC-Project')) ? 'brightness-0 invert' : ''}`} unoptimized />
                  </div>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-light text-white">SC-Project</p>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-1">{locale === 'ua' ? 'MotoGP технології' : 'MotoGP technology'}</p>
                </div>
                <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-500/20 group-hover:border-emerald-400/40">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </div>
              </div>
            </motion.button>

            {/* TERMIGNONI - Wide Card (5 cols) */}
            <motion.button
              onClick={() => handleBrandClick('Termignoni')}
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
                    <span className="text-xl">🇮🇹</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-amber-400/80 font-medium">Italy</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs uppercase tracking-widest text-amber-400/70 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    <span className="text-amber-400">★</span> Ducati Partner
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[220px] h-12 sm:h-16">
                    <Image src={getBrandLogo('Termignoni')} alt="Termignoni" fill className={`object-contain opacity-95 drop-shadow-[0_0_25px_rgba(255,200,50,0.25)] transition-all duration-700 group-hover:scale-110 ${isDarkLogo(getBrandLogo('Termignoni')) ? 'brightness-0 invert' : ''}`} unoptimized />
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-light text-white">Termignoni</p>
              </div>
              <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-amber-400/40">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </div>
            </motion.button>

            {/* BREMBO (4 cols) */}
            <motion.button
              onClick={() => handleBrandClick('Brembo')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="group relative col-span-6 lg:col-span-4 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-red-600/35 via-red-500/15 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(1.5rem-1.5px)] sm:rounded-[calc(2rem-1.5px)] bg-gradient-to-br from-zinc-900 to-zinc-950" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-5 sm:p-6 flex flex-col min-h-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇮🇹</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-widest text-red-400/80 font-medium">Italy</span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-2.5 py-1 rounded-full">Braking Systems</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[140px] h-16 sm:h-20">
                    <Image src={getBrandLogo('Brembo')} alt="Brembo" fill className="object-contain drop-shadow-[0_0_20px_rgba(220,38,38,0.2)] transition-all duration-500 group-hover:scale-110" unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-base sm:text-lg font-medium text-white">Brembo</p>
                    <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">{locale === 'ua' ? 'Гальма #1 у світі' : 'World\'s #1 brakes'}</p>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* ILMBERGER CARBON (4 cols) */}
            <motion.button
              onClick={() => handleBrandClick('Ilmberger Carbon')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="group relative col-span-6 sm:col-span-4 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-zinc-400/30 via-zinc-500/10 to-transparent p-[1px]">
                <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] sm:rounded-[calc(2rem-1px)] bg-zinc-900" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-400/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇩🇪</span>
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-400/70">Germany</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-600">Carbon Fiber</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[140px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Ilmberger Carbon')} alt="Ilmberger Carbon" fill className={`object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110 ${isDarkLogo(getBrandLogo('Ilmberger Carbon')) ? 'brightness-0 invert opacity-85' : ''}`} unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Ilmberger Carbon</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5">{locale === 'ua' ? 'Карбонова точність' : 'Carbon precision'}</p>
              </div>
            </motion.button>

            {/* ROTOBOX (3 cols) */}
            <motion.button
              onClick={() => handleBrandClick('Rotobox')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="group relative col-span-6 sm:col-span-4 lg:col-span-3 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-blue-500/25 to-transparent p-[1px]">
                <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] sm:rounded-[calc(2rem-1px)] bg-zinc-900" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇸🇮</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-blue-400/70">Slovenia</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[110px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Rotobox')} alt="Rotobox" fill className={`object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110 ${isDarkLogo(getBrandLogo('Rotobox')) ? 'brightness-0 invert opacity-85' : ''}`} unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Rotobox</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5">{locale === 'ua' ? 'Карбонові диски' : 'Carbon wheels'}</p>
              </div>
            </motion.button>

            {/* AUSTIN RACING (3 cols) */}
            <motion.button
              onClick={() => handleBrandClick('Austin Racing')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="group relative col-span-6 sm:col-span-4 lg:col-span-3 cursor-pointer overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] text-left"
            >
              <div className="absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-purple-500/25 to-transparent p-[1px]">
                <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] sm:rounded-[calc(2rem-1px)] bg-zinc-900" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full p-4 sm:p-5 flex flex-col min-h-[160px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇬🇧</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-purple-400/70">UK</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="relative w-full max-w-[100px] h-10 sm:h-12">
                    <Image src={getBrandLogo('Austin Racing')} alt="Austin Racing" fill className={`object-contain transition-all duration-500 group-hover:opacity-100 group-hover:scale-110 ${isDarkLogo(getBrandLogo('Austin Racing')) ? 'brightness-0 invert opacity-85' : ''}`} unoptimized />
                  </div>
                </div>
                <p className="text-sm sm:text-base font-medium text-white">Austin Racing</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-0.5">{locale === 'ua' ? 'Британський звук' : 'British sound'}</p>
              </div>
            </motion.button>

            {/* ARROW - Wide Card (6 cols) */}
            <motion.button
              onClick={() => handleBrandClick('Arrow')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="group relative col-span-12 sm:col-span-8 lg:col-span-6 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
            >
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-orange-500/30 via-amber-500/15 to-transparent p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 to-black" />
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700">
                <div className="absolute -inset-2 bg-gradient-to-br from-orange-500/20 to-transparent rounded-[3rem] blur-2xl" />
              </div>
              <div className="relative h-full p-5 sm:p-6 lg:p-8 flex flex-col min-h-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇮🇹</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-orange-400/80 font-medium">Italy</span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full">Racing Exhaust</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[180px] h-14 sm:h-16">
                    <Image src={getBrandLogo('Arrow')} alt="Arrow" fill className={`object-contain opacity-95 drop-shadow-[0_0_20px_rgba(255,150,50,0.2)] transition-all duration-700 group-hover:scale-110 ${isDarkLogo(getBrandLogo('Arrow')) ? 'brightness-0 invert' : ''}`} unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg sm:text-xl font-light text-white">Arrow Exhaust</p>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-1">{locale === 'ua' ? 'Італійський гоночний звук' : 'Italian racing sound'}</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-orange-400/40">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* CNC RACING (6 cols) */}
            <motion.button
              onClick={() => handleBrandClick('CNC Racing')}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="group relative col-span-12 sm:col-span-4 lg:col-span-6 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
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
                    <span className="text-xl">🇮🇹</span>
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-rose-400/80 font-medium">Italy</span>
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-full">Billet Parts</span>
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-full max-w-[140px] h-14 sm:h-16">
                    <Image src={getBrandLogo('CNC Racing')} alt="CNC Racing" fill className={`object-contain opacity-95 drop-shadow-[0_0_20px_rgba(244,63,94,0.2)] transition-all duration-700 group-hover:scale-110 ${isDarkLogo(getBrandLogo('CNC Racing')) ? 'brightness-0 invert' : ''}`} unoptimized />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg sm:text-xl font-light text-white">CNC Racing</p>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-1">{locale === 'ua' ? 'Білетна точність' : 'Billet precision'}</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 backdrop-blur transition-all duration-500 group-hover:scale-110 group-hover:border-rose-400/40">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400 transition-transform duration-500 group-hover:-rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* +40 BRANDS CTA with Carousel */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="group relative col-span-12 cursor-pointer overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-left"
              onClick={() => {
                const catalogSection = document.getElementById('moto-brand-catalog');
                catalogSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {/* Animated Gradient Border */}
              <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-r from-red-500/30 via-orange-500/20 to-emerald-500/30 p-[1.5px]">
                <div className="absolute inset-[1.5px] rounded-[calc(2rem-1.5px)] sm:rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
              </div>
              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
                  <div className="text-center lg:text-left">
                    <div className="flex items-baseline gap-3 justify-center lg:justify-start">
                      <span className="text-5xl sm:text-6xl lg:text-7xl font-extralight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                        +40
                      </span>
                      <span className="text-lg sm:text-xl text-zinc-400 font-light">
                        {locale === 'ua' ? 'брендів' : 'brands'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {locale === 'ua' ? 'Повний каталог мото-компонентів преміум класу' : 'Complete catalog of premium moto parts & accessories'}
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
                  <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />
                  <div className="flex gap-6 mb-4 animate-scroll-left">
                    {[...allMotoBrands.slice(0, 15), ...allMotoBrands.slice(0, 15)].map((brand, idx) => (
                      <div key={`row1-${brand.name}-${idx}`} className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                        <div className="relative w-full h-full">
                          <Image src={getBrandLogo(brand.name)} alt={brand.name} fill className={`object-contain opacity-70 hover:opacity-100 transition-opacity ${isDarkLogo(getBrandLogo(brand.name)) ? 'brightness-0 invert' : ''}`} unoptimized />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-6 animate-scroll-right">
                    {[...allMotoBrands.slice(15, 30), ...allMotoBrands.slice(15, 30)].map((brand, idx) => (
                      <div key={`row2-${brand.name}-${idx}`} className="flex-shrink-0 h-12 w-28 sm:h-14 sm:w-32 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                        <div className="relative w-full h-full">
                          <Image src={getBrandLogo(brand.name)} alt={brand.name} fill className={`object-contain opacity-70 hover:opacity-100 transition-opacity ${isDarkLogo(getBrandLogo(brand.name)) ? 'brightness-0 invert' : ''}`} unoptimized />
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
              className="mx-auto mt-16 max-w-4xl rounded-[32px] border border-white/10 bg-gradient-to-br from-black to-white/[0.05] p-8 text-white shadow-2xl"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="relative h-16 w-40">
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

      <section className="relative border-b border-white/5 bg-black/60 py-12 sm:py-16 md:py-20">
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
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5 backdrop-blur sm:rounded-3xl sm:p-6"
              >
                <div className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em]">{card.eyebrow[locale]}</div>
                <h3 className="mt-3 text-xl font-light text-white sm:mt-4 sm:text-2xl">{card.title[locale]}</h3>
                <p className="mt-2 text-xs text-white/70 sm:mt-3 sm:text-sm">{card.description[locale]}</p>
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
      </section>

      {/* All Brands Section - Moved Down */}
      <section id="moto-brand-catalog" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{locale === 'ua' ? 'Каталог' : 'Atlas'}</p>
          <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>{locale === 'ua' ? 'Атлас брендів' : 'Brand Atlas'}</h2>
          <p className="mt-4 text-base text-white/60 sm:text-lg">
            {locale === 'ua' ? `${allMotoBrands.length} брендів у портфелі` : `${allMotoBrands.length} brands in portfolio`}
          </p>
        </div>

        <div className="flex justify-center">
          <div className="relative w-full max-w-3xl">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white px-6 py-3 text-base text-black placeholder-black/40 shadow-[0_0_40px_rgba(255,255,255,0.07)] focus:outline-none focus:ring-2 focus:ring-white/40 sm:rounded-3xl sm:p-8 sm:py-3.5 sm:text-lg md:px-10 md:py-4"
            />
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/40 sm:right-6 md:right-8">⌕</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:mt-12 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBrands.length > 0 ? (
            filteredBrands.map((brand) => {
              const origin = getBrandOrigin(brand);
              const subcategory = getBrandSubcategory(brand);
              return (
                <motion.button
                  key={brand.name}
                  onClick={() => setSelectedBrand(brand)}
                  whileHover={{ y: -6 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:p-5 md:p-6"
                >
                  <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: 'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 60%)',
                    }}
                  />
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
                  <div className="relative mt-5 h-20">
                    <Image
                      src={getBrandLogo(brand.name)}
                      alt={brand.name}
                      fill
                      className={`object-contain transition-all duration-500 ${isDarkLogo(getBrandLogo(brand.name)) ? 'brightness-0 invert' : ''}`}
                      sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 20vw"
                      unoptimized
                    />
                  </div>
                  <div className="mt-5 text-2xl font-light text-white">{brand.name}</div>
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

      <div className="pb-10" />
    </div>
  );
}
