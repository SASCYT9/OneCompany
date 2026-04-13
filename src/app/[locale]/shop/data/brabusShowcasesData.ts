export type BrabusShowcase = {
  num: string;
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
  imageUrl: string;
  imageAlt: string;
  vimeoUrl: string;
};

/**
 * Showcases — using REAL Brabus press photos from brabus.com.
 * 
 * Image mapping from _manifest.json:
 * - Performance: BRABUS 900 6x6 Superblack Studio (70) — engine bay / powertrain
 * - Interior: BRABUS GT and GTC Bentley (1) — luxury interior Bentley
 * - Wheels/Widestar: BRABUS 900 ROCKET EDITION W465 On Location (7) — full exterior with wheels
 */
export const BRABUS_SHOWCASES: BrabusShowcase[] = [
  {
    num: '01',
    badge: 'Signature',
    badgeUk: 'Signature',
    name: 'Brabus\nPerformance',
    nameUk: 'Потужні\nМотори',
    subtitle: 'Unleash pure adrenaline. Handbuilt V8 Biturbo engines, expanded displacement, and mind-bending torque figures.',
    subtitleUk: 'Вивільніть чистий адреналін. Ексклюзивні двигуни V8 Biturbo ручної збірки, збільшений об\'єм та неймовірний крутний момент.',
    exploreLink: '/shop/brabus/products',
    shopLink: '/shop/brabus/products',
    avail: 'Available for order',
    availUk: 'Доступно для замовлення',
    /** BRABUS 900 6x6 Superblack Studio — real press photo, dark studio */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-90.jpg',
    imageAlt: 'Brabus Performance Engines',
    vimeoUrl: '',
  },
  {
    num: '02',
    badge: 'Performance',
    badgeUk: 'Performance',
    name: 'Masterpiece\nInterior',
    nameUk: 'Інтер\'єр\nMasterpiece',
    subtitle: 'Exquisite handcrafted leather, refined carbon styling, and unparalleled comfort. Designed for absolute luxury.',
    subtitleUk: 'Вишукана шкіра ручної роботи, витончений карбон та неперевершений комфорт. Створено для абсолютного рівня розкоші.',
    exploreLink: '/shop/brabus/products',
    shopLink: '/shop/brabus/products',
    avail: 'Worldwide Shipping',
    availUk: 'Доставка по всьому світу',
    /** Supercars Interieur Kopie-2 — real Brabus press photo, luxury interior */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-172.jpg',
    imageAlt: 'Brabus Masterpiece Interior',
    vimeoUrl: '',
  },
  {
    num: '03',
    badge: 'Masterpiece',
    badgeUk: 'Masterpiece',
    name: 'Wheels &\nWidestar',
    nameUk: 'Диски та\nОбвіс',
    subtitle: 'The ultimate presence. Carbon-fibre Widestar body styling perfectly matched with Monoblock forged wheels.',
    subtitleUk: 'Абсолютна домінація. Карбоновий аеродинамічний обвіс Widestar у поєднанні з ідеальними кованими дисками Monoblock.',
    exploreLink: '/shop/brabus/collections/wheels',
    shopLink: '/shop/brabus/products',
    avail: 'Bespoke Commission',
    availUk: 'Індивідуальне замовлення',
    /** G-Class Rocket Edition on-location — real press photo showing full Widestar + wheels */
    imageUrl: '/images/shop/brabus/hq/brabus-supercars-28.jpg',
    imageAlt: 'Brabus Monoblock Wheels & Widestar',
    vimeoUrl: '',
  }
];
