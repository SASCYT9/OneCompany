/**
 * Urban Home — copy of section settings from reference theme (index.json).
 * Used by UrbanHomeSignature for hero + featured models.
 * Urban runs on our site only (no Shopify).
 */

import { URBAN_COLLECTIONS_INDEX_PATH } from './urbanRoutes';

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
    'Full Urban body kit range, premium quality, and turnkey support for bold exterior builds.',
  subtitleUk:
    'Повний модельний ряд обвісів Urban, преміальна якість та супровід під ключ для виразних екстерʼєрних проєктів.',
  primaryButtonLabel: 'Explore Urban Range',
  primaryButtonLabelUk: 'Переглянути модельний ряд Urban',
  primaryButtonLink: URBAN_COLLECTIONS_INDEX_PATH,
  secondaryButtonLabel: 'About One Company',
  secondaryButtonLabelUk: 'Про One Company',
  secondaryButtonLink: 'https://onecompany.global/ua',
  secondaryButtonNewTab: true,
  heroImageUrl: '/images/shop/urban/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp',
} as const;

export const URBAN_FEATURED_MODELS: UrbanFeaturedModel[] = [
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
      '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp',
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
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp',
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
      '/images/shop/urban/cols/models/rangeRover2022Plus/col-image-1-lg.jpg',
  },
  {
    title: 'Audi RS6',
    titleUk: 'Audi RS6',
    subtitle: 'Urban RS6 Programme',
    subtitleUk: 'Програма Urban RS6',
    badge: 'Performance',
    badgeUk: 'Перформанс',
    tagOne: 'Aero',
    tagTwo: 'Carbon',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/urban/collections/audi-rs6-rs7',
    imageUrl:
      '/images/shop/urban/hero/models/rs6/hero-1-1920.jpg',
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
      '/images/shop/urban/carousel/models/urus/carousel-1-1920.jpg',
  },
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
      '/images/shop/urban/cols/models/cullinanSeriesII/webp/urban-automotive-rolls-royce-cullinan.webp',
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
      '/images/shop/urban/hero/models/continentalGT/hero-1-1920.jpg',
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
      '/images/shop/urban/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp',
  },
];
