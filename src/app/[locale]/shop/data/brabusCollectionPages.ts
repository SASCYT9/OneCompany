/**
 * Brabus Collection Page Configs
 * Each collection (G-Class, S-Class, Porsche, etc.) gets a cinematic hero
 * banner with unique HQ photo, description, and product count badge.
 */

export type BrabusCollectionPageConfig = {
  handle: string;
  title: string;
  titleUk: string;
  subtitle: string;
  subtitleUk: string;
  description: string;
  descriptionUk: string;
  heroImage: string;
  accentColor?: string;
  specs?: { val: string; label: string; labelUk: string }[];
};

export const BRABUS_COLLECTION_PAGES: Record<string, BrabusCollectionPageConfig> = {
  'g-class': {
    handle: 'g-class',
    title: 'G-Class Programme',
    titleUk: 'Програма G-Class',
    subtitle: 'Mercedes-Benz G-Wagon by BRABUS',
    subtitleUk: 'Mercedes-Benz G-Wagon від BRABUS',
    description: 'The ultimate expression of off-road luxury. BRABUS G-Class programmes transform the legendary Mercedes-Benz G-Wagon into an uncompromising blend of performance and presence.',
    descriptionUk: 'Ультимативне втілення позашляхового люксу. Програми BRABUS G-Class перетворюють легендарний Mercedes-Benz G-Wagon на безкомпромісне поєднання потужності та присутності.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-179.jpg',
    specs: [
      { val: '900', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1250', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '3.7', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  's-class': {
    handle: 's-class',
    title: 'S-Class Programme',
    titleUk: 'Програма S-Class',
    subtitle: 'Mercedes-Benz S-Class by BRABUS',
    subtitleUk: 'Mercedes-Benz S-Class від BRABUS',
    description: 'Executive refinement meets explosive performance. The BRABUS S-Class programme elevates the world\'s most advanced luxury sedan with bespoke aerodynamics and power upgrades.',
    descriptionUk: 'Виконавська вишуканість зустрічається з вибуховою потужністю. Програма BRABUS S-Class підіймає найдосконаліший люксовий седан світу на новий рівень.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-180.jpg',
    specs: [
      { val: '930', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1550', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '3.3', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'porsche': {
    handle: 'porsche',
    title: 'Supercar Programme',
    titleUk: 'Програма Суперкарів',
    subtitle: 'Porsche & Lamborghini by BRABUS',
    subtitleUk: 'Porsche & Lamborghini від BRABUS',
    description: 'BRABUS performance engineering applied to the world\'s most iconic sports cars. Each upgrade is precision-engineered to extract maximum potential.',
    descriptionUk: 'Інженерія продуктивності BRABUS для найкультовіших спортивних автомобілів світу. Кожне оновлення розроблено для максимального потенціалу.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-16.jpg',
    specs: [
      { val: '900', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1000', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '2.8', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'rolls-royce': {
    handle: 'rolls-royce',
    title: 'Rolls-Royce & Bentley',
    titleUk: 'Rolls-Royce & Bentley',
    subtitle: 'Ultra-Luxury by BRABUS',
    subtitleUk: 'Ультра-Люкс від BRABUS',
    description: 'Where understated elegance meets audacious power. BRABUS transforms Britain\'s finest with bespoke interiors, refined aerodynamics, and substantial performance gains.',
    descriptionUk: 'Де стримувана елегантність зустрічається зі сміливою потужністю. BRABUS трансформує найкраще з Британії.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-39.jpg',
    specs: [
      { val: '820', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1100', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '3.6', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'wheels': {
    handle: 'wheels',
    title: 'Forged Wheels',
    titleUk: 'Ковані Диски',
    subtitle: 'Monoblock by BRABUS',
    subtitleUk: 'Monoblock від BRABUS',
    description: 'Precision-forged excellence. BRABUS Monoblock wheels are CNC-machined from aerospace-grade aluminum, combining extreme lightweight performance with unmistakable visual presence.',
    descriptionUk: 'Точне кування досконалості. Диски BRABUS Monoblock виготовлені на ЧПУ з аерокосмічного алюмінію, поєднуючи екстремальну легкість із безпомилковою візуальною присутністю.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-175.jpg',
  },
};

export function getBrabusCollectionPageConfig(handle: string): BrabusCollectionPageConfig | null {
  return BRABUS_COLLECTION_PAGES[handle] || null;
}
