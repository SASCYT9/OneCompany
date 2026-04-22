/**
 * Urban Home — 8 cinematic model showcases (uh7-sc).
 * Data from reference theme section-urban-home-signature.liquid.
 * Urban — власний магазин на нашому сайті (Next.js + наш бекенд), без Shopify.
 */

const BASE = '/images/shop/urban';

/** Helper to build a direct link to a specific Urban collection page */
const col = (handle: string) => `/shop/urban/collections/${handle}` as const;

export type UrbanShowcase = {
  num: string;
  imageUrl: string;
  imageAlt: string;
  vimeoUrl: string;
  badge: string;
  badgeUk: string;
  name: string;
  nameUk: string;
  subtitle: string;
  subtitleUk: string;
  exploreLink: string;
  shopLink: string;
  avail: string;
  availUk: string;
};

export const URBAN_SHOWCASES: UrbanShowcase[] = [
  {
    num: '01',
    imageUrl: `${BASE}/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp`,
    imageAlt: 'Urban Defender Widetrack',
    vimeoUrl: 'https://player.vimeo.com/video/835466961?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'Signature',
    badgeUk: 'Фірмовий',
    name: 'Defender\nWidetrack',
    nameUk: 'Defender\nWidetrack',
    subtitle:
      "The world's most desirable Defender. Wide-body styling, premium carbon fibre, Urban's signature aesthetic.",
    subtitleUk:
      'Найбажаніший Defender у світі. Широкий кузов, преміальний карбон та фірмова естетика Urban.',
    exploreLink: col('land-rover-defender-110'),
    shopLink: col('land-rover-defender-110'),
    avail: 'Available',
    availUk: 'Доступно',
  },
  {
    num: '02',
    imageUrl: `${BASE}/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp`,
    imageAlt: 'Urban G-Wagon Widetrack',
    vimeoUrl: 'https://player.vimeo.com/video/585275273?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: '2024+',
    badgeUk: '2024+',
    name: 'G-Wagon\nW465',
    nameUk: 'G-Wagon\nW465',
    subtitle:
      "Urban's latest statement. The new G63 Widetrack — aggressive stance and unmatched road presence.",
    subtitleUk:
      'Останній стейтмент Urban. Новий G63 Widetrack — агресивна стійка та неперевершена присутність.',
    exploreLink: col('mercedes-g-wagon-w465-widetrack'),
    shopLink: col('mercedes-g-wagon-w465-widetrack'),
    avail: 'New Model',
    availUk: 'Нова модель',
  },
  {
    num: '03',
    imageUrl: `${BASE}/banners/models/rangeRover2022Plus/banner-1-1920.jpg`,
    imageAlt: 'Urban Range Rover L460',
    vimeoUrl: 'https://player.vimeo.com/video/944107376?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'Performance',
    badgeUk: 'Перформанс',
    name: 'Range Rover\nL460',
    nameUk: 'Range Rover\nL460',
    subtitle:
      'British luxury performance at its finest. Sport aerodynamics, carbon accents and commanding presence.',
    subtitleUk:
      'Британський люкс-перформанс у його кращому вигляді. Спортивна аеродинаміка, карбонові акценти та виразна присутність.',
    exploreLink: col('range-rover-l460'),
    shopLink: col('range-rover-l460'),
    avail: 'Available',
    availUk: 'Доступно',
  },
  {
    num: '04',
    imageUrl: `${BASE}/hero/models/rs6/hero-1-1920.jpg`,
    imageAlt: 'Urban Audi RS6 C8',
    vimeoUrl: 'https://player.vimeo.com/video/585275488?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'Performance',
    badgeUk: 'Перформанс',
    name: 'Audi RS6\nAvant',
    nameUk: 'Audi RS6\nAvant',
    subtitle:
      "The world's fastest estate, perfected by Urban. Aerodynamic carbon, forged wheels and commanding stance.",
    subtitleUk:
      'Найшвидший універсал у світі, доведений до досконалості Urban. Аеродинамічний карбон, ковані диски та виразна стійка.',
    exploreLink: col('audi-rs6-rs7'),
    shopLink: col('audi-rs6-rs7'),
    avail: 'Available',
    availUk: 'Доступно',
  },
  {
    num: '05',
    imageUrl: `${BASE}/cols/models/cullinanSeriesII/webp/urban-automotive-rolls-royce-cullinan.webp`,
    imageAlt: 'Urban Rolls-Royce Cullinan Series II',
    vimeoUrl: 'https://player.vimeo.com/video/786323677?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'New Arrival',
    badgeUk: 'Новинка',
    name: 'Cullinan\nSeries II',
    nameUk: 'Cullinan\nSeries II',
    subtitle:
      "The pinnacle of luxury, redefined. Urban's bespoke Widetrack programme for the new Cullinan — over 250 hours of handcraft per build.",
    subtitleUk:
      'Вершина розкоші, переосмислена. Ексклюзивна програма Urban Widetrack для нового Cullinan — понад 250 годин ручної праці.',
    exploreLink: col('rolls-royce-cullinan-series-ii'),
    shopLink: col('rolls-royce-cullinan-series-ii'),
    avail: 'Available to Order',
    availUk: 'Доступно',
  },
  {
    num: '06',
    imageUrl: `${BASE}/hero/models/urus/hero-1-1920.jpg`,
    imageAlt: 'Urban Lamborghini Urus',
    vimeoUrl: 'https://player.vimeo.com/video/850204410?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'Statement',
    badgeUk: 'Стейтмент',
    name: 'Lamborghini\nUrus',
    nameUk: 'Lamborghini\nUrus',
    subtitle:
      'Raw Italian performance meets British craftsmanship. Carbon widebody, forged wheels, bespoke interior.',
    subtitleUk:
      "Італійський перформанс зустрічає британську майстерність. Карбоновий widebody, ковані диски, ексклюзивний інтер'єр.",
    exploreLink: col('lamborghini-urus'),
    shopLink: col('lamborghini-urus'),
    avail: 'Available',
    availUk: 'Доступно',
  },
  {
    num: '07',
    imageUrl: `${BASE}/hero/models/continentalGT/hero-1-1920.jpg`,
    imageAlt: 'Urban Bentley Continental GT',
    vimeoUrl: 'https://player.vimeo.com/video/585275033?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'Coachbuilt',
    badgeUk: 'Індивідуальний',
    name: 'Bentley\nContinental GT',
    nameUk: 'Bentley\nContinental GT',
    subtitle:
      'The grand tourer in its finest form. Urban carbon elements and unparalleled refinement for the most discerning.',
    subtitleUk:
      'Гранд-турер у найвищому прояві. Urban карбонові елементи та неперевершена витонченість для найвибагливіших.',
    exploreLink: col('bentley-continental-gt'),
    shopLink: col('bentley-continental-gt'),
    avail: 'Available',
    availUk: 'Доступно',
  },
  {
    num: '08',
    imageUrl: `${BASE}/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp`,
    imageAlt: 'Urban Audi RSQ8 Urban Edition',
    vimeoUrl: 'https://player.vimeo.com/video/756839833?background=1&autoplay=1&loop=1&muted=1&quality=720p',
    badge: 'Facelift',
    badgeUk: 'Фейсліфт',
    name: 'Audi RSQ8\nUrban Edition',
    nameUk: 'Audi RSQ8\nUrban Edition',
    subtitle:
      "Audi's most powerful SUV with Urban's aero package. Exclusive carbon fibre and aggressive presence.",
    subtitleUk:
      'Найпотужніший кросовер Audi з аеродинамічним пакетом Urban. Ексклюзивний карбон та агресивна присутність.',
    exploreLink: col('audi-rsq8-facelift'),
    shopLink: col('audi-rsq8-facelift'),
    avail: 'Available',
    availUk: 'Доступно',
  },
];
