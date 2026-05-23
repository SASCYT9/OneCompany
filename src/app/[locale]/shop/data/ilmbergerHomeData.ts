/* ──────────────────────────────────────────────────
   Ilmberger Carbon Home Data  (EN / UA)
   ────────────────────────────────────────────────── */

export const ILMBERGER_HERO = {
  // TikTok-sourced Ilmberger Carbon footage — used as a blurred ambient
  // background behind the hero copy. Falls back to header banner if video
  // fails to load.
  heroVideoUrl: '/videos/shop/ilmberger/hero.mp4',
  heroImageFallback: '/images/shop/ilmberger/hero-banner.avif',
  heroImageWidth: 1920,
  heroImageHeight: 720,
  subtitle:
    'Autoclaved pre-preg carbon parts for sportbikes. Hand-laid in Lindberg, Germany since 1995.',
  subtitleUk:
    'Препрег-карбон в автоклаві для спортбайків. Ручна укладка в Ліндберзі, Німеччина з 1995.',
};

/* ─── Photo gallery (masonry-style grid on the home page) ─────────
   Mix of real Ilmberger press shots, downloaded from
   ilmberger-carbon.com. Images are reused with different crops
   (`objectPosition`) so the same bike feels like a different shot
   in each tile. Grid spans are tuned for visual rhythm. */
export type IlmbergerGalleryItem = {
  id: string;
  image: string;
  caption: string;
  captionUk: string;
  /** CSS object-position (e.g. "30% 50%") for variety */
  objectPosition?: string;
  /** Tailwind-like grid spans for the home masonry grid */
  colSpan: 3 | 4 | 5 | 6 | 7 | 8;
  rowSpan: 1 | 2;
};

export const ILMBERGER_GALLERY: IlmbergerGalleryItem[] = [
  {
    id: 'g-01-fairing-hero',
    image: '/images/shop/ilmberger/products/gallery-01-fairing.jpg',
    caption: 'M 1000 RR — Front Fairing',
    captionUk: 'M 1000 RR — передній обтічник',
    colSpan: 6,
    rowSpan: 2,
  },
  {
    id: 'g-02-tank-cover',
    image: '/images/shop/ilmberger/products/tank-cover.jpg',
    caption: 'Tank Cover — TAO.202',
    captionUk: 'Накладка на бак — TAO.202',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-03-front-fender',
    image: '/images/shop/ilmberger/products/front-fender.jpg',
    caption: 'Front Fender — mounted',
    captionUk: 'Переднє крило — встановлено',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-04-belly-pan',
    image: '/images/shop/ilmberger/products/belly-pan.jpg',
    caption: 'Belly Pan — racing',
    captionUk: 'Нижній піддон — гоночний',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-05-rear-hugger',
    image: '/images/shop/ilmberger/products/rear-hugger.jpg',
    caption: 'Rear Hugger — KHO.212',
    captionUk: 'Задній бризковик — KHO.212',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-06-swingarm',
    image: '/images/shop/ilmberger/products/swingarm.jpg',
    caption: 'Swingarm Cover — SCL.023',
    captionUk: 'Захист маятника — SCL.023',
    colSpan: 4,
    rowSpan: 1,
  },
  {
    id: 'g-07-clutch-cover',
    image: '/images/shop/ilmberger/products/cockpit-clutch.jpg',
    caption: 'Clutch Cover — KDA.002',
    captionUk: 'Кришка зчеплення — KDA.002',
    colSpan: 4,
    rowSpan: 1,
  },
  {
    id: 'g-08-sprocket',
    image: '/images/shop/ilmberger/products/gallery-09-sprocket.jpg',
    caption: 'Front Sprocket Cover',
    captionUk: 'Кришка передньої зірки — RIO.025',
    colSpan: 4,
    rowSpan: 1,
  },
  {
    id: 'g-09-alternator-bike',
    image: '/images/shop/ilmberger/products/gallery-12-alternator-bike.jpg',
    caption: 'Alternator Cover — on bike',
    captionUk: 'Кришка генератора — на мотоциклі',
    colSpan: 6,
    rowSpan: 1,
  },
  {
    id: 'g-10-fairing-detail',
    image: '/images/shop/ilmberger/products/gallery-02-fairing-detail.jpg',
    caption: 'Fairing — twill weave macro',
    captionUk: 'Обтічник — макро twill-плетіння',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-11-winglet-pair',
    image: '/images/shop/ilmberger/products/gallery-08-winglet-pair.jpg',
    caption: 'Winglets — VFL.001',
    captionUk: 'Вінглети — VFL.001',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-12-winglet-mounted',
    image: '/images/shop/ilmberger/products/gallery-06-winglet-mounted.jpg',
    caption: 'Winglets — installed on M 1000 RR',
    captionUk: 'Вінглети — встановлені на M 1000 RR',
    colSpan: 6,
    rowSpan: 1,
  },
  {
    id: 'g-13-fairing-side',
    image: '/images/shop/ilmberger/products/gallery-03-fairing-side.jpg',
    caption: 'Side Panel — race',
    captionUk: 'Бокова панель — гоночна',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-14-fairing-front',
    image: '/images/shop/ilmberger/products/gallery-04-fairing-front.jpg',
    caption: 'Front Fairing — VEO.001',
    captionUk: 'Передній обтічник — VEO.001',
    colSpan: 3,
    rowSpan: 1,
  },
  {
    id: 'g-15-sprocket-mounted',
    image: '/images/shop/ilmberger/products/gallery-10-sprocket-mounted.jpg',
    caption: 'Sprocket Cover — mounted',
    captionUk: 'Кришка зірки — на мотоциклі',
    colSpan: 4,
    rowSpan: 1,
  },
  {
    id: 'g-16-alternator-detail',
    image: '/images/shop/ilmberger/products/gallery-11-alternator.jpg',
    caption: 'Alternator Cover — LMD.001',
    captionUk: 'Кришка генератора — LMD.001',
    colSpan: 4,
    rowSpan: 1,
  },
  {
    id: 'g-17-winglet-piece',
    image: '/images/shop/ilmberger/products/gallery-07-winglet-piece.jpg',
    caption: 'Winglet — bare carbon',
    captionUk: 'Вінглет — чистий карбон',
    colSpan: 4,
    rowSpan: 1,
  },
];

