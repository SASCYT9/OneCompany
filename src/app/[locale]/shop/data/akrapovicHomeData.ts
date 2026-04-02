/* ──────────────────────────────────────────────────
   Akrapovič Home Data  (EN / UA)
   ────────────────────────────────────────────────── */

export const AKRAPOVIC_HERO = {
  heroVideoUrl: '/videos/shop/akrapovic/akrapovic-hero.mp4',
  heroImageFallback: '/images/shop/akrapovic/hero-fallback.jpg',
  subtitle:
    'Hand-crafted titanium & carbon fibre exhaust systems that redefine automotive sound engineering.',
  subtitleUk:
    'Титанові та карбонові вихлопні системи ручної роботи, що переосмислюють звукову інженерію автомобілів.',
};

export const AKRAPOVIC_STATS = [
  { val: '1990', en: 'Founded', ua: 'Засновано' },
  { val: '−40%', en: 'Weight Reduction', ua: 'Зменшення ваги' },
  { val: '+12', en: 'HP Gain (avg)', ua: 'К.С. приріст (сер.)' },
  { val: '600°', en: 'Operating Temp', ua: 'Робоча темп.' },
];

export const AKRAPOVIC_MATERIALS = {
  titanium: {
    title: 'Titanium',
    titleUk: 'Титан',
    description:
      'Grade 1 titanium alloy — the same material used in aerospace and Formula 1. 40% lighter than stainless steel with superior heat resistance up to 600°C. Each weld is hand-finished by Akrapovič craftsmen in Ivančna Gorica, Slovenia.',
    descriptionUk:
      'Титановий сплав Grade 1 — той самий матеріал, що використовується в аерокосмічній галузі та Формулі 1. На 40% легший за нержавіючу сталь із вищою термостійкістю до 600°C. Кожен зварний шов виконується вручну майстрами Akrapovič в Іванчна Горіці, Словенія.',
    image: '/images/shop/akrapovic/titanium-closeup.jpg',
  },
  carbon: {
    title: 'Carbon Fibre',
    titleUk: 'Карбонове волокно',
    description:
      'Dry carbon fibre end caps and heat shields — produced in-house with autoclave curing for maximum structural rigidity. UV-stable clear coat protects the distinctive weave pattern for years of use without yellowing.',
    descriptionUk:
      'Торцеві насадки та теплові екрани з сухого карбону — виготовлені на власному виробництві з автоклавним затвердінням для максимальної структурної жорсткості. UV-стійке прозоре покриття захищає фактуру плетіння роками без пожовтіння.',
    image: '/images/shop/akrapovic/carbon-closeup.jpg',
  },
};

export type ProductLine = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  badge: string;
  badgeUk: string;
  image: string;
  videoUrl?: string;
  link: string;
};

export const AKRAPOVIC_PRODUCT_LINES: ProductLine[] = [
  {
    id: 'evolution',
    name: 'Evolution Line',
    nameUk: 'Лінійка Evolution',
    description: 'Full titanium systems. Maximum weight savings and performance gain. The pinnacle of exhaust engineering.',
    descriptionUk: 'Повністю титанові системи. Максимальне зменшення ваги та приріст потужності. Вершина вихлопної інженерії.',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    image: '/images/shop/akrapovic/line-evolution.jpg',
    link: '/shop/akrapovic/collections',
  },
  {
    id: 'slip-on',
    name: 'Slip-On Line',
    nameUk: 'Лінійка Slip-On',
    description: 'Bolt-on titanium mufflers with carbon end caps. Perfect balance of sound, weight, and ease of installation.',
    descriptionUk: 'Титанові глушники з карбоновими насадками. Ідеальний баланс звуку, ваги та легкості встановлення.',
    badge: 'Best Seller',
    badgeUk: 'Найпопулярніший',
    image: '/images/shop/akrapovic/line-slip-on.jpg',
    link: '/shop/akrapovic/collections',
  },
  {
    id: 'link-pipe',
    name: 'Link Pipe Set',
    nameUk: 'Link Pipe Set',
    description: 'Connecting pipes that complete the system. Remove factory catalysts for track-only use.',
    descriptionUk: 'Зєднувальні труби для завершення системи. Видалення заводських каталізаторів для використання на трасі.',
    badge: 'Track',
    badgeUk: 'Трек',
    image: '/images/shop/akrapovic/line-link-pipe.jpg',
    link: '/shop/akrapovic/collections',
  },
  {
    id: 'downpipe',
    name: 'Downpipe',
    nameUk: 'Даунпайп',
    description: 'High-flow downpipes with sport catalysts. Unlock turbo potential while maintaining street compliance.',
    descriptionUk: 'Даунпайпи підвищеної пропускності зі спортивними каталізаторами. Розкриваємо потенціал турбіни зі збереженням відповідності нормам.',
    badge: 'Power',
    badgeUk: 'Потужність',
    image: '/images/shop/akrapovic/line-downpipe.jpg',
    link: '/shop/akrapovic/collections',
  },
  {
    id: 'optional',
    name: 'Optional Parts',
    nameUk: 'Аксесуари',
    description: 'Carbon tail pipe tips, sound kits, and mounting hardware. Personalise your system.',
    descriptionUk: 'Карбонові насадки, саунд-кіти та монтажне обладнання. Персоналізуйте вашу систему.',
    badge: 'Accessories',
    badgeUk: 'Аксесуари',
    image: '/images/shop/akrapovic/line-optional.jpg',
    link: '/shop/akrapovic/collections',
  },
];

export const AKRAPOVIC_HERITAGE = {
  videoUrl: '/videos/shop/akrapovic/akrapovic-factory.mp4',
  fallbackImage: '/images/shop/akrapovic/factory-fallback.jpg',
  title: 'Born in Slovenia',
  titleUk: 'Народжено в Словенії',
  description:
    'Since 1990, every Akrapovič exhaust has been designed, tested, and hand-assembled in Ivančna Gorica. From MotoGP to road cars — 30+ years of relentless pursuit of the perfect exhaust note. Over 600 engineers and craftsmen work under one roof, combining cutting-edge CFD simulation with old-world hand-welding artistry.',
  descriptionUk:
    'З 1990 року кожна вихлопна система Akrapovič розроблена, протестована та зібрана вручну в Іванчна Горіці. Від MotoGP до дорожніх авто — 30+ років невпинного прагнення до ідеальної ноти вихлопу. Понад 600 інженерів і майстрів працюють під одним дахом, поєднуючи найсучасніші CFD-симуляції з ремісничою технікою ручного зварювання.',
};
