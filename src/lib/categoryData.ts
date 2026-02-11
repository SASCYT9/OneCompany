import type { Metadata } from 'next';
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
  // -----------------------
  // AUTO CATEGORIES
  // -----------------------
  {
    slug: 'wheels',
    segment: 'auto',
    title: { en: 'Wheels', ua: 'Диски' },
    description: {
      en: 'Premium forged monoblock, 2-piece and 3-piece wheels for performance and style.',
      ua: 'Преміальні ковані моноблоки, дво- та трьохсекційні диски для продуктивності та стилю.',
    },
    spotlight: {
      en: 'Custom fitments and lightweight engineering.',
      ua: 'Індивідуальні параметри та легка конструкція.',
    },
    brands: [
      // TOP 8 first
      'HRE wheels',
      '1221 wheels',
      'ADV.1 wheels',
      'AL13 wheels',
      'ANRKY wheels',
      'Velos Wheels',
      'Brixton wheels',
      'MV Forged',
      // Rest alphabetically
      'Mickey Thompson',
      'ONE COMPANY forged',
      'Project 6GR',
      'ProTrack Wheels',
      'Raliw Forged',
      'Strasse wheels',
      'TireRack',
      'Avantgarde Wheels',
      'Vorsteiner',
      'WheelForce',
    ],
  },
  {
    slug: 'exterior',
    segment: 'auto',
    title: { en: 'Body Kit, Carbon & Aero', ua: 'Обвіс, Карбон та Аеро' },
    description: {
      en: 'Complete widebody kits, carbon fiber aerodynamics, and exterior styling upgrades.',
      ua: 'Повні комплекти розширення, карбонова аеродинаміка та стайлінг екстер\'єру.',
    },
    spotlight: {
      en: 'Aggressive stance and functional downforce.',
      ua: 'Агресивний вигляд та функціональна притискна сила.',
    },
    brands: [
      // TOP 8 first
      'Brabus',
      'Mansory',
      'Novitec',
      'ABT',
      'Urban Automotive',
      '1016 Industries',
      'Vorsteiner',
      'DarwinPro',
      // Rest alphabetically
      'AC Schnitzer',
      '3D Design',
      'ADRO',
      'Alpha-N',
      'APR',
      'CT Carbon',
      'DMC',
      'Duke Dynamics',
      'Eterna Motorworks',
      'Hamann',
      'KAHN design',
      'Karbonius',
      'Keyvany',
      'Larte Design',
      'Liberty Walk',
      'Lorinser',
      'Lumma',
      'Manhart',
      "Matt's carbon",
      'Paktechz Design',
      'Onyx Concept',
      'RKP',
      'RW Carbon',
      'Seibon Carbon',
      'Sterckenn',
      'Stillen',
      'TECHART',
      'Verus Engineering',
      'WALD',
      'Zacoe',
    ],
  },
  {
    slug: 'exhaust',
    segment: 'auto',
    title: { en: 'Exhaust Systems', ua: 'Вихлопні системи' },
    description: {
      en: 'High-performance headers, downpipes, and valvetronic exhaust systems.',
      ua: 'Високопродуктивні колектори, даунпайпи та вальветронік системи вихлопу.',
    },
    spotlight: {
      en: 'Unlock power and signature sound.',
      ua: 'Розкрийте потужність та фірмовий звук.',
    },
    brands: [
      // TOP 8 first
      'Akrapovic',
      'Brabus',
      'FI Exhaust',
      'Novitec',
      'iPE exhaust',
      'Armytrix',
      'Kline Innovation',
      'Capristo',
      // Rest alphabetically
      'Mansory',
      'American Racing Headers',
      'Borla',
      'Cobra Sport',
      'Fabspeed',
      'GTHaus',
      'Kooks Headers',
      'Milltek',
      'Remus',
      'RYFT',
      'Supersprint',
      'Tubi Style',
    ],
  },
  {
    slug: 'intake',
    segment: 'auto',
    title: { en: 'Air Intake Systems', ua: 'Впускні системи' },
    description: {
      en: 'Carbon fiber intakes, cold air systems, and performance filters for maximum airflow.',
      ua: 'Карбонові впуски, системи холодного повітря та спортивні фільтри для максимального потоку.',
    },
    spotlight: {
      en: 'Improved throttle response and power.',
      ua: 'Покращена реакція на газ та потужність.',
    },
    brands: [
      // TOP 8 first
      'Eventuri',
      'ARMA Speed',
      'Gruppe-M',
      'MST Performance',
      'BMC filters',
      'APR',
      'Dinan',
      'Integrated Engineering',
      // Rest alphabetically
      '034 Motorsport',
      'aFe Power',
      'K&N',
      'Mountune',
      'Renntech',
      'Verus Engineering',
      'Weistec Engineering',
    ],
  },
  {
    slug: 'performance',
    segment: 'auto',
    title: { en: 'Engine, Turbo & Fuel', ua: 'Двигун, Турбо та Паливо' },
    description: {
      en: 'Turbo upgrades, fuel system components, superchargers, and engine internals.',
      ua: 'Модернізація турбін, компоненти паливної системи, компресори та внутрішні частини двигуна.',
    },
    spotlight: {
      en: 'Reliable power for street and track.',
      ua: 'Надійна потужність для вулиці та треку.',
    },
    brands: [
      // TOP 8 first
      'Eventuri',
      'AMS / Alpha Performance',
      'Pure Turbos',
      'Whipple Superchargers',
      'ARMA Speed',
      'Weistec Engineering',
      'VF Engineering',
      'ESS Tuning',
      // Rest alphabetically
      '034 Motorsport',
      '5150 Autosport',
      'ARE dry sump',
      'BE bearings',
      'BBi Autosport',
      'Big Boost',
      'Black Boost',
      'BMC filters',
      'Deatschwerks',
      'Dinan',
      'Dorch Engineering',
      'Fabspeed',
      'Fall-Line Motorsports',
      'Fore Innovations',
      'Fragola Performance Systems',
      'Full-Race',
      'Gruppe-M',
      'Harrop',
      'Injector Dynamics',
      'Integrated Engineering',
      'ItalianRP',
      'Karbonius',
      'Killer B Motorsport',
      'KLM Race',
      'Lamspeed',
      'Lingenfelter',
      'LOBA Motorsport',
      'Mamba turbo',
      'Motiv Motorsport',
      'MST Performance',
      'Power Division',
      'Pulsar turbo',
      'RK Autowerks',
      'Schrick',
      'Silly Rabbit Motorsport',
      'Spool Performance',
      'Titan Motorsport',
      'TTH turbos',
      'Vargas Turbo',
      'VP Racing Fuel',
      'XDI fuel systems',
    ],
  },
  {
    slug: 'suspension',
    segment: 'auto',
    title: { en: 'Suspension & Brakes', ua: 'Підвіска та Гальма' },
    description: {
      en: 'Coilovers, air suspension, big brake kits, and chassis reinforcement.',
      ua: 'Койловери, пневмопідвіска, гальмівні кіти та підсилення шасі.',
    },
    spotlight: {
      en: 'Handling, stance, and stopping power.',
      ua: 'Керованість, стенс та гальмівна потужність.',
    },
    brands: [
      // TOP 8 first
      'KW Suspension',
      'Brembo',
      'Airlift Performance',
      'BC Racing',
      'STOPFLEX',
      'Girodisc',
      'Alcon',
      'Nitron Suspension',
      // Rest alphabetically
      'Hardrace',
      'Paragon brakes',
      'RS-R',
      'SPL Parts',
      'STOPART ceramic',
      'Stoptech',
      'MTS Technik',
      'MCA Suspension',
    ],
  },
  {
    slug: 'drivetrain',
    segment: 'auto',
    title: { en: 'Drivetrain', ua: 'Трансмісія' },
    description: {
      en: 'Performance gearboxes, clutches, driveshafts, and differentials.',
      ua: 'Спортивні коробки передач, зчеплення, карданні вали та диференціали.',
    },
    spotlight: {
      en: 'Put the power to the ground.',
      ua: 'Реалізуйте потужність на дорозі.',
    },
    brands: [
      // TOP 8 first
      'Samsonas Motorsport',
      'Drenth Gearboxes',
      'Driveshaftshop',
      'JXB Performance',
      'Kotouc',
      'Modena Engineering',
      'Xshift',
      'Wavetrac',
      // Rest
      'Pure Drivetrain Solutions',
      'RPM Transmissions',
      'ShepTrans',
      'Southern Hotrod',
      'Circle D',
      'Sachs Performance',
      'Moser Engineering',
      'Paramount transmissions',
    ],
  },
  {
    slug: 'electronics',
    segment: 'auto',
    title: { en: 'Chip Tuning & Power', ua: 'Чіп тюнінг та Підвищення потужності' },
    description: {
      en: 'ECU tuning, chip tuning, and comprehensive performance tuning specialists.',
      ua: 'ECU тюнінг, чіп-тюнінг та комплексні спеціалісти з продуктивності.',
    },
    spotlight: {
      en: 'Software and hardware integration.',
      ua: 'Інтеграція програмного та апаратного забезпечення.',
    },
    brands: [
      // TOP 8 first
      'Brabus',
      'ABT',
      'DTE Systems',
      'Renntech',
      'Weistec Engineering',
      'Cobb tuning',
      'Burger Motorsport',
      'BootMod3',
      // Rest alphabetically
      'AC Schnitzer',
      'Manhart',
      'Dinan',
      // Rest alphabetically
      'AIM Sportline',
      'AMS / Alpha Performance',
      'BBi Autosport',
      'BimmerWorld',
      'Black Boost',
      'BootMod3',
      'Burger Motorsport',
      'Dahler',
      'DTE Systems',
      'ESS Tuning',
      'Fabspeed',
      'Fall-Line Motorsports',
      'Hamann',
      'Heico',
      'KAHN design',
      'Keyvany',
      'Lamspeed',
      'Lingenfelter',
      'Link ECU',
      'Lorinser',
      'Lumma',
      'Mansory',
      'Mountune',
      'Novitec',
      'Onyx Concept',
      'Premier Tuning Group',
      'R44 Performance',
      'RaceChip',
      'RYFT',
      'Silly Rabbit Motorsport',
      'Stillen',
      'Titan Motorsport',
      'Turner Motorsport',
      'Vargas Turbo',
      'YPG',
    ],
  },
  {
    slug: 'cooling',
    segment: 'auto',
    title: { en: 'Cooling & Tires', ua: 'Охолодження та Шини' },
    description: {
      en: 'Intercoolers, radiators, hoses, and high-performance tires.',
      ua: 'Інтеркулери, радіатори, патрубки та високопродуктивні шини.',
    },
    spotlight: {
      en: 'Temperature control and grip.',
      ua: 'Контроль температури та зчеплення.',
    },
    brands: [
      // TOP 8 first
      'Wagner Tuning',
      'CSF',
      'do88',
      'Bell Intercoolers',
      'Verus Engineering',
      'Mickey Thompson',
      'Extreme tyres',
      'TireRack',
      // Rest alphabetically
      'Lithiumax batteries',
    ],
  },
  {
    slug: 'oem',
    segment: 'auto',
    title: { en: 'OEM Parts', ua: 'OEM Частини' },
    description: {
      en: 'Genuine original equipment manufacturer parts for luxury vehicles.',
      ua: 'Оригінальні запчастини для автомобілів люкс-класу.',
    },
    spotlight: {
      en: 'Authentic quality and fitment.',
      ua: 'Автентична якість та сумісність.',
    },
    brands: [
      'Ferrari',
      'Lamborghini',
      'McLaren',
      'Aston Martin',
      'Maserati',
      'Rolls Royce',
    ],
  },
  {
    slug: 'racing',
    segment: 'auto',
    title: { en: 'Racing & Motorsport', ua: 'Гонки та Автоспорт' },
    description: {
      en: 'Professional racing equipment: sequential gearboxes, data acquisition, dry sump systems, and race-spec components.',
      ua: 'Професійне гоночне обладнання: секвентальні КПП, системи телеметрії, сухі картери та гоночні компоненти.',
    },
    spotlight: {
      en: 'Track-proven performance for serious competitors.',
      ua: 'Перевірена на треку продуктивність для серйозних учасників.',
    },
    brands: [
      // TOP 8 first
      'AIM Sportline',
      'Link ECU',
      'Drenth Gearboxes',
      'Samsonas Motorsport',
      'MCA Suspension',
      'ARE dry sump',
      'Modena Engineering',
      'Kotouc',
      // Rest
      'Bell Intercoolers',
      'Extreme tyres',
      'Lithiumax batteries',
      'Xshift',
    ],
  },

  // -----------------------
  // MOTO CATEGORIES
  // -----------------------
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
      // TOP 8 first
      'Akrapovic',
      'SC-Project',
      'Termignoni',
      'Arrow',
      'Austin Racing',
      'SparkExhaust',
      'Vandemon',
      'ZARD Exhaust',
      // Rest alphabetically
      'Cobra Sport',
      'Dominator Exhaust',
      'IXIL',
      'TOCE Exhaust',
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
      // TOP 8 first
      'Ohlins',
      'Bitubo',
      'GPR Stabilizer',
      'HyperPro',
      'Febur',
      'Samco Sport',
      'Capit',
      'Thermal Technology',
      // Rest alphabetically
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
      // TOP 8 first
      'Brembo',
      'Marchesini',
      'OZ Racing',
      'Rotobox',
      'Accossato',
      'Ceracarbon',
      'X-GRIP',
      'Stompgrip',
      // Rest alphabetically
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
      // TOP 8 first
      'Ilmberger Carbon',
      'Fullsix Carbon',
      'AXP',
      'Bikesplast',
      'DB-Race',
      'Evotech',
      'GBracing',
      'New Rage Cycles',
      // Rest alphabetically
      'P3 Carbon',
      'R&G Racing',
      'S2 Concept',
      'Sebimoto',
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
      // TOP 8 first
      'Brembo',
      'Rizoma',
      'Bonamici',
      'Gilles Tooling',
      'CNC Racing',
      'Accossato',
      'AEM Factory',
      'ARP Racingparts',
      // Rest alphabetically
      'Domino',
      'Evotech',
      'Melotti Racing',
      'Racefoxx',
      'TWM',
      'ValterMoto',
    ],
  },
  {
    slug: 'moto-electronics',
    segment: 'moto',
    title: { en: 'Electronics & Chip Tuning', ua: 'Електроніка, прилади та чіп-тюнінг' },
    description: {
      en: 'ECU flashing, quickshifter modules, traction control and GPS telemetry systems for data-driven setup optimization.',
      ua: 'Прошивка ECU, модулі квікшифтера, трекшн-контроль та GPS-телеметрія для оптимізації налаштувань на основі даних.',
    },
    spotlight: {
      en: 'From street power unlocks to full race data acquisition.',
      ua: 'Від розблокування потужності на дорозі до повної трекової телеметрії.',
    },
    brands: [
      // TOP 8 first
      'AIM Tech',
      'Alpha Racing',
      'BT Moto',
      'Cordona',
      'ECUStudio',
      'EVR',
      'FlashTune',
      'Healtech',
      // Rest alphabetically
      'HM Quickshifter',
      'Jetprime',
      'Sprint Filter',
      'Starlane',
      'STM Italy',
      'Translogic',
      'TSS',
    ],
  },
];

export function getCategoryMetadata(slug: string, locale: string): Metadata {
  const category = categoryData.find(c => c.slug === slug);
  if (!category) return {};

  const lang = locale === 'ua' ? 'ua' : 'en';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const url = `${baseUrl}/${locale}/${category.segment}/categories/${slug}`;
  
  return {
    title: category.title[lang],
    description: category.description[lang],
    alternates: {
      canonical: url,
      languages: {
        'en': `${baseUrl}/en/${category.segment}/categories/${slug}`,
        'uk-UA': `${baseUrl}/ua/${category.segment}/categories/${slug}`,
      }
    },
    openGraph: {
      title: category.title[lang],
      description: category.description[lang],
      url: url,
    }
  };
}
