/* ──────────────────────────────────────────────
   ADRO Home Data  (EN / UA)
   «Carbon Phantom»
   ────────────────────────────────────────────── */

export const ADRO_HERO = {
  heroImage: '/images/shop/adro/adro-hero-m4.jpg',
  subtitle:
    'Prepreg carbon fiber aerokits engineered with Computational Fluid Dynamics. F1-level aerodynamic testing meets handcrafted precision.',
  subtitleUk:
    'Аерокіти з препрег-карбону, розроблені за допомогою обчислювальної аеродинаміки (CFD). Тестування рівня F1 поєднане з ручною точністю.',
};

export const ADRO_STATS = [
  { val: '100%', en: 'Prepreg Carbon', ua: 'Препрег карбон' },
  { val: 'CFD', en: 'Aero Validation', ua: 'Аеро валідація' },
  { val: '15+', en: 'Vehicle Models', ua: 'Моделей авто' },
  { val: '2K+', en: 'Kits Shipped', ua: 'Кітів відправлено' },
];

export const ADRO_TECHNOLOGY = {
  title: 'CFD Engineering',
  titleUk: 'CFD Інженерія',
  description:
    'Every ADRO aerokit undergoes rigorous Computational Fluid Dynamics simulation — the same technology used in Formula 1 — to validate real aerodynamic performance. From front lips to rear diffusers, each component is optimized for downforce, drag reduction, and cooling efficiency before a single mold is cut.',
  descriptionUk:
    'Кожен аерокіт ADRO проходить жорстку симуляцію обчислювальної аеродинаміки (CFD) — тієї ж технології, що використовується у Формулі 1 — для підтвердження реальних аеродинамічних характеристик. Від передніх спліттерів до задніх дифузорів — кожен компонент оптимізований на притискну силу, зменшення опору та ефективність охолодження ще до виготовлення форми.',
  image: '/images/shop/adro/adro-gt3-kit.png',
  specs: [
    { val: 'F1', label: 'CFD Technology', labelUk: 'CFD Технологія' },
    { val: '+12%', label: 'Downforce Gain', labelUk: 'Приріст притиску' },
    { val: '−8%', label: 'Drag Reduction', labelUk: 'Зменшення опору' },
    { val: '100+', label: 'Simulation Hours', labelUk: 'Годин симуляцій' },
  ],
};

export const ADRO_MATERIALS = {
  title: 'Prepreg Carbon Fiber',
  titleUk: 'Препрег Карбон',
  description:
    'ADRO exclusively uses autoclave-cured prepreg carbon fiber — the highest grade available in automotive applications. Unlike wet carbon or dry carbon alternatives, prepreg offers superior strength-to-weight ratio, perfect surface finish, and UV-resistant clear coat. Each piece is hand-laid in precision tooling to achieve flawless fitment.',
  descriptionUk:
    'ADRO використовує виключно автоклавний препрег-карбон — найвищий клас карбонових матеріалів в автомобільній індустрії. На відміну від мокрого або сухого карбону, препрег забезпечує найкращий показник міцності до ваги, ідеальну поверхню та UV-стійке прозоре покриття. Кожна деталь формується вручну у точному оснащенні для бездоганної посадки.',
  image: '/images/shop/adro/adro-m3-front.jpg',
  specs: [
    { val: '3K', label: 'Carbon Weave', labelUk: 'Плетіння карбону' },
    { val: '180°C', label: 'Autoclave Cure', labelUk: 'Автоклав обробка' },
    { val: 'UV', label: 'Clear Coat', labelUk: 'Захисне покриття' },
    { val: 'OEM', label: 'Fitment Grade', labelUk: 'Оригінальна посадка' },
  ],
};

export type AdroProductLine = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  badge: string;
  badgeUk: string;
  image: string;
  link: string;
};

export const ADRO_PRODUCT_LINES: AdroProductLine[] = [
  {
    id: 'bmw-m4',
    name: 'BMW G8X M3/M4',
    nameUk: 'BMW G8X M3/M4',
    description: 'Widebody kit, front lip, side skirts, rear diffuser — full aggressive aero transformation.',
    descriptionUk: 'Вайдбоді кіт, передній спліттер, бокові пороги, задній дифузор — повна агресивна аеротрансформація.',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    image: '/images/shop/adro/adro-m4-side.png',
    link: '/shop/adro/collections/bmw-m4',
  },
  {
    id: 'porsche-gt3',
    name: 'Porsche 992 GT3',
    nameUk: 'Porsche 992 GT3',
    description: 'CFD-validated front lip, swan-neck wing, side blades — track-focused carbon perfection.',
    descriptionUk: 'CFD-валідований спліттер, крило swan-neck, бокові пластини — карбонова досконалість для треку.',
    badge: 'Track',
    badgeUk: 'Трек',
    image: '/images/shop/adro/adro-gt3-kit.png',
    link: '/shop/adro/collections/porsche-gt3',
  },
  {
    id: 'toyota-supra',
    name: 'Toyota GR Supra',
    nameUk: 'Toyota GR Supra',
    description: 'Facelift-compatible full kit — front lip, side skirts, trunk spoiler, rear diffuser.',
    descriptionUk: 'Повний кіт для фейсліфту — спліттер, пороги, спойлер на багажник, задній дифузор.',
    badge: 'JDM',
    badgeUk: 'JDM',
    image: '/images/shop/adro/adro-supra-kit.png',
    link: '/shop/adro/collections/toyota-supra',
  },
  {
    id: 'tesla-model3',
    name: 'Tesla Model 3',
    nameUk: 'Tesla Model 3',
    description: 'Highland full kit — minimalist carbon elements that elevate the EV design language.',
    descriptionUk: 'Highland повний кіт — мінімалістичні карбонові елементи, що підвищують мову дизайну електрокара.',
    badge: 'EV',
    badgeUk: 'EV',
    image: '/images/shop/adro/adro-tesla3-kit.png',
    link: '/shop/adro/collections/tesla-model3',
  },
];

export const ADRO_HERITAGE = {
  fallbackImage: '/images/shop/adro/adro-hero-718.jpg',
  title: 'Not For Everybody',
  titleUk: 'Не для всіх',
  description:
    'Founded in South Korea, ADRO combines cutting-edge Computational Fluid Dynamics engineering with the artisan precision of autoclave-cured prepreg carbon fiber. Every kit is designed not just to look aggressive — but to perform. ADRO bridges the gap between aftermarket aesthetics and motorsport engineering, creating aerokits that deliver real downforce verified through F1-level simulation.',
  descriptionUk:
    'Заснована в Південній Кореї, ADRO поєднує передову CFD-інженерію з майстерною точністю автоклавного препрег-карбону. Кожен кіт створений не лише для агресивного вигляду — а для реальної продуктивності. ADRO об\'єднує естетику aftermarket та інженерію автоспорту, створюючи аерокіти з реальною притискною силою, підтвердженою симуляціями рівня F1.',
};
