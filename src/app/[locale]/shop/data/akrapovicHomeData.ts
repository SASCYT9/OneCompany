/* ──────────────────────────────────────────────────
   Akrapovič Home Data  (EN / UA)
   ────────────────────────────────────────────────── */

export const AKRAPOVIC_HERO = {
  heroVideoUrl: '/videos/shop/akrapovic/akrapovic-hero.mp4',
  heroImageFallback: '/images/shop/akrapovic/hero-fallback.jpg',
  heroImageWidth: 1920,
  heroImageHeight: 1440,
  subtitle:
    'Hand-crafted titanium & carbon fibre exhaust systems that redefine automotive sound engineering.',
  subtitleUk:
    'Титанові та карбонові вихлопні системи ручної роботи, що переосмислюють звукову інженерію автомобілів.',
};

export const AKRAPOVIC_GALLERY = [
  {
    id: 'porsche-road-live',
    title: 'Porsche 911 GT3',
    titleUk: 'Porsche 911 GT3',
    eyebrow: 'Official Akrapovič road film still',
    eyebrowUk: 'Офіційний кадр Akrapovič з дороги',
    image: '/images/shop/akrapovic/gallery/live/akrapovic-porsche-road-hero-live.webp',
    width: 1280,
    height: 568,
  },
  {
    id: 'bmw-rear-live',
    title: 'BMW rear exhaust detail',
    titleUk: 'Задній ракурс BMW з вихлопом',
    eyebrow: 'Official Akrapovič social media image',
    eyebrowUk: 'Офіційне фото Akrapovič із соцмереж',
    image: '/images/shop/akrapovic/gallery/live/akrapovic-bmw-rear-live.webp',
    width: 640,
    height: 640,
  },
  {
    id: 'carbon-tailpipe-live',
    title: 'Carbon tailpipe detail',
    titleUk: 'Карбонова насадка Akrapovič',
    eyebrow: 'Official Akrapovič product media',
    eyebrowUk: 'Офіційне product-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/live/akrapovic-carbon-tailpipe-live.webp',
    width: 640,
    height: 640,
  },
  {
    id: 'glowing-tailpipe-live',
    title: 'Akrapovič glowing tailpipe detail',
    titleUk: 'Живий кадр насадки Akrapovič',
    eyebrow: 'Official Akrapovič multimedia image',
    eyebrowUk: 'Офіційне multimedia-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/live/akrapovic-glowing-tailpipe-live.webp',
    width: 1500,
    height: 951,
  },
  {
    id: 'rs6-tailpipe-live',
    title: 'Audi RS 6 tailpipe detail',
    titleUk: 'Насадка Audi RS 6',
    eyebrow: 'Official Akrapovič product media',
    eyebrowUk: 'Офіційне product-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/live/akrapovic-rs6-tailpipe-live.webp',
    width: 1400,
    height: 934,
  },
  {
    id: 'm8-tailpipe-wide-live',
    title: 'BMW M8 tailpipe detail',
    titleUk: 'Насадки BMW M8',
    eyebrow: 'Official Akrapovič product media',
    eyebrowUk: 'Офіційне product-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/live/akrapovic-m8-tailpipe-wide-live.webp',
    width: 1400,
    height: 580,
  },
] as const;

export type ProductLine = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  badge: string;
  badgeUk: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
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
    imageWidth: 1920,
    imageHeight: 1440,
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
    imageWidth: 1920,
    imageHeight: 1440,
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
    image: '/images/shop/akrapovic/line-link-pipe-official.png',
    imageWidth: 1920,
    imageHeight: 1440,
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
    image: '/images/shop/akrapovic/line-downpipe-official.png',
    imageWidth: 1920,
    imageHeight: 1440,
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
    image: '/images/shop/akrapovic/line-sound-kit-official.png',
    imageWidth: 1075,
    imageHeight: 675,
    link: '/shop/akrapovic/collections',
  },
];

export const AKRAPOVIC_HERITAGE = {
  videoUrl: '/videos/shop/akrapovic/akrapovic-factory.mp4',
  fallbackImage: '/images/shop/akrapovic/factory-fallback.jpg',
  fallbackWidth: 1920,
  fallbackHeight: 1458,
  title: 'Born in Slovenia',
  titleUk: 'Народжено в Словенії',
  description:
    'Since 1990, every Akrapovič exhaust has been designed, tested, and hand-assembled in Ivančna Gorica. From MotoGP to road cars — 30+ years of relentless pursuit of the perfect exhaust note. Over 600 engineers and craftsmen work under one roof, combining cutting-edge CFD simulation with old-world hand-welding artistry.',
  descriptionUk:
    'З 1990 року кожна вихлопна система Akrapovič розроблена, протестована та зібрана вручну в Іванчна Горіці. Від MotoGP до дорожніх авто — 30+ років невпинного прагнення до ідеальної ноти вихлопу. Понад 600 інженерів і майстрів працюють під одним дахом, поєднуючи найсучасніші CFD-симуляції з ремісничою технікою ручного зварювання.',
};
