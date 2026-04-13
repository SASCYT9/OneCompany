export type BrabusFeaturedModel = {
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
    'Official Brabus supplier in Ukraine. Aerodynamic kits, forged wheels, performance upgrades — the legendary 1-Second-Wow effect.',
  subtitleUk:
    'Офіційний постачальник Brabus в Україні. Аеродинамічні обвіси, ковані диски, збільшення потужності — легендарний ефект 1-Second-Wow.',
  primaryButtonLabel: 'Explore Range',
  primaryButtonLabelUk: 'Модельний ряд',
  primaryButtonLink: '/shop/brabus/collections',
  secondaryButtonLabel: 'About Us',
  secondaryButtonLabelUk: 'Про нас',
  secondaryButtonLink: '/about',
  secondaryButtonNewTab: false,
  /** Rocket Edition G-Class dark studio shot with red neon & wet reflections — largest HQ image */
  heroImageUrl: '/images/shop/brabus/hq/brabus-supercars-27.jpg',
} as const;

/**
 * Fleet grid — each model uses REAL vehicle photos from brabus.com.
 * Links point to real collections defined in brabusCollectionsList.ts.
 * 
 * Image mapping from _manifest.json:
 * - G-Class: BRABUS 900 ROCKET EDITION W465 On Location (22) — front 3/4 view
 * - Porsche: BRABUS ROCKET R Studio (53) — side profile
 * - S-Class: BRABUS 930 S63 E Performance — studio 
 * - Bentley: BRABUS GT and GTC Bentley (29) — front view
 * - Lamborghini: BRABUS 900 Lambo Urus On Location (1) — HQ wide
 * - Range Rover: BRABUS RANGE ROVER 600 Studio (55) — studio
 */
export const BRABUS_FEATURED_MODELS: BrabusFeaturedModel[] = [
  {
    title: 'G-Class W465',
    titleUk: 'G-Class W465',
    subtitle: 'Rocket Edition 900',
    subtitleUk: 'Rocket Edition 900',
    badge: 'New',
    badgeUk: 'Новий',
    tagOne: 'Widestar',
    tagTwo: '900 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/g-class',
    /** W465 Rocket Edition — real studio shot (Superblack) */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-134.jpg',
  },
  {
    title: 'Porsche 911 Turbo S',
    titleUk: 'Porsche 911 Turbo S',
    subtitle: 'Brabus 900 Rocket R',
    subtitleUk: 'Brabus 900 Rocket R',
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
    title: 'Brabus 930',
    titleUk: 'Brabus 930',
    subtitle: 'S63 E Performance',
    subtitleUk: 'S63 E Performance',
    badge: 'Performance',
    badgeUk: 'Performance',
    tagOne: 'Hybrid',
    tagTwo: '930 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/s-class',
    /** S63 E Performance — real studio shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-112.jpg',
  },
  {
    title: 'Brabus 820',
    titleUk: 'Brabus 820',
    subtitle: 'Bentley GTC',
    subtitleUk: 'Bentley GTC',
    badge: 'Luxury',
    badgeUk: 'Люкс',
    tagOne: 'Masterpiece',
    tagTwo: 'Forged',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/rolls-royce',
    /** Bentley GTC — real front view shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-51.jpg',
  },
  {
    title: 'Brabus 900',
    titleUk: 'Brabus 900',
    subtitle: 'Lamborghini Urus',
    subtitleUk: 'Lamborghini Urus',
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
