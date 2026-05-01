/**
 * Brabus Collection Page Configs
 * Each collection (G-Class, S-Class, Porsche, etc.) gets a cinematic hero
 * banner with unique HQ photo, description, and product count badge.
 * 
 * All images are REAL Brabus press photos from brabus.com.
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
    heroImage: '/images/shop/brabus/hq/brabus-supercars-31.jpg',
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
    heroImage: '/images/shop/brabus/hq/brabus-s63-hero.jpg',
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
    subtitle: 'Porsche by BRABUS',
    subtitleUk: 'Porsche від BRABUS',
    description: 'BRABUS performance engineering applied to the world\'s most iconic sports cars. Each upgrade is precision-engineered to extract maximum potential.',
    descriptionUk: 'Інженерія продуктивності BRABUS для найкультовіших спортивних автомобілів світу. Кожне оновлення розроблено для максимального потенціалу.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-84.jpg',
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
  'bentley': {
    handle: 'bentley',
    title: 'Bentley Continental GT',
    titleUk: 'Bentley Continental GT',
    subtitle: 'BRABUS 900 Superblack',
    subtitleUk: 'BRABUS 900 Superblack',
    description: 'British craftsmanship reengineered for performance. The BRABUS 900 Superblack programme transforms the Continental GT with hand-laid carbon aerodynamics, forged Monoblock wheels, and a 900 HP twin-turbo W12 upgrade.',
    descriptionUk: 'Британська майстерність, перетворена на чисту потужність. Програма BRABUS 900 Superblack трансформує Continental GT карбоновою аеродинамікою ручної роботи, кованими Monoblock дисками та форсуванням W12 до 900 к.с.',
    heroImage: '/images/shop/brabus/hq/brabus-bentley-gt-black.jpg',
    specs: [
      { val: '900', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1250', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '3.1', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'lamborghini': {
    handle: 'lamborghini',
    title: 'Lamborghini Urus SE',
    titleUk: 'Lamborghini Urus SE',
    subtitle: 'BRABUS 900 Superblack',
    subtitleUk: 'BRABUS 900 Superblack',
    description: 'The definitive super-SUV elevated to its absolute limits. BRABUS engineering delivers 900 horsepower, bespoke carbon aerodynamics, and a presence that commands every road.',
    descriptionUk: 'Неперевершений супер-SUV, доведений до абсолютних меж. Інженерія BRABUS забезпечує 900 к.с., карбоновий аеродинамічний пакет та домінуючу присутність.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-76.jpg',
    specs: [
      { val: '900', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1050', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '3.2', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'range-rover': {
    handle: 'range-rover',
    title: 'Range Rover 600',
    titleUk: 'Range Rover 600',
    subtitle: 'Range Rover L460 Tuning',
    subtitleUk: 'Тюнінг Range Rover L460',
    description: 'Refined power meets British elegance. The BRABUS Range Rover programme delivers substantial performance upgrades, bespoke interior craftsmanship, and distinctive aerodynamic styling.',
    descriptionUk: 'Витончена потужність зустрічає британську елегантність. Програма BRABUS Range Rover забезпечує значне збільшення потужності, ексклюзивний інтер\'єр та виразний аеродинамічний стиль.',
    heroImage: '/images/shop/brabus/hq/brabus-rangerover-l460-real.jpg',
    specs: [
      { val: '600', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '820', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '4.4', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'gle-gls': {
    handle: 'gle-gls',
    title: 'GLE & GLS Programme',
    titleUk: 'Програма GLE & GLS',
    subtitle: 'Mercedes-Benz GLE / GLS by BRABUS',
    subtitleUk: 'Mercedes-Benz GLE / GLS від BRABUS',
    description: 'Premium SUV performance redefined. BRABUS GLE and GLS programmes deliver enhanced engine output, refined aerodynamics, and exclusive interior upgrades for the most demanding drivers.',
    descriptionUk: 'Продуктивність преміальних SUV на новому рівні. Програми BRABUS GLE та GLS забезпечують збільшену потужність, удосконалену аеродинаміку та ексклюзивні оновлення інтер\'єру.',
    heroImage: '/images/shop/brabus/hq/brabus-supercars-104.jpg',
    specs: [
      { val: '900', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1050', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '3.8', label: 'sec 0-100', labelUk: 'сек 0-100' },
    ],
  },
  'amg-gt': {
    handle: 'amg-gt',
    title: 'AMG GT Programme',
    titleUk: 'Програма AMG GT',
    subtitle: 'Mercedes-AMG GT by BRABUS',
    subtitleUk: 'Mercedes-AMG GT від BRABUS',
    description: 'Track-bred performance taken to the extreme. The BRABUS AMG GT programme delivers enhanced engine output, carbon aerodynamics, and competition-spec handling upgrades.',
    descriptionUk: 'Гоночна продуктивність, доведена до екстрему. Програма BRABUS AMG GT забезпечує збільшену потужність двигуна, карбонову аеродинаміку та спортивне шасі.',
    heroImage: '/images/shop/brabus/hq/brabus-amggt-hero.jpg',
    specs: [
      { val: '900', label: 'Max HP', labelUk: 'Макс. к.с.' },
      { val: '1050', label: 'Nm Torque', labelUk: 'Нм крутний' },
      { val: '2.8', label: 'sec 0-100', labelUk: 'сек 0-100' },
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
    heroImage: '/images/shop/brabus/hq/brabus-wheels-monoz.jpg',
  },
};

export function getBrabusCollectionPageConfig(handle: string): BrabusCollectionPageConfig | null {
  return BRABUS_COLLECTION_PAGES[handle] || null;
}
