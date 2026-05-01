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
    slug: 'g-class-w465',
    title: 'G-Class W465',
    titleUk: 'G-Class W465',
    subtitle: 'Widestar Programme',
    subtitleUk: 'Програма Widestar',
    badge: 'New',
    badgeUk: 'Новий',
    tagOne: 'Widestar',
    tagTwo: '900 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/g-class',
    /** W465 — clean studio side profile (Superblack) */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-134.jpg',
  },
  {
    slug: 'mercedes-w223',
    title: 'Mercedes-Benz W223',
    titleUk: 'Mercedes-Benz W223',
    subtitle: 'BRABUS 930 — S 63 E Performance',
    subtitleUk: 'BRABUS 930 — S 63 E Performance',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    tagOne: 'Hybrid',
    tagTwo: '930 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/s-class',
    /** BRABUS 930 — actual S 63 E Performance listing photo from
     *  brabus.com cars-for-sale (VKC4S_337). Real car, side profile facing right. */
    imageUrl: '/images/shop/brabus/hq/brabus-s63-real.jpg',
  },
  {
    slug: 'brabus-900-bentley-gt',
    title: 'Brabus 900',
    titleUk: 'Brabus 900',
    subtitle: 'Bentley Continental GT',
    subtitleUk: 'Bentley Continental GT',
    badge: 'Luxury',
    badgeUk: 'Люкс',
    tagOne: 'Masterpiece',
    tagTwo: 'Forged',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/bentley',
    /** Bentley Continental GT — black coupe side profile (facing right) */
    imageUrl: '/images/shop/brabus/hq/brabus-bentley-gt-black.jpg',
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
    subtitle: 'Range Rover L460',
    subtitleUk: 'Range Rover L460',
    badge: 'Statement',
    badgeUk: 'Statement',
    tagOne: 'Carbon',
    tagTwo: '600 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/range-rover',
    /** BRABUS 600 — actual Range Rover L460 listing photo from
     *  brabus.com cars-for-sale (C4S479), floor whitened. */
    imageUrl: '/images/shop/brabus/hq/brabus-rangerover-l460-real.jpg',
  },
];
