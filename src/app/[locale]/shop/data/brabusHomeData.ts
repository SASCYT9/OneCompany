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
  title: 'Masterpiece of Power.',
  titleUk: 'Шедевр Потужності.',
  subtitle:
    'Official Brabus supplier in Ukraine. Aerodynamic kits, forged wheels, performance upgrades — the legendary 1-Second-Wow effect.',
  subtitleUk:
    'Офіційний постачальник Brabus в Україні. Аеродинамічні обвіси, ковані диски, збільшення потужності — легендарний ефект 1-Second-Wow.',
  primaryButtonLabel: 'Explore Range',
  primaryButtonLabelUk: 'Модельний ряд',
  primaryButtonLink: '/shop/brabus/collections',
  secondaryButtonLabel: 'About One Company',
  secondaryButtonLabelUk: 'Про One Company',
  secondaryButtonLink: 'https://onecompany.global/ua',
  secondaryButtonNewTab: true,
  /** Rocket Edition G-Class dark studio shot with red neon & wet reflections — largest HQ image */
  heroImageUrl: '/images/shop/brabus/hq/brabus-supercars-27.jpg',
} as const;

/**
 * Fleet grid — each model now uses a UNIQUE vehicle photo from the HQ library.
 * Links point to real collections defined in brabusCollectionsList.ts.
 */
export const BRABUS_FEATURED_MODELS: BrabusFeaturedModel[] = [
  {
    title: 'G-Class W465',
    titleUk: 'G-Class W465',
    subtitle: 'Rocket Edition 900',
    subtitleUk: 'Rocket Edition 900',
    badge: 'New',
    badgeUk: 'Новий',
    tagOne: 'Widetrack',
    tagTwo: '900 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/g-class',
    /** W465 Rocket Edition — on location, dark dramatic, front 3/4 */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-22.jpg',
  },
  {
    title: 'G-Class 800 4x4²',
    titleUk: 'G-Class 800 4x4²',
    subtitle: 'Stealth Green',
    subtitleUk: 'Stealth Green',
    badge: 'Signature',
    badgeUk: 'Signature',
    tagOne: 'Carbon',
    tagTwo: '800 HP',
    buttonLabel: 'View Programme',
    buttonLabelUk: 'Переглянути програму',
    link: '/shop/brabus/collections/g-class',
    /** G-Class 800 4x4² Stealth Green — dark studio exterior */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-178.jpg',
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
    /** S63 E Performance 930 — studio sky shot — completely different car */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-180.jpg',
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
    /** Bentley GTC copper — large studio shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-39.jpg',
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
    link: '/shop/brabus/collections/porsche',
    /** Lamborghini Urus 900 — on location, dramatic outdoor shot */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-16.jpg',
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
    link: '/shop/brabus/collections/wheels',
    /** Range Rover 600 — studio shot, unique vehicle */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-176.jpg',
  },
];
