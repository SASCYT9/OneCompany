export type BrabusCollectionCard = {
  title: string;
  titleUk?: string;
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

/**
 * Collection cards — all images are REAL Brabus press photos from brabus.com.
 * 
 * Image mapping from _manifest.json:
 *  - G-Class:      22 (BRABUS 900 ROCKET EDITION W465 On Location front)
 *  - S-Class:      180 (BRABUS S-Class studio - HQ official)
 *  - Porsche:      84 (BRABUS ROCKET R Studio side profile)
 *  - Rolls-Royce:  45 (Bentley GTC exterior portrait)
 *  - Lamborghini:  18 (BRABUS 900 Lambo Urus wide exterior 1920x1280)
 *  - Range Rover:  148 (BRABUS RANGE ROVER 600 Studio)
 *  - GLE/GLS:      104 (BRABUS GLS 900 Superblack Studio)
 *  - AMG GT:       80 (Supercars Teaser BRABUS 900 Superblack GT)
 *  - Wheels:       31 (G-Class side showing Monoblock wheels)
 */
export const BRABUS_COLLECTION_CARDS: BrabusCollectionCard[] = [
  {
    title: 'G-Class Tuning',
    titleUk: 'Тюнінг G-Class',
    brand: 'Mercedes-Benz',
    collectionHandle: 'g-class',
    productCount: 'Premium Aero',
    /** Rocket Edition W465 on-location - real press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-22.jpg',
  },
  {
    title: 'S-Class Executive',
    titleUk: 'S-Class Executive',
    brand: 'Mercedes-Benz',
    collectionHandle: 's-class',
    productCount: 'Luxury Upgrade',
    /** S-Class studio - real Brabus HQ official */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-180.jpg',
  },
  {
    title: 'Supercar Programme',
    titleUk: 'Суперкар Програма',
    brand: 'Porsche',
    collectionHandle: 'porsche',
    productCount: 'Track Focused',
    /** BRABUS ROCKET R Studio side - real press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-84.jpg',
  },
  {
    title: 'Rolls-Royce & Bentley',
    titleUk: 'Rolls-Royce & Bentley',
    brand: 'Rolls-Royce',
    collectionHandle: 'rolls-royce',
    productCount: 'Bespoke',
    /** Bentley GTC exterior portrait — real press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-45.jpg',
  },
  {
    title: 'Lamborghini Urus SE',
    titleUk: 'Lamborghini Urus SE',
    brand: 'Lamborghini',
    collectionHandle: 'lamborghini',
    productCount: '900 HP',
    /** BRABUS 900 Lambo Urus wide - real on-location press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-18.jpg',
  },
  {
    title: 'Range Rover 600',
    titleUk: 'Range Rover 600',
    brand: 'Range Rover',
    collectionHandle: 'range-rover',
    productCount: 'Signature',
    /** BRABUS Range Rover 600 Studio - real press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-148.jpg',
  },
  {
    title: 'GLE & GLS',
    titleUk: 'GLE & GLS',
    brand: 'Mercedes-Benz',
    collectionHandle: 'gle-gls',
    productCount: 'SUV Power',
    /** BRABUS GLS 900 Superblack Studio - real press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-104.jpg',
  },
  {
    title: 'AMG GT',
    titleUk: 'AMG GT',
    brand: 'Mercedes-Benz',
    collectionHandle: 'amg-gt',
    productCount: 'Supercar',
    /** BRABUS 900 Superblack GT — real press photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-80.jpg',
  },
  {
    title: 'Forged Wheels',
    titleUk: 'Ковані Диски',
    brand: 'Monoblock',
    collectionHandle: 'wheels',
    productCount: 'High-Tech',
    /** G-Class side showing Monoblock wheels - real Brabus photo */
    externalImageUrl: '/images/shop/brabus/hq/brabus-supercars-31.jpg',
  }
];

export const BRABUS_COLLECTION_BRANDS = [
  'Mercedes-Benz', 'Porsche', 'Rolls-Royce', 'Lamborghini', 'Range Rover', 'Monoblock'
] as const;