/* ─── Mock product cards (until real catalog imports) ───────────
   Structured as a real product card grid: SKU, title, fitment,
   placeholder price band and "Coming soon" badge. When real
   ShopProduct rows arrive from the import, the grid swaps to
   live data and these mocks disappear. Carbon-fiber thumbnails
   reuse the existing carbon-closeup macro shot — Ilmberger's
   weave looks identical to other prepreg suppliers. */
export type IlmbergerMockProduct = {
  id: string;
  sku: string;
  title: string;
  titleUk: string;
  fitment: string;
  fitmentUk: string;
  category: string;
  categoryUk: string;
  priceFrom: string;
  image: string;
};

export const ILMBERGER_MOCK_PRODUCTS: IlmbergerMockProduct[] = [
  {
    id: 'm1000rr-full-fairing',
    sku: 'ILM-FAIR-M1KRR-22',
    title: 'Full Racing Fairing Kit',
    titleUk: 'Гоночний обтічник (комплект)',
    fitment: 'BMW M 1000 RR  2021–2024',
    fitmentUk: 'BMW M 1000 RR  2021–2024',
    category: 'Fairings & Bodywork',
    categoryUk: 'Обтічники',
    priceFrom: 'from €3,890',
    image: '/images/shop/ilmberger/products/gallery-01-fairing.jpg',
  },
  {
    id: 'panigale-v4-tank-cover',
    sku: 'ILM-TANK-PV4-22',
    title: 'Tank Cover with Knee Grip',
    titleUk: 'Накладка на бак з knee-grip',
    fitment: 'Ducati Panigale V4  2022–',
    fitmentUk: 'Ducati Panigale V4  2022–',
    category: 'Tank Covers',
    categoryUk: 'Накладки на бак',
    priceFrom: 'from €489',
    image: '/images/shop/ilmberger/products/tank-cover.jpg',
  },
  {
    id: 'rsv4-front-fender',
    sku: 'ILM-FEN-RSV4-21',
    title: 'Front Fender (Mudguard)',
    titleUk: 'Переднє крило',
    fitment: 'Aprilia RSV4 1100  2021–',
    fitmentUk: 'Aprilia RSV4 1100  2021–',
    category: 'Fenders',
    categoryUk: 'Крила',
    priceFrom: 'from €295',
    image: '/images/shop/ilmberger/products/front-fender.jpg',
  },
  {
    id: 's1000rr-frame-protector',
    sku: 'ILM-FRM-S1KRR-23',
    title: 'Frame Cover Set (LH + RH)',
    titleUk: 'Захист рами (лівий + правий)',
    fitment: 'BMW S 1000 RR  2019–2024',
    fitmentUk: 'BMW S 1000 RR  2019–2024',
    category: 'Frame Protection',
    categoryUk: 'Захист рами',
    priceFrom: 'from €420',
    image: '/images/shop/ilmberger/products/gallery-03-fairing-side.jpg',
  },
  {
    id: 'r1-rear-hugger',
    sku: 'ILM-HUG-R1-20',
    title: 'Rear Hugger (Wheel Cover)',
    titleUk: 'Хагер заднього колеса',
    fitment: 'Yamaha YZF-R1  2020–',
    fitmentUk: 'Yamaha YZF-R1  2020–',
    category: 'Wheel Covers',
    categoryUk: 'Захист колеса',
    priceFrom: 'from €265',
    image: '/images/shop/ilmberger/products/rear-hugger.jpg',
  },
  {
    id: 'cbr-instrument-cover',
    sku: 'ILM-DSH-CBR1K-21',
    title: 'Instrument Dash Cover',
    titleUk: 'Накладка на приладову панель',
    fitment: 'Honda CBR1000RR-R  2021–',
    fitmentUk: 'Honda CBR1000RR-R  2021–',
    category: 'Cockpit',
    categoryUk: 'Кокпіт',
    priceFrom: 'from €178',
    image: '/images/shop/ilmberger/products/cockpit-clutch.jpg',
  },
  {
    id: 'panigale-belly-pan',
    sku: 'ILM-BLY-PV4-22',
    title: 'Lower Belly Pan',
    titleUk: 'Нижній піддон',
    fitment: 'Ducati Panigale V4  2022–',
    fitmentUk: 'Ducati Panigale V4  2022–',
    category: 'Fairings & Bodywork',
    categoryUk: 'Обтічники',
    priceFrom: 'from €595',
    image: '/images/shop/ilmberger/products/belly-pan.jpg',
  },
  {
    id: 'zx10r-swingarm',
    sku: 'ILM-SWA-ZX10R-21',
    title: 'Swingarm Cover Set',
    titleUk: 'Накладки на маятник',
    fitment: 'Kawasaki ZX-10R  2021–',
    fitmentUk: 'Kawasaki ZX-10R  2021–',
    category: 'Frame Protection',
    categoryUk: 'Захист рами',
    priceFrom: 'from €340',
    image: '/images/shop/ilmberger/products/swingarm.jpg',
  },
];

