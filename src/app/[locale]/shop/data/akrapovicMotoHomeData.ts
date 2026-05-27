/* ──────────────────────────────────────────────────
   Akrapovič Moto Home Data (EN / UA)
   ────────────────────────────────────────────────── */

import type { ProductLine } from './akrapovicHomeData';

export const AKRAPOVIC_MOTO_HERO = {
  heroVideoUrl: '/videos/shop/akrapovic/akrapovic-cover.mp4',
  heroImageFallback: '/images/shop/akrapovic/ducati-panigale-v2.webp',
  heroImageWidth: 1200,
  heroImageHeight: 800,
  subtitle:
    'Championship-winning titanium & carbon fibre exhaust systems built for MotoGP paddocks and the ultimate road superbikes.',
  subtitleUk:
    'Титанові та карбонові вихлопні системи для MotoGP та цивільних супербайків, створені для максимальних швидкостей.',
};

export const AKRAPOVIC_MOTO_GALLERY = [
  {
    id: 'ducati-v2-installed',
    title: 'Ducati Panigale V2 S',
    titleUk: 'Ducati Panigale V2 S',
    eyebrow: 'Official Akrapovič road film still',
    eyebrowUk: 'Офіційний кадр Akrapovič з дороги',
    image: '/images/shop/akrapovic/gallery/moto/ducati-v2-live.webp',
    width: 1200,
    height: 800,
  },
  {
    id: 'bmw-s1000rr-installed',
    title: 'BMW S 1000 RR',
    titleUk: 'BMW S 1000 RR',
    eyebrow: 'Official Akrapovič social media image',
    eyebrowUk: 'Офіційне фото Akrapovič із соцмереж',
    image: '/images/shop/akrapovic/gallery/moto/bmw-s1000rr-live.webp',
    width: 1200,
    height: 800,
  },
  {
    id: 'yamaha-r1-installed',
    title: 'Yamaha YZF-R1',
    titleUk: 'Yamaha YZF-R1',
    eyebrow: 'Official Akrapovič product media',
    eyebrowUk: 'Офіційне product-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/moto/yamaha-r1-live.webp',
    width: 1200,
    height: 800,
  },
  {
    id: 'ducati-v2-closeup',
    title: 'Ducati Panigale V2 Exhaust Detail',
    titleUk: 'Вихлоп Ducati Panigale V2 зблизька',
    eyebrow: 'Official Akrapovič multimedia image',
    eyebrowUk: 'Офіційне multimedia-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/moto/exhaust-closeup-live.webp',
    width: 1200,
    height: 800,
  },
  {
    id: 'bmw-r1300gs-installed',
    title: 'BMW R 1300 GS',
    titleUk: 'BMW R 1300 GS',
    eyebrow: 'Official Akrapovič product media',
    eyebrowUk: 'Офіційне product-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/moto/bmw-gs-live.webp',
    width: 1200,
    height: 800,
  },
  {
    id: 'kawasaki-zx10r-installed',
    title: 'Kawasaki Ninja ZX-10R',
    titleUk: 'Kawasaki Ninja ZX-10R',
    eyebrow: 'Official Akrapovič product media',
    eyebrowUk: 'Офіційне product-медіа Akrapovič',
    image: '/images/shop/akrapovic/gallery/moto/kawasaki-zx10r-live.webp',
    width: 1200,
    height: 800,
  },
] as const;

export const AKRAPOVIC_MOTO_PRODUCT_LINES: ProductLine[] = [
  {
    id: 'evolution',
    name: 'Evolution Line',
    nameUk: 'Лінійка Evolution',
    description: 'Full titanium flagship exhaust systems featuring complex hand-welded manifolds. Maximum horsepower gain, massive weight reduction.',
    descriptionUk: 'Флагманські титанові системи з ручним аргоновим зварюванням. Максимальний приріст сил, радикальне зниження ваги.',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    image: '/images/shop/akrapovic/line-evolution-moto.webp',
    imageWidth: 1200,
    imageHeight: 800,
    link: '/shop/akrapovic/collections?line=evolution',
  },
  {
    id: 'racing',
    name: 'Racing Line',
    nameUk: 'Лінійка Racing',
    description: 'High-performance stainless steel exhaust manifolds with carbon or titanium mufflers. A perfect alternative offering excellent power gains.',
    descriptionUk: 'Високопродуктивні колектори з нержавіючої сталі з титановим або карбоновим глушником. Чудове співвідношення ціни та приросту потужності.',
    badge: 'Race',
    badgeUk: 'Трек',
    image: '/images/shop/akrapovic/line-racing-moto.webp',
    imageWidth: 1200,
    imageHeight: 800,
    link: '/shop/akrapovic/collections?line=racing',
  },
  {
    id: 'slip-on',
    name: 'Slip-On Line',
    nameUk: 'Лінійка Slip-On',
    description: 'Bolt-on titanium mufflers with carbon fiber shields. Fully street-legal and EC/ECE approved. Instantly improves sound and aesthetics.',
    descriptionUk: 'Титанові глушники з карбоновими екранами. Повна сертифікація EC/ECE для доріг загального користування. Миттєво покращує звук.',
    badge: 'Best Seller',
    badgeUk: 'Популярно',
    image: '/images/shop/akrapovic/line-slipon-moto.webp',
    imageWidth: 1200,
    imageHeight: 800,
    link: '/shop/akrapovic/collections?line=slip-on',
  },
  {
    id: 'optional',
    name: 'Optional Parts',
    nameUk: 'Аксесуари',
    description: 'Carbon fiber heat shields, exhaust hangers, and titanium link pipes. Personalize your setup and complete the racing look.',
    descriptionUk: 'Карбонові термозахисні екрани, кронштейни глушників та титанові з\'єднувальні труби. Персоналізуйте свою систему.',
    badge: 'Accessories',
    badgeUk: 'Аксесуари',
    image: '/images/shop/akrapovic/line-optional-moto.webp',
    imageWidth: 1200,
    imageHeight: 800,
    link: '/shop/akrapovic/collections?line=accessories',
  },
];

export const AKRAPOVIC_MOTO_HERITAGE = {
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
