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
    value: '21B',
    label: { en: 'Baseina St · Kyiv', ua: 'вул. Басейна, 21Б' },
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

      {/* Product Categories Section - Moved Up */}
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
              href={`/${locale}/categories/${cat.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30 p-5 transition-all duration-500 backdrop-blur-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-zinc-900/50 hover:border-white/20 hover:scale-[1.02] hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] sm:rounded-3xl sm:p-6 md:p-8 h-full"
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{
                backgroundImage:
                  'radial-gradient(circle at top left, rgba(255,255,255,0.1), transparent 55%)',
              }} />
              <div className="relative flex flex-col gap-3 sm:gap-4 flex-1">
                <div className="text-[9px] uppercase tracking-[0.3em] text-white/40 sm:text-[10px] sm:tracking-[0.4em]">
                  {locale === 'ua' ? 'Категорія' : 'Category'}
                </div>
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
                  <span>{tPage('open')}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent" />
                  <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Brands Section - Moved Up */}
      <section className="relative border-y border-white/5 bg-gradient-to-b from-black via-black/80 to-black py-12 sm:py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center sm:mb-12 md:mb-16">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/50 sm:text-[10px] sm:tracking-[0.5em] md:text-[11px] md:tracking-[0.6em]">{t('featuredBrands')}</p>
            <h2 className={`mt-2 font-light text-white text-balance sm:mt-3 ${typography.sectionHeading}`}>
              {locale === 'ua' ? 'Ікони продуктивності' : 'Icons of Performance'}
            </h2>
          </div>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 md:gap-6">
            {topBrands.map((brand) => (
              <motion.button
                key={brand.name}
                onClick={() => setSelectedBrand(brand)}
                whileHover={{ y: -5, scale: 1.02 }}
                className="group relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent p-6 text-center transition-all duration-500 backdrop-blur-md hover:border-white/30 hover:shadow-[0_0_50px_rgba(255,255,255,0.15)] md:p-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="relative h-20 w-full">
                  <Image
                    src={getBrandLogo(brand.name)}
                    alt={brand.name}
                    fill
                    className={`object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-all duration-500 group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] ${isDarkLogo(getBrandLogo(brand.name)) ? 'invert brightness-0 invert-[1]' : ''}`}
                    sizes="(max-width: 768px) 100vw, 300px"
                    unoptimized
                  />
                </div>

                <div className="relative flex flex-1 flex-col items-center justify-end gap-4">
                  <p className="text-xs font-light tracking-widest text-white/60">
                    {locale === 'ua' ? 'Офіційна програма постачання' : 'Official supply program'}
                  </p>
                  
                  <div className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-300 group-hover:border-white/60 group-hover:bg-white/10 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                    {locale === 'ua' ? 'Дивитись деталі' : 'View Details'}
                  </div>
                </div>
              </motion.button>
            ))}
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
                    className={`object-contain ${isDarkLogo(getBrandLogo(selectedBrand.name)) ? 'invert brightness-0 invert-[1]' : ''}`}
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
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-24">
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
                      className={`object-contain ${isDarkLogo(getBrandLogo(brand.name)) ? 'invert brightness-0 invert-[1]' : ''}`}
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
