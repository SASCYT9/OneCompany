export const BURGER_HERO = {
  eyebrow: 'One Company × Burger Motorsports',
  eyebrowUk: 'One Company × Burger Motorsports',
  title: 'JB4',
  titleLine2: 'Performance.',
  titleUk: 'JB4',
  titleLine2Uk: 'Performance.',
  subtitle:
    'World-famous plug & play performance tuning since 2007. JB4 tuners, flex fuel kits, intakes, and precision-engineered parts for 30+ vehicle brands.',
  subtitleUk:
    'Всесвітньо відомий plug & play performance тюнінг з 2007 року. JB4 тюнери, flex fuel кіти, інтейки та деталі для 30+ марок авто.',
  primaryButtonLabel: 'Explore Catalog',
  primaryButtonLabelUk: 'Каталог',
  primaryButtonLink: '/shop/burger/products',
  secondaryButtonLabel: 'About Us',
  secondaryButtonLabelUk: 'Про нас',
  secondaryButtonLink: '/about',
  heroImageUrl: '/images/shop/burger/hero_jb4_tech.png',
} as const;

export const BURGER_STATS = [
  { num: '2007', label: 'Founded', labelUk: 'Засновано' },
  { num: '900+', label: 'HP Gains', labelUk: 'HP приріст' },
  { num: '30+', label: 'Brands', labelUk: 'Марок авто' },
] as const;

export type BurgerShowcase = {
  badge: string;
  badgeUk: string;
  name: string;
  nameUk: string;
  desc: string;
  descUk: string;
  link: string;
  imageUrl: string;
};

export const BURGER_SHOWCASES: BurgerShowcase[] = [
  {
    badge: 'Flagship',
    badgeUk: 'Флагман',
    name: 'JB4 Tuners',
    nameUk: 'JB4 Тюнери',
    desc: 'Plug & play performance tuning. Up to 100+ HP gains with no permanent modifications.',
    descUk: 'Plug & play performance тюнінг. До 100+ к.с. приросту без постійних модифікацій.',
    link: '/shop/burger/products',
    imageUrl: '/images/shop/burger/jb4_device_macro.png',
  },
  {
    badge: 'Fuel Systems',
    badgeUk: 'Паливні системи',
    name: 'Flex Fuel Kits',
    nameUk: 'Flex Fuel Кіти',
    desc: 'Real-time ethanol content monitoring via Bluetooth. Complete kits with sensors and ECA.',
    descUk: 'Моніторинг вмісту етанолу в реальному часі через Bluetooth. Повні кіти з датчиками та ECA.',
    link: '/shop/burger/products',
    imageUrl: '/images/shop/burger/showcase-flexfuel.jpg',
  },
  {
    badge: 'Performance',
    badgeUk: 'Performance',
    name: 'Intakes & Parts',
    nameUk: 'Інтейки та деталі',
    desc: 'Cold air intakes, charge pipes, oil catch cans, and precision billet accessories.',
    descUk: 'Холодні інтейки, charge pipes, oil catch cans та точні billet аксесуари.',
    link: '/shop/burger/products',
    imageUrl: '/images/shop/burger/carbon_intake.png',
  },
];

export type BurgerBrand = {
  name: string;
  count: number;
  link: string;
};

export const BURGER_BRANDS: BurgerBrand[] = [
  { name: 'BMW', count: 330, link: '/shop/burger/products' },
  { name: 'Toyota', count: 58, link: '/shop/burger/products' },
  { name: 'Kia', count: 51, link: '/shop/burger/products' },
  { name: 'Hyundai', count: 47, link: '/shop/burger/products' },
  { name: 'VW', count: 37, link: '/shop/burger/products' },
  { name: 'Ford', count: 34, link: '/shop/burger/products' },
  { name: 'Audi', count: 30, link: '/shop/burger/products' },
  { name: 'Mini', count: 22, link: '/shop/burger/products' },
  { name: 'Infiniti', count: 19, link: '/shop/burger/products' },
  { name: 'Mercedes', count: 19, link: '/shop/burger/products' },
  { name: 'Subaru', count: 14, link: '/shop/burger/products' },
  { name: 'Chevrolet', count: 13, link: '/shop/burger/products' },
  { name: 'Porsche', count: 11, link: '/shop/burger/products' },
  { name: 'Mazda', count: 9, link: '/shop/burger/products' },
  { name: 'Nissan', count: 7, link: '/shop/burger/products' },
  { name: 'Tesla', count: 7, link: '/shop/burger/products' },
  { name: 'Lexus', count: 7, link: '/shop/burger/products' },
  { name: 'RAM', count: 6, link: '/shop/burger/products' },
];
