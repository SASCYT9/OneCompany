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
      'KW',
      'Nitron',
      'BC Racing',
      'MCA',
      'Hardrace',
      'SPL Parts',
      'Airlift Performance',
      'Ohlins',
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
      'HRE',
      'ADV.1',
      'Strasse',
      'MV Forged',
      'Velos',
      'Vorsteiner',
      'AL13',
      '1221',
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
      'Paragon',
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
      'BMC',
      'ARMA Speed',
      'Alpha-N',
      'MST Performance',
      'do88',
      'Karbonius',
    ],
  },
  {
    slug: 'exterior',
    segment: 'auto',
    title: { en: 'Exterior & Aero', ua: 'Екстер’єр та аеро' },
    description: {
      en: 'Widebody kits, carbon splitters, diffusers and spoilers engineered for downforce and aggressive stance.',
      ua: 'Widebody-обвіси, карбонові сплітери, дифузори та спойлери для притискної сили та агресивного вигляду.',
    },
    spotlight: {
      en: 'From subtle OEM+ carbon accents to full widebody transformations.',
      ua: 'Від карбонових акцентів OEM+ до повних widebody трансформацій.',
    },
    brands: [
      'Mansory',
      'Manhart',
      'Lumma',
      'Larte Design',
      'Ronin Design',
      'Renegade Design',
      'Liberty Walk',
      'Keyvany',
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
      'Sparco',
      'Bride',
      'Corbeau',
      'OMP',
      'Takata',
      'Schroth',
      'Sabelt',
    ],
  },
  {
    slug: 'performance',
    segment: 'auto',
    title: { en: 'Performance', ua: 'Продуктивність' },
    description: {
      en: 'Turbo solutions, fuel systems and ECU tuning engineered for reliable power stages up to full drag programs.',
      ua: 'Турбіни, паливні системи та налаштування ECU, розроблені для надійних ступенів потужності аж до драг-проєктів.',
    },
    spotlight: {
      en: 'From billet turbos to complete fuel system upgrades.',
      ua: 'Від білетних турбін до повних апгрейдів паливної системи.',
    },
    brands: [
      'AMS Alpha',
      'Weistec',
      'Pure Turbos',
      'Vargas Turbo',
      'VF Engineering',
      'Renntech',
      'Burger Motorsport',
      'Mountune',
    ],
  },
  {
    slug: 'cooling',
    segment: 'auto',
    title: { en: 'Cooling', ua: 'Охолодження' },
    description: {
      en: 'High-performance intercoolers, radiators and oil coolers to manage heat soak on track and street.',
      ua: 'Високопродуктивні інтеркулери, радіатори та маслокулери для контролю температур на треку та вулиці.',
    },
    spotlight: {
      en: 'Essential for maintaining power during repeated hard driving.',
      ua: 'Необхідно для збереження потужності при тривалих навантаженнях.',
    },
    brands: [
      'CSF',
      'Wagner Tuning',
      'PWR',
      'Mishimoto',
      'do88',
      'Airtec',
      'Forge Motorsport',
      'Koyorad',
    ],
  },
  {
    slug: 'moto-exhaust',
    segment: 'moto',
    title: { en: 'Exhaust & Sound', ua: 'Вихлоп та звук' },
    description: {
      en: 'Full titanium systems, slip-ons and race-only exhausts with FIM homologation and dyno-verified power gains.',
      ua: 'Повні титанові системи, slip-on та трекові вихлопи з FIM гомологацією та підтвердженим приростом потужності.',
    },
    spotlight: {
      en: 'Designed for WorldSBK, MotoGP and track day domination.',
      ua: 'Розроблені для WorldSBK, MotoGP та трекових днів.',
    },
    brands: [
      'Akrapovic',
      'SC-Project',
      'Termignoni',
      'Arrow',
      'Austin Racing',
      'Yoshimura',
      'Leo Vince',
      'MIVV',
    ],
  },
  {
    slug: 'moto-suspension',
    segment: 'moto',
    title: { en: 'Suspension & Chassis', ua: 'Підвіска та шасі' },
    description: {
      en: 'Cartridge kits, fully adjustable forks and rear shocks with dyno-driven shim stacks and linkage geometry.',
      ua: 'Картриджі, повністю регульовані вилки та задні амортизатори з діно-підбором шайб та геометрії лінків.',
    },
    spotlight: {
      en: 'From street comfort to race-spec compression and rebound control.',
      ua: 'Від комфорту на дорозі до трекового контролю стиснення та відбою.',
    },
    brands: [
      'Bitubo',
      'Ohlins',
      'Nitron',
      'HyperPro',
      'K-Tech',
      'WP',
      'Andreani',
      'Showa Racing',
    ],
  },
  {
    slug: 'moto-wheels',
    segment: 'moto',
    title: { en: 'Wheels & Brakes', ua: 'Диски та гальма' },
    description: {
      en: 'Carbon and forged aluminum wheels paired with radial master cylinders, racing pads and floating rotors.',
      ua: 'Карбонові та ковані алюмінієві диски з радіальними циліндрами, спортивними колодками та плаваючими дисками.',
    },
    spotlight: {
      en: 'Unsprung weight reduction and repeatable braking for litre bikes.',
      ua: 'Зменшення непідресореної маси та стабільне гальмування для літрових байків.',
    },
    brands: [
      'Rotobox',
      'BST Carbon Fiber',
      'Marchesini',
      'Brembo',
      'Accossato',
      'CNC Racing',
      'Galfer',
      'EBC Brakes',
    ],
  },
  {
    slug: 'moto-carbon',
    segment: 'moto',
    title: { en: 'Carbon & Aero', ua: 'Карбон та аеро' },
    description: {
      en: 'Pre-preg carbon fairings, tank covers, fenders and crash protection engineered for weight savings and track legality.',
      ua: 'Препрег-карбон обтічники, баки, крила та краш-захист для зниження ваги та трекової легальності.',
    },
    spotlight: {
      en: 'FIM-approved kits with paint-to-sample finishing options.',
      ua: 'FIM-сертифіковані комплекти з індивідуальним фарбуванням.',
    },
    brands: [
      'Ilmberger Carbon',
      'Fullsix Carbon',
      'Carbon2race',
      'CRC Fairings',
      'Airtech',
      'Armour Bodies',
      'Akrapovic',
      'Rizoma',
    ],
  },
  {
    slug: 'moto-controls',
    segment: 'moto',
    title: { en: 'Controls & Ergonomics', ua: 'Керування та ергономіка' },
    description: {
      en: 'Adjustable rearsets, clip-ons and billet levers for precise rider interface and lap time gains.',
      ua: 'Регульовані підніжки, кліпони та білетні важелі для точного керування та кращих часів кіл.',
    },
    spotlight: {
      en: 'CNC-machined with multiple position options for track ergonomics.',
      ua: 'CNC-оброблені з кількома позиціями для трекової ергономіки.',
    },
    brands: [
      'CNC Racing',
      'ValterMoto',
      'Melotti Racing',
      'Gilles Tooling',
      'Rizoma',
      'Lightech',
      'Sato Racing',
      'Woodcraft',
    ],
  },
  {
    slug: 'moto-electronics',
    segment: 'moto',
    title: { en: 'Electronics & Data', ua: 'Електроніка та дані' },
    description: {
      en: 'ECU flashing, quickshifter modules, traction control and GPS telemetry systems for data-driven setup optimization.',
      ua: 'Прошивка ECU, модулі квікшифтера, трекшн-контроль та GPS-телеметрія для оптимізації налаштувань на основі даних.',
    },
    spotlight: {
      en: 'From street power unlocks to full race data acquisition.',
      ua: 'Від розблокування потужності на дорозі до повної трекової телеметрії.',
    },
    brands: [
      'Starlane',
      'AIM Sports',
      'Jetprime',
      'Woolich Racing',
      'RapidBike',
      'Cordona',
    ],
  },
];