/* ─── Product line types ─────────────────────────────────── */
export type IlmbergerProductLine = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  badge: string;
  badgeUk: string;
  /** Full-bleed background image for the category card */
  image: string;
  /** CSS object-position to crop the right area of each photo */
  objectPosition?: string;
  link: string;
};

export const ILMBERGER_PRODUCT_LINES: IlmbergerProductLine[] = [
  {
    // Real Ilmberger product photo — belly pan (fairing component)
    id: 'fairings',
    name: 'Fairings & Bodywork',
    nameUk: 'Обтічники та кузовні деталі',
    description:
      'Full racing fairings, side panels, belly pans and undertails in autoclaved prepreg carbon. FIM-approved.',
    descriptionUk:
      'Гоночні обтічники, бокові панелі, піддони та задні крила з автоклавного препрег-карбону. Сертифіковано FIM.',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    image: '/images/shop/ilmberger/products/belly-pan.jpg',
    objectPosition: 'center',
    link: '/shop/ilmberger/collections?category=fairings',
  },
  {
    // Real Ilmberger product photo — tank cover (TAO.202)
    id: 'tank-covers',
    name: 'Tank Covers & Pads',
    nameUk: 'Накладки на бак',
    description:
      'Tank covers with anti-slip pads, knee grip panels and full carbon tank protectors. Pristine twill finish.',
    descriptionUk:
      'Накладки на бак із протиковзкими вставками, бічні панелі для коліна та повний карбоновий захист бака. Бездоганне twill-плетіння.',
    badge: 'Daily',
    badgeUk: 'Щоденно',
    image: '/images/shop/ilmberger/products/tank-cover.jpg',
    objectPosition: 'center',
    link: '/shop/ilmberger/collections?category=tank-covers',
  },
  {
    // Real Ilmberger product photo — front fender (KVO)
    id: 'fenders',
    name: 'Front & Rear Fenders',
    nameUk: 'Передні та задні крила',
    description:
      'Featherweight front fenders and tail-tidy rear hugger units. Drop-in replacements for OEM plastic.',
    descriptionUk:
      'Легкі передні крила та задні хагери. Пряма заміна штатного OEM-пластику без модифікацій.',
    badge: 'Weight Save',
    badgeUk: 'Економія ваги',
    image: '/images/shop/ilmberger/products/front-fender.jpg',
    objectPosition: 'center',
    link: '/shop/ilmberger/collections?category=fenders',
  },
  {
    // Real Ilmberger product photo — swingarm cover (SCL.023)
    id: 'frame-protection',
    name: 'Frame & Swingarm Protection',
    nameUk: 'Захист рами та маятника',
    description:
      'Frame guards, swingarm covers, chain guards and sprocket covers. Track-day crash protection.',
    descriptionUk:
      'Захист рами, накладки на маятник, захист ланцюга та зірки. Краш-захист для трекових заїздів.',
    badge: 'Track',
    badgeUk: 'Трек',
    image: '/images/shop/ilmberger/products/swingarm.jpg',
    objectPosition: 'center',
    link: '/shop/ilmberger/collections?category=frame-protection',
  },
  {
    // Real Ilmberger product photo — rear hugger (KHO.212)
    id: 'wheel-covers',
    name: 'Wheel Covers & Hugger',
    nameUk: 'Захист колеса',
    description:
      'Front wheel covers, rear huggers and chain covers. Aerodynamic optimization with featherweight carbon.',
    descriptionUk:
      'Накладки на переднє колесо, задні хагери та захист ланцюга. Аеродинаміка з надлегкого карбону.',
    badge: 'Aero',
    badgeUk: 'Аеро',
    image: '/images/shop/ilmberger/products/rear-hugger.jpg',
    objectPosition: 'center',
    link: '/shop/ilmberger/collections?category=wheel-covers',
  },
  {
    // Real Ilmberger product photo — clutch cover (KDA.002) — cockpit-grade detail
    id: 'cockpit',
    name: 'Cockpit & Instrument Dash',
    nameUk: 'Кокпіт та приладова панель',
    description:
      'Instrument cluster covers, ignition surrounds and cockpit accents. Race-cockpit grade finish.',
    descriptionUk:
      'Накладки на приладову панель, обрамлення замка запалювання та акценти кокпіту. Якість гоночного рівня.',
    badge: 'Detail',
    badgeUk: 'Деталі',
    image: '/images/shop/ilmberger/products/cockpit-clutch.jpg',
    objectPosition: 'center',
    link: '/shop/ilmberger/collections?category=cockpit',
  },
];

