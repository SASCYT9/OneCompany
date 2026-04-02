export const IPE_HERO = {
  heroVideoUrl: '', // Fallback to image
  heroImageFallback: '/images/shop/ipe/ipe-hero.png',
  subtitle: 'Hand-crafted titanium and stainless steel exhaust systems engineered for supercar performance.',
  subtitleUk: "Вихлопні системи ручної роботи з титану та нержавіючої сталі, розроблені для суперкарів.",
};

export const IPE_STATS = [
  { value: '+12%', label: 'HP Gain', labelUk: 'Приріст Потужності' },
  { value: '−45%', label: 'Weight Reduction', labelUk: 'Зменшення Ваги' },
  { value: '110dB', label: 'Maximum Volume', labelUk: 'Максимальна Гучність' },
  { value: '100%', label: 'Valvetronic', labelUk: 'Технологія Valvetronic' },
];

export const IPE_HIGHLIGHTS = [
  {
    image: '/images/shop/ipe/ipe-valvetronic.png',
    title: 'F1 Sound',
    titleUk: 'Звучання F1',
    description: 'Extremely high-pitched, clean exhaust notes achieved through precise engineering.',
    descriptionUk: 'Екстремально високі, чисті ноти вихлопу завдяки інженерній точності.',
  },
  {
    image: '/images/shop/ipe/ipe-porsche.png',
    title: 'Valvetronic Control',
    titleUk: 'Технологія Valvetronic',
    description: 'Switch between stealth mode and full aggressive exhaust note at the touch of a button.',
    descriptionUk: 'Перемикання між тихим режимом та максимальною агресією одним натисканням.',
  },
  {
    image: '/images/shop/ipe/ipe-hero.png',
    title: 'Titanium Grade',
    titleUk: 'Висококласний Титан',
    description: 'Lightweight and durable materials ensuring maximum heat dissipation and weight reduction.',
    descriptionUk: 'Легкі та міцні матеріали, що забезпечують максимальне розсіювання тепла.',
  },
];

export const IPE_PRODUCT_LINES = [
  {
    id: 'porsche',
    name: 'Porsche',
    image: '/images/shop/ipe/ipe-porsche.png',
    href: '/shop/ipe/collections/porsche',
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    image: '/images/shop/ipe/ipe-valvetronic.png',
    href: '/shop/ipe/collections/ferrari',
  },
  {
    id: 'lamborghini',
    name: 'Lamborghini',
    image: '/images/shop/ipe/ipe-hero.png', // Or another generic one
    href: '/shop/ipe/collections/lamborghini',
  },
  {
    id: 'audi',
    name: 'Audi',
    image: '/images/shop/ipe/ipe-valvetronic.png', // Alternate generic
    href: '/shop/ipe/collections/audi',
  },
];
