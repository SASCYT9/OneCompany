export type Do88FeaturedModel = {
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

export const DO88_HERO = {
  eyebrow: 'One Company x Do88',
  eyebrowUk: 'One Company x Do88',
  title: 'Performance Cooling.',
  titleUk: 'Продуктивне охолодження.',
  subtitle:
    'Official DO88 supplier in Ukraine. Premium cooling systems, intercoolers, and silicone hoses from Sweden. Engineered for maximum performance.',
  subtitleUk:
    'Офіційний постачальник DO88 в Україні. Преміальні системи охолодження, інтеркулери та силіконові патрубки зі Швеції. Створено для максимальної продуктивності.',
  primaryButtonLabel: 'Explore DO88 Range',
  primaryButtonLabelUk: 'Переглянути каталог DO88',
  primaryButtonLink: '/shop/stock?distributor=DO88',
  secondaryButtonLabel: 'About One Company',
  secondaryButtonLabelUk: 'Про One Company',
  secondaryButtonLink: 'https://onecompany.global/ua',
  secondaryButtonNewTab: true,
  heroImageUrl: '/branding/do88/do88_bw_porsche_hero_1774443620183.png', // BW Cinematic Porsche 911 Turbo S front
} as const;

export const DO88_FEATURED_MODELS: Do88FeaturedModel[] = [
  {
    title: 'BMW M2/M3/M4 (G8X)',
    titleUk: 'BMW M2/M3/M4 (G8X)',
    subtitle: 'S58 Cooling Solutions',
    subtitleUk: 'Системи охолодження S58',
    badge: 'Performance',
    badgeUk: 'Перформанс',
    tagOne: 'Intercoolers',
    tagTwo: 'Radiators',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/stock?distributor=DO88&q=G80',
    imageUrl: '/branding/do88/do88_bw_featured_bmw_1774445183885.png',
  },
  {
    title: 'Porsche 911 (991/992)',
    titleUk: 'Porsche 911 (991/992)',
    subtitle: 'Turbo & GT3 Cooling',
    subtitleUk: 'Охолодження Turbo & GT3',
    badge: 'Track',
    badgeUk: 'Трек',
    tagOne: 'Cooler Kits',
    tagTwo: 'Y-Pipes',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/stock?distributor=DO88&q=Porsche',
    imageUrl: '/branding/do88/do88_bw_featured_porsche_1774445208629.png',
  },
  {
    title: 'VAG EA888 Gen3/Gen4',
    titleUk: 'VAG EA888 Gen3/Gen4',
    subtitle: 'Golf R, S3, Cupra',
    subtitleUk: 'Golf R, S3, Cupra',
    badge: 'Popular',
    badgeUk: 'Популярно',
    tagOne: 'Intakes',
    tagTwo: 'Charge Pipes',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/stock?distributor=DO88&q=Golf+R',
    imageUrl: '/branding/do88/do88_bw_featured_golf_1774445231340.png',
  },
  {
    title: 'Toyota GR Yaris / Corolla',
    titleUk: 'Toyota GR Yaris / Corolla',
    subtitle: 'G16E-GTS Cooling',
    subtitleUk: 'Охолодження G16E-GTS',
    badge: 'Rally',
    badgeUk: 'Ралі',
    tagOne: 'Oil Coolers',
    tagTwo: 'Intakes',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/stock?distributor=DO88&q=Yaris',
    imageUrl: '/branding/do88/do88_bw_featured_yaris_1774445259859.png',
  }
];
