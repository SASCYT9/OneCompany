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
    /** Carbon Engine Bay Masterpiece */
    imageUrl: '/images/shop/brabus/hq/brabus_carbon_engine.png',
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
    /** Stealth Quilted Leather Interior */
    imageUrl: '/images/shop/brabus/hq/brabus_stealth_interior.png',
    imageAlt: 'Brabus Masterpiece Interior',
    vimeoUrl: '',
  },
  {
    num: '03',
    badge: 'Masterpiece',
    badgeUk: 'Masterpiece',
    name: 'Wheels &\nWidetrack',
    nameUk: 'Диски та\nОбвіс',
    subtitle: 'The ultimate presence. Carbon-fibre Widetrack body styling perfectly matched with Monoblock forged wheels.',
    subtitleUk: 'Абсолютна домінація. Карбоновий аеродинамічний обвіс Widetrack у поєднанні з ідеальними кованими дисками Monoblock.',
    exploreLink: '/shop/brabus/products',
    shopLink: '/shop/brabus/products',
    avail: 'Bespoke Commission',
    availUk: 'Індивідуальне замовлення',
    /** Stealth Black Masterpiece Studio Render (Replaced scary red) */
    imageUrl: '/images/shop/brabus/hq/brabus_stealth_masterpiece.png',
    imageAlt: 'Brabus Monoblock Wheels & Widetrack',
    vimeoUrl: '',
  }
];