/* ─── Heritage section ───────────────────────────────────── */
export const ILMBERGER_HERITAGE = {
  // null when no footage yet — fallback to static carbon-weave background
  videoUrl: null as string | null,
  fallbackImage: '/logos/ilmberger-carbon.webp',
  fallbackWidth: 800,
  fallbackHeight: 600,
  title: 'Hand-Laid in Lindberg',
  titleUk: 'Ручна укладка в Ліндберзі',
  description:
    'Since 1995, every Ilmberger Carbon part has been hand-laid, autoclave-cured and CNC-finished in Lindberg, Bavaria. From World Superbike paddocks to street riders — three decades of relentless pursuit of the perfect twill weave. Prepreg layup, vacuum bagging and high-pressure autoclave cycles ensure consistent fibre orientation and zero voids in every panel.',
  descriptionUk:
    'З 1995 року кожна деталь Ilmberger Carbon виготовлена вручну, запечена в автоклаві та оброблена на ЧПУ-станку в Ліндберзі, Баварія. Від паддоків World Superbike до вуличних мотоциклістів — три десятиліття невпинного прагнення до ідеального twill-плетіння. Препрег-укладка, вакуумне пакування та цикли високого тиску в автоклаві забезпечують стабільну орієнтацію волокон та повну відсутність порожнин у кожній панелі.',
};

