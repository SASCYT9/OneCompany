export type BrabusFeaturedModel = {
  /** Unique slug used for React keys and analytics — must differ across cards */
  slug: string;
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
  /** Must match a real collection handle in BRABUS_COLLECTION_CARDS */
  link: string;
  imageUrl: string;
};

export const BRABUS_HERO = {
  eyebrow: 'One Company × Brabus',
  eyebrowUk: 'One Company × Brabus',
  title: 'Beyond Perfection.',
  titleUk: 'За межами досконалості.',
  subtitle:
    'Aerodynamic kits, forged wheels, and performance upgrades — the legendary 1-Second-Wow effect.',
  subtitleUk:
    'Аеродинамічні обвіси, ковані диски та збільшення потужності — легендарний ефект 1-Second-Wow.',
  primaryButtonLabel: 'Explore Range',
  primaryButtonLabelUk: 'Модельний ряд',
  primaryButtonLink: '/shop/brabus/collections',
  secondaryButtonLabel: 'Official Brabus',
  secondaryButtonLabelUk: 'Офіційний Brabus',
  secondaryButtonLink: 'https://www.brabus.com',
  secondaryButtonNewTab: true,
  /** BRABUS 900 G-Class — cinematic dark parking garage shot */
  heroImageUrl: '/images/shop/brabus/hq/brabus-portal-hero.png',
} as const;

/**
 * Fleet grid — vehicle programmes with parts that are actually purchasable.
 * Subtitles describe the sellable BRABUS programme (aero, wheels, power),
 * not limited-edition complete cars (Rocket Edition, Rocket R, Rocket 1000)
 * which can't be ordered through the shop.
 */
export const BRABUS_FEATURED_MODELS: BrabusFeaturedModel[] = [
  {
    slug: 'mercedes-w223',
    title: 'Mercedes-Benz W223',
    titleUk: 'Mercedes-Benz W223',
    subtitle: 'S-Class Programme',
    subtitleUk: 'Програма S-Class',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    tagOne: 'Hybrid',
    tagTwo: '930 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/s-class',
    /** S-Class W223 (Maybach V12 trim) — clean studio side profile */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-112.jpg',
  },
  {
    slug: 'porsche-911-turbo-s',
    title: 'Porsche 911 Turbo S',
    titleUk: 'Porsche 911 Turbo S',
    subtitle: 'Performance Programme',
    subtitleUk: 'Програма Performance',
    badge: 'Limited',
    badgeUk: 'Лімітований',
    tagOne: 'Carbon',
    tagTwo: '900 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/porsche',
    /** 900 Rocket R — real studio shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-84.jpg',
  },
  {
    slug: 'brabus-900-bentley-gtc',
    title: 'Brabus 900',
    titleUk: 'Brabus 900',
    subtitle: 'Bentley GTC',
    subtitleUk: 'Bentley GTC',
    badge: 'Luxury',
    badgeUk: 'Люкс',
    tagOne: 'Masterpiece',
    tagTwo: 'Forged',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/bentley',
    /** Bentley GTC — landscape pure side profile (facing right) */
    imageUrl: '/images/shop/brabus/hq/brabus-bentley-side.png',
  },
  {
    slug: 'brabus-900-lambo-urus-se',
    title: 'Brabus 900',
    titleUk: 'Brabus 900',
    subtitle: 'Lamborghini Urus SE',
    subtitleUk: 'Lamborghini Urus SE',
    badge: 'Executive',
    badgeUk: 'Executive',
    tagOne: 'Aero',
    tagTwo: '900 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/lamborghini',
    /** Lamborghini Urus 900 — real location shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-76.jpg',
  },
  {
    slug: 'range-rover-600',
    title: 'Range Rover 600',
    titleUk: 'Range Rover 600',
    subtitle: 'Brabus Signature',
    subtitleUk: 'Brabus Signature',
    badge: 'Statement',
    badgeUk: 'Statement',
    tagOne: 'Carbon',
    tagTwo: '600 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/range-rover',
    /** Range Rover 600 — real studio shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-148.jpg',
  },
];
