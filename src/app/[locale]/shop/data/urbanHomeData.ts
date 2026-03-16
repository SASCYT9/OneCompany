/**
 * Urban Home — copy of section settings from reference theme (index.json).
 * Used by UrbanHomeSignature for hero + featured models.
 * Urban runs on our site only (no Shopify).
 */

export type UrbanFeaturedModel = {
  title: string;
  titleUk: string;
  subtitle: string;
  subtitleUk: string;
  badge: string;
  badgeUk: string;
  tagOne: string;
  tagTwo: string;
  buttonLabel: string;
  buttonLabelUk: string;
  link: string;
  imageUrl: string;
};

export const URBAN_HERO = {
  eyebrow: 'One Company x Urban Automotive',
  eyebrowUk: 'One Company x Urban Automotive',
  title: 'Premium Urban Styling.',
  titleUk: 'Преміальні обвіси Urban',
  subtitle:
    'Official Urban Automotive supplier in Ukraine: full Urban body kit range. Premium quality and status. Full turnkey support.',
  subtitleUk:
    'Офіційний постачальник Urban Automotive в Україні: повний модельний ряд обвісів Urban, преміальна якість та статус, повний супровід під ключ.',
  primaryButtonLabel: 'Explore Urban Range',
  primaryButtonLabelUk: 'Переглянути модельний ряд Urban',
  primaryButtonLink: '/shop/urban/collections',
  secondaryButtonLabel: 'About One Company',
  secondaryButtonLabelUk: 'Про One Company',
  secondaryButtonLink: 'https://onecompany.global/ua',
  secondaryButtonNewTab: true,
  /** Placeholder or first showcase image from theme assets */
  heroImageUrl:
    'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp',
} as const;

export const URBAN_FEATURED_MODELS: UrbanFeaturedModel[] = [
  {
    title: 'Cullinan Series II',
    titleUk: 'Cullinan Series II',
    subtitle: 'Rolls-Royce by Urban',
    subtitleUk: 'Rolls-Royce від Urban',
    badge: 'Luxury',
    badgeUk: 'Люкс',
    tagOne: 'Hand Finished',
    tagTwo: 'Bespoke',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/rolls-royce-cullinan-series-ii',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/cols/models/cullinanSeriesII/webp/urban-automotive-rolls-royce-cullinan.webp',
  },
  {
    title: 'Defender Widetrack',
    titleUk: 'Defender Widetrack',
    subtitle: '2020+ Programme',
    subtitleUk: 'Програма 2020+',
    badge: 'Signature',
    badgeUk: 'Signature',
    tagOne: 'Widetrack',
    tagTwo: 'Best of British',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/land-rover-defender-110',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp',
  },
  {
    title: 'G-Wagon W465',
    titleUk: 'G-Wagon W465',
    subtitle: 'Widetrack Programme',
    subtitleUk: 'Програма Widetrack',
    badge: '2024+',
    badgeUk: '2024+',
    tagOne: 'Signature',
    tagTwo: 'Urban Aero',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/mercedes-g-wagon-w465-widetrack',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp',
  },
  {
    title: 'Lamborghini Urus',
    titleUk: 'Lamborghini Urus',
    subtitle: 'Urban Urus Programme',
    subtitleUk: 'Програма Urban Urus',
    badge: 'Statement',
    badgeUk: 'Statement',
    tagOne: 'Carbon',
    tagTwo: 'Widebody',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/lamborghini-urus',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urus/carousel-1-1920.jpg',
  },
  {
    title: 'Rolls-Royce Ghost',
    titleUk: 'Rolls-Royce Ghost',
    subtitle: 'Urban Ghost Programme',
    subtitleUk: 'Програма Urban Ghost',
    badge: 'New',
    badgeUk: 'Новий',
    tagOne: 'Luxury',
    tagTwo: 'Bespoke',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/rolls-royce-ghost-series-ii',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/cols/models/ghost/col-image-1-lg.jpg',
  },
  {
    title: 'Range Rover L460',
    titleUk: 'Range Rover L460',
    subtitle: 'The New Range Rover',
    subtitleUk: 'Новий Range Rover',
    badge: '2022+',
    badgeUk: '2022+',
    tagOne: 'Luxury',
    tagTwo: 'Signature',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/range-rover-l460',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/cols/models/rangeRover2022Plus/col-image-1-lg.jpg',
  },
  {
    title: 'Bentley Continental GT',
    titleUk: 'Bentley Continental GT',
    subtitle: 'Grand Touring by Urban',
    subtitleUk: 'Grand Touring від Urban',
    badge: 'Coachbuilt',
    badgeUk: 'Coachbuilt',
    tagOne: 'Luxury',
    tagTwo: 'GT',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/bentley-continental-gt',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/continentalGT/hero-1-1920.jpg',
  },
  {
    title: 'Audi RSQ8',
    titleUk: 'Audi RSQ8',
    subtitle: 'Urban RSQ8 Programme',
    subtitleUk: 'Програма Urban RSQ8',
    badge: 'Facelift',
    badgeUk: 'Facelift',
    tagOne: 'Aero',
    tagTwo: 'Carbon',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/audi-rsq8-facelift',
    imageUrl:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp',
  },
];
