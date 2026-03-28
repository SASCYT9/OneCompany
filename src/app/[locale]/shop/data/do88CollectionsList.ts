/**
 * DO88 collections list — mimics Urban Automotive style.
 * Categorizes DO88 performance cooling products.
 */

export type Do88CollectionCard = {
  title: string;
  titleUk?: string;
  categoryHandle: string;
  externalImageUrl: string;
};

export const DO88_COLLECTIONS_GRID_SETTINGS = {
  eyebrow: 'DO88 Performance',
  eyebrowUk: 'DO88 Performance',
  heading: 'Our Cooling Categories',
  headingUk: 'Наші Категорії Охолодження',
  subheading: 'Premium Swedish cooling systems, intercoolers, and silicone hoses. Engineered for maximum performance.',
  subheadingUk: 'Преміальні шведські системи охолодження, інтеркулери та силіконові патрубки. Створено для максимальної продуктивності.',
  heroImage: '/branding/do88/do88_car_hero_mclaren_1774441012700.png',
  showFilters: true,
} as const;

export const DO88_COLLECTION_CARDS: Do88CollectionCard[] = [
  { title: 'Intercoolers', titleUk: 'Інтеркулери', categoryHandle: 'intercoolers', externalImageUrl: '/branding/do88/do88_bw_turbo_1774443681860.png' },
  { title: 'Radiators', titleUk: 'Радіатори', categoryHandle: 'radiators', externalImageUrl: '/branding/do88/do88_bw_engine_bay_1774443712195.png' },
  { title: 'Intake Systems', titleUk: 'Системи впуску', categoryHandle: 'intake-systems', externalImageUrl: '/branding/do88/do88_bw_mclaren_1774443659890.png' },
  { title: 'Performance Hoses', titleUk: 'Патрубки', categoryHandle: 'performance-hoses', externalImageUrl: '/branding/do88/do88_bw_amg_1774443742481.png' },
  { title: 'Oil Coolers', titleUk: 'Масляні радіатори', categoryHandle: 'oil-coolers', externalImageUrl: '/branding/do88/do88_bw_audi_r8_1774443769582.png' },
  { title: 'Y-Pipes & Plenums', titleUk: 'Y-Пайпи та Пленуми', categoryHandle: 'y-pipes-plenums', externalImageUrl: '/branding/do88/do88_bw_porsche_hero_1774443620183.png' },
  { title: 'Carbon Fiber', titleUk: 'Карбонові деталі', categoryHandle: 'carbon-fiber', externalImageUrl: '/branding/do88/do88_bw_carbon_1774443870864.png' },
  { title: 'Fans & Accessories', titleUk: 'Вентилятори та аксесуари', categoryHandle: 'cooling-accessories', externalImageUrl: '/branding/do88/do88_bw_m4_drift_1774443792137.png' },
];
