export type BrabusCollectionCard = {
  title: string;
  brand: string;
  collectionHandle: string;
  productCount?: string;
  externalImageUrl: string;
};

export const BRABUS_COLLECTIONS_GRID_SETTINGS = {
  eyebrow: 'Brabus',
  heading: 'Our Range',
  subheading:
    'High-performance tuning, aerodynamic enhancement kits, and bespoke supercar engineering.',
  subheadingUk:
    'Високопродуктивний тюнінг, аеродинамічні комплекти та ексклюзивна інженерія суперкарів.',
  /** Rocket 900 Full Side Profile Exterior */
  heroImage: '/images/shop/brabus/hq/brabus-supercars-18.jpg',
  showFilters: true,
} as const;

export const BRABUS_COLLECTION_CARDS: BrabusCollectionCard[] = [
  {
    title: 'G-Class Tuning',
    brand: 'Mercedes-Benz',
    collectionHandle: 'g-class',
    productCount: 'Premium Aero',
    /** Headlight detail G-Class */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-24.jpg',
  },
  {
    title: 'S-Class Executive',
    brand: 'Mercedes-Benz',
    collectionHandle: 's-class',
    productCount: 'Luxury Upgrade',
    /** 930 S-Class dark studio top down */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-41.jpg',
  },
  {
    title: 'Supercar Programme',
    brand: 'Porsche',
    collectionHandle: 'porsche',
    productCount: 'Track Focused',
    /** 930 S-Class white studio */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-39.jpg',
  },
  {
    title: 'Brabus Supercars',
    brand: 'Rolls-Royce',
    collectionHandle: 'rolls-royce',
    productCount: 'Bespoke',
    /** Copper Bentley front exterior */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-45.jpg',
  },
  {
    title: 'Forged Wheels',
    brand: 'Monoblock',
    collectionHandle: 'wheels',
    productCount: 'High-Tech',
    /** G-Class dark studio exterior 31.jpg */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-31.jpg',
  }
];

export const BRABUS_COLLECTION_BRANDS = [
  'Mercedes-Benz', 'Porsche', 'Rolls-Royce', 'Monoblock'
] as const;
