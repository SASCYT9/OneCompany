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
  heroImage: '/branding/do88/do88_car_hero_porsche_front_1774441447168.png',
  showFilters: true,
} as const;

export const DO88_COLLECTION_CARDS: Do88CollectionCard[] = [
  { title: 'Intercoolers', titleUk: 'Інтеркулери', categoryHandle: 'intercoolers', externalImageUrl: '/branding/do88/do88_intercooler_real.png' },
  { title: 'Radiators', titleUk: 'Радіатори', categoryHandle: 'radiators', externalImageUrl: '/branding/do88/do88_radiator_real.png' },
  { title: 'Intake Systems', titleUk: 'Системи впуску', categoryHandle: 'intake-systems', externalImageUrl: '/branding/do88/do88_intake_real.png' },
  { title: 'Performance Hoses', titleUk: 'Патрубки', categoryHandle: 'performance-hoses', externalImageUrl: '/branding/do88/do88_hoses_real.png' },
  { title: 'Oil Coolers', titleUk: 'Масляні радіатори', categoryHandle: 'oil-coolers', externalImageUrl: '/branding/do88/do88_oil_cooler_real.png' },
  { title: 'Y-Pipes & Plenums', titleUk: 'Y-Пайпи та Пленуми', categoryHandle: 'y-pipes-plenums', externalImageUrl: '/branding/do88/do88_y_pipe_real.png' },
  { title: 'Carbon Fiber', titleUk: 'Карбонові деталі', categoryHandle: 'carbon-fiber', externalImageUrl: '/branding/do88/do88_carbon_real.png' },
  { title: 'Fans & Accessories', titleUk: 'Вентилятори та аксесуари', categoryHandle: 'cooling-accessories', externalImageUrl: '/branding/do88/do88_fan_real.png' },
];