/* ─── Category chip matching ──────────────────────────────────────
   The storefront category filter matches a product against a chip by
   testing its searchable text (title EN/UA + category + sku + tags).
   The exact category-id tag (set at import time, e.g. "frame-protection")
   is the primary signal; the keyword lists below are a resilience layer
   so products that were never tagged — or imported as "other" — still
   surface under the right chip via their part name in EN or UA.
   Keywords are lowercase substrings; keep them specific enough not to
   collide across categories (e.g. avoid bare "wing", which is a substring
   of "swingarm"). */
export const ILMBERGER_CATEGORY_KEYWORDS: Record<string, string[]> = {
  fairings: ['fairing', 'обтічник', 'winglet', 'bellypan', 'belly pan', 'undertray', 'beak', 'дзьоб'],
  'tank-covers': ['tank cover', 'tank side', 'tank pad', 'накладка бака', 'бак'],
  fenders: ['fender', 'hugger', 'крило', 'бризковик', 'mudguard'],
  'frame-protection': ['frame', 'swingarm', 'swing arm', 'маятник', 'рама'],
  'wheel-covers': ['wheel cover', 'колесо', 'колеса', 'обід'],
  cockpit: ['cockpit', 'кокпіт', 'ignition switch', 'ключ запалювання', 'hand protector', 'hand guard', 'захист рук', 'dashboard'],
  exhaust: ['exhaust', 'muffler', 'silencer', 'вихлоп', 'глушник', 'колектор'],
  engine: ['engine', 'alternator', 'генератор', 'clutch', 'зчеплення', 'sprocket', 'зірк', 'water pump', 'помп', 'watercooler', 'радіатор', 'rotor', 'ротор'],
  'air-intake': ['air-intake', 'air intake', 'airbox', 'повітрозабірник', 'intake'],
  seats: ['seat', 'сидіння', 'passenger seat', 'single seat', 'хвіст'],
  lighting: ['headlight', 'windshield', 'windscreen', 'light mask', 'фара', 'вітров', 'світлов'],
};

/**
 * True if a product (represented by its already-lowercased searchable
 * text) belongs to the given Ilmberger category chip id. Matches the
 * exact category-id tag first, then falls back to part-name keywords.
 */
export function ilmbergerMatchesCategory(
  searchableTextLower: string,
  categoryId: string,
): boolean {
  if (categoryId === 'all') return true;
  if (searchableTextLower.includes(categoryId)) return true;
  const keywords = ILMBERGER_CATEGORY_KEYWORDS[categoryId];
  return keywords ? keywords.some((k) => searchableTextLower.includes(k)) : false;
}

/* ─── Cinematic scroll scenes (used by IlmbergerCinematicScroll) ── */
export const ILMBERGER_SCROLL_SCENES = [
  {
    title: 'The Layup',
    titleUk: 'Укладка',
    subtitle: 'Prepreg sheets, oriented by hand. Every fibre placed with intent.',
    subtitleUk: 'Препрег-листи, орієнтовані вручну. Кожне волокно укладене з умислом.',
    video: null as string | null,
  },
  {
    title: 'The Autoclave',
    titleUk: 'Автоклав',
    subtitle: 'High pressure. High heat. Carbon becomes structure.',
    subtitleUk: 'Високий тиск. Висока температура. Карбон стає структурою.',
    video: null as string | null,
  },
  {
    title: 'The Result',
    titleUk: 'Результат',
    subtitle: 'Lighter than aluminum. Stronger than steel. Beautifully imperfect.',
    subtitleUk: 'Легше алюмінію. Міцніше сталі. Прекрасно недосконале.',
    video: null as string | null,
  },
] as const;
