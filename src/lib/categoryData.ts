// src/lib/categoryData.ts

import type { CategorySlug, Localized } from './categoryMeta';

export interface CategoryData {
  slug: CategorySlug;
  segment: 'auto' | 'moto';
  title: Localized;
  description: Localized;
  spotlight: Localized;
  brands: string[];
}

export const categoryData: CategoryData[] = [
  {
    slug: 'exhaust',
    segment: 'auto',
    title: { en: 'Exhaust Systems', ua: 'Системи випуску' },
    description: {
      en: 'TIG-welded manifolds, valvetronic cat-backs and lightweight titanium sections tuned on dynos to release power and a signature soundtrack.',
      ua: 'Колектори TIG, клапанні катбеки та титанові тракти, налаштовані на стендах для приросту потужності та фірмового тембру.',
    },
    spotlight: {
      en: 'Perfect for turbo efficiency, heat management and emotional tone.',
      ua: 'Для кращої ефективності турбіни, відведення тепла та емоційного тембру.',
    },
    brands: [
      'Akrapovic',
      'Armytrix',
      'Capristo',
      'FI Exhaust',
      'Ryft',
      'Tubi Style',
      'Fabspeed',
      'Supersprint',
      'Borla',
      'Remus',
      'SC-Project',
      'Termignoni',
    ],
  },
  {
    slug: 'suspension',
    segment: 'auto',
    title: { en: 'Suspension', ua: 'Підвіска' },
    description: {
      en: 'Adaptive coilovers, motorsport dampers and full-arm kits for geometry control on street and track builds.',
      ua: 'Адаптивні койловери, мотоспорт демпфери та комплекти важелів для контролю геометрії на дорозі й треку.',
    },
    spotlight: {
      en: 'Dial in ride height, rebound and compression with OEM-safe hardware.',
      ua: 'Регулюйте кліренс, відбій і стиснення на OEM-безпечній фурнітурі.',
    },
    brands: [
      'KW Suspension',
      'Nitron Suspension',
      'BC Racing',
      'MCA Suspension',
      'Hardrace',
      'SPL Parts',
      'Airlift Performance',
    ],
  },
  {
    slug: 'wheels',
    segment: 'auto',
    title: { en: 'Wheels & Tires', ua: 'Диски та шини' },
    description: {
      en: 'Fully forged monoblock, 2-piece and 3-piece sets engineered for unsprung weight reduction and custom fitments.',
      ua: 'Ковані моноблоки, дво- та трьохсекційні диски для зменшення непідресореної маси та індивідуальних параметрів.',
    },
    spotlight: {
      en: 'Tailored offsets, finishes and load ratings for supercars and SUVs.',
      ua: 'Індивідуальні вильоти, фініші та навантаження для суперкарів та SUV.',
    },
    brands: [
      'HRE wheels',
      'ADV.1 wheels',
      'Strasse wheels',
      'MV Forged',
      'Velos Wheels',
      'Vorsteiner',
      'AL13 wheels',
      '1221 wheels',
      'Brixton wheels',
      'Raliw Forged',
      'ProTrack Wheels',
      'Project 6GR',
    ],
  },
  {
    slug: 'brakes',
    segment: 'auto',
    title: { en: 'Brake Systems', ua: 'Гальмівні системи' },
    description: {
      en: 'Monoblock calipers, floating rotors and racing pads that deliver repeatable deceleration and pedal precision.',
      ua: 'Моноблочні супорти, плаваючі диски та спортивні колодки для стабільного гальмування та точності педалі.',
    },
    spotlight: {
      en: 'Option BBK conversions or track-only ceramic kits with telemetry support.',
      ua: 'Вибір BBK-комплектів або трекових керамічних систем із телеметрією.',
    },
    brands: [
      'Brembo',
      'Stoptech',
      'Girodisc',
      'Paragon brakes',
      'Sachs Performance',
      'STOPART ceramic',
      'RS-R',
      'Wagner Tuning',
    ],
  },
  {
    slug: 'intake',
    segment: 'auto',
    title: { en: 'Air Intake', ua: 'Впускна система' },
    description: {
      en: 'Carbon velocity stacks, sealed intakes and charge pipes that stabilise IAT and airflow on tuned platforms.',
      ua: 'Карбонові тракти, герметичні впуски та пайпінг для стабільних температур і потоку на тюнінгованих авто.',
    },
    spotlight: {
      en: 'Ideal for turbo upgrades and track cars chasing consistency.',
      ua: 'Ідеально для апгрейду турбо та трекових авто для стабільності.',
    },
    brands: [
      'Eventuri',
      'Gruppe-M',
      'BMC filters',
      'ARMA Speed',
      'Alpha-N',
      'MST Performance',
      'do88',
      'Karbonius',
      'CT Carbon',
      'Power Division',
      'Mamba turbo',
      'IPe exhaust',
    ],
  },
  {
    slug: 'interior',
    segment: 'auto',
    title: { en: 'Interior', ua: 'Інтер’єр' },
    description: {
      en: 'Bucket seats, steering wheels and cabin trims crafted from Alcantara, forged carbon and titanium hardware.',
      ua: 'Спортивні крісла, керма та елементи інтер’єру з алькантари, кованого карбону та титанової фурнітури.',
    },
    spotlight: {
      en: 'Ergonomics for track focus without sacrificing luxury touchpoints.',
      ua: 'Ергономіка треку без втрати преміальних матеріалів.',
    },
    brands: [
      'Recaro',
      'Mansory',
      'Manhart',
      'Lumma',
      'Larte Design',
      'Ronin Design',
      'Renegade Design',
      'Liberty Walk',
      'Keyvany',
      'TopCar Design',
      'Urban Automotive',
      'Hamann',
    ],
  },
  {
    slug: 'performance',
    segment: 'auto',
    title: { en: 'Performance', ua: 'Продуктивність' },
    description: {
      en: 'Intercoolers, fuel systems and turbo solutions engineered for reliable power stages up to full drag programs.',
      ua: 'Інтеркулери, паливні системи та турбіни, розроблені для надійних ступенів потужності аж до драг-проєктів.',
    },
    spotlight: {
      en: 'From heat exchangers to billet turbos with calibration support.',
      ua: 'Від теплообмінників до білетних турбін із калібруванням.',
    },
    brands: [
      'CSF',
      'AMS / Alpha Performance',
      'Weistec Engineering',
      'Pure Turbos',
      'Vargas Turbo',
      'VF Engineering',
      'Renntech',
      'Burger Motorsport',
      'Mountune',
      'Injector Dynamics',
      'XDI fuel systems',
      'Spool Performance',
    ],
  },
];
