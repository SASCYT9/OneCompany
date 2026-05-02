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
  flipImage?: boolean;
};

export const DO88_HERO = {
  eyebrow: 'One Company x Do88',
  eyebrowUk: 'One Company x Do88',
  title: 'Performance Cooling.',
  titleUk: 'Продуктивне охолодження.',
  subtitle:
    'Premium cooling systems, intercoolers, and silicone hoses from Sweden. Engineered for maximum performance.',
  subtitleUk:
    'Преміальні системи охолодження, інтеркулери та силіконові патрубки зі Швеції. Створено для максимальної продуктивності.',
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
    link: '/shop/do88/collections/all?brand=BMW&model=M3+%2F+M4&chassis=G80+G82',
    imageUrl: '/branding/do88/do88_featured_bmw_g8x_studio.webp',
  },
  {
    title: 'Porsche 911 Carrera (992)',
    titleUk: 'Porsche 911 Carrera (992)',
    subtitle: 'Track-spec cooling for the 992',
    subtitleUk: 'Трекове охолодження для 992',
    badge: 'Featured',
    badgeUk: 'Рекомендовано',
    tagOne: 'Intercoolers',
    tagTwo: 'Y-Pipes',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/do88/collections/all?brand=Porsche&model=911+Carrera&chassis=992',
    imageUrl: '/branding/do88/do88_featured_porsche_992_studio.webp',
  },
  {
    title: 'Audi RS6 / RS7 (C8)',
    titleUk: 'Audi RS6 / RS7 (C8)',
    subtitle: '4.0 TFSI C8 Cooling',
    subtitleUk: 'Охолодження 4.0 TFSI C8',
    badge: 'Popular',
    badgeUk: 'Популярно',
    tagOne: 'Intercoolers',
    tagTwo: 'Oil Coolers',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/do88/collections/all?brand=Audi&model=RS6+%2F+RS7&chassis=C8',
    imageUrl: '/branding/do88/do88_featured_audi_rs6_c8_studio.webp',
  },
  {
    title: 'Porsche 911 Turbo S (992)',
    titleUk: 'Porsche 911 Turbo S (992)',
    subtitle: '992 Turbo / Turbo S cooling system',
    subtitleUk: 'Охолодження для 992 Turbo / Turbo S',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    tagOne: 'Intercoolers',
    tagTwo: 'Plenum',
    buttonLabel: 'View Products',
    buttonLabelUk: 'Переглянути товари',
    link: '/shop/do88/collections/all?brand=Porsche&model=911+Turbo+S&chassis=992',
    imageUrl: '/branding/do88/do88_featured_porsche_992_turbo_s_studio.png',
  },
];
