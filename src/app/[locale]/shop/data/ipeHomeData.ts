/* ──────────────────────────────────────────────
   iPE Exhaust Home Data  (EN / UA)
   «Crimson Velocity»
   ────────────────────────────────────────────── */

export const IPE_HERO = {
  heroImage: '/images/shop/ipe/ipe-lamborghini-svj.jpg',
  subtitle:
    'Hand-crafted titanium and stainless steel exhaust systems with signature Valvetronic technology. F1-pitch sound on demand.',
  subtitleUk:
    'Вихлопні системи ручної роботи з титану та нержавіючої сталі з фірмовою технологією Valvetronic. Звук F1 за натисканням кнопки.',
};

export const IPE_STATS = [
  { val: '+12', en: 'HP Gain (avg)', ua: 'К.С. приріст (сер.)' },
  { val: '−45%', en: 'Weight Reduction', ua: 'Зменшення ваги' },
  { val: '110', en: 'dB Maximum', ua: 'дБ Максимум' },
  { val: '100%', en: 'Valvetronic', ua: 'Валвтронік' },
];

export const IPE_VALVETRONIC = {
  title: 'Valvetronic Technology',
  titleUk: 'Технологія Valvetronic',
  description:
    'iPE\'s proprietary Valvetronic exhaust valve system delivers two distinct exhaust characters — from civilised cruising to full-throttle F1 soundtrack. Controlled via the included wireless remote or in-cabin button, the valves redirect exhaust flow through chambered baffles or straight-through pipes for maximum volume.',
  descriptionUk:
    'Фірмова система клапанів Valvetronic від iPE забезпечує два режими звучання — від цивілізованої їзди до повноцінного F1-саундтреку. Управління здійснюється бездротовим пультом або кнопкою в салоні: клапани перенаправляють потік через камерні перегородки або прямоточні труби для максимальної гучності.',
  image: '/images/shop/ipe/ipe-gt3rs-titanium.jpg',
  specs: [
    { val: '2', label: 'Sound Modes', labelUk: 'Режими звуку' },
    { val: '85–110', label: 'dB Range', labelUk: 'дБ Діапазон' },
    { val: 'RF', label: 'Wireless Remote', labelUk: 'Бездротовий пульт' },
    { val: '<1s', label: 'Response Time', labelUk: 'Час відгуку' },
  ],
};

export const IPE_MATERIALS = {
  title: 'Titanium Grade',
  titleUk: 'Титановий Сплав',
  description:
    'iPE exhaust systems utilize aerospace-grade titanium alloys for critical components — headers, mid-pipes, and muffler shells. Each joint is hand-TIG welded for maximum precision, producing the distinctive blue-purple heat tint that signals authentic titanium craftsmanship. The result: 45% weight savings over stainless steel with superior thermal resistance.',
  descriptionUk:
    'Вихлопні системи iPE використовують авіаційний титановий сплав для критичних компонентів — колектори, з\'єднувальні труби та корпуси глушників. Кожне з\'єднання зварюється вручну TIG-зварюванням для максимальної точності, створюючи характерний синьо-фіолетовий відтінок, що підтверджує справжність титану. Результат: зменшення ваги на 45% порівняно з нержавіючою сталлю.',
  image: '/images/shop/ipe/ipe-valve-detail.jpg',
  specs: [
    { val: '800°C', label: 'Max Temperature', labelUk: 'Макс. температура' },
    { val: '−45%', label: 'vs Stainless Steel', labelUk: 'проти нерж. сталі' },
    { val: 'Gr.2', label: 'Titanium Grade', labelUk: 'Клас титану' },
    { val: 'TW', label: 'Made in Taiwan', labelUk: 'Виготовлено в Тайвані' },
  ],
};

export type IpeProductLine = {
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

export const IPE_PRODUCT_LINES: IpeProductLine[] = [
  {
    id: 'porsche',
    name: 'Porsche',
    nameUk: 'Porsche',
    description: '911, Cayenne, Panamera, Macan — full titanium Valvetronic systems with quad tips.',
    descriptionUk: '911, Cayenne, Panamera, Macan — повністю титанові Valvetronic-системи з квад-насадками.',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    image: '/images/shop/ipe/ipe-porsche-system.jpg',
    link: '/shop/ipe/collections/porsche',
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    nameUk: 'Ferrari',
    description: '488, F8, Roma, SF90 — race-bred exhaust tuned to enhance the flat-plane V8 scream.',
    descriptionUk: '488, F8, Roma, SF90 — гоночний тюнінг для підсилення крику плоского V8.',
    badge: 'Supercar',
    badgeUk: 'Суперкар',
    image: '/images/shop/ipe/ipe-ferrari-real.jpg',
    link: '/shop/ipe/collections/ferrari',
  },
  {
    id: 'lamborghini',
    name: 'Lamborghini',
    nameUk: 'Lamborghini',
    description: 'Huracán, Aventador, Urus — unleash the full V10/V12 symphony with iPE tuning.',
    descriptionUk: 'Huracán, Aventador, Urus — розкрийте повну V10/V12 симфонію з тюнінгом iPE.',
    badge: 'V10 / V12',
    badgeUk: 'V10 / V12',
    image: '/images/shop/ipe/ipe-lamborghini-svj.jpg',
    link: '/shop/ipe/collections/lamborghini',
  },
  {
    id: 'mclaren',
    name: 'McLaren',
    nameUk: 'McLaren',
    description: '720S, 765LT, Artura — precision-engineered for twin-turbo V8 applications.',
    descriptionUk: '720S, 765LT, Artura — точна інженерія для двотурбінних V8 двигунів.',
    badge: 'Track',
    badgeUk: 'Трек',
    image: '/images/shop/ipe/ipe-mclaren-real.jpg',
    link: '/shop/ipe/collections/mclaren',
  },
  {
    id: 'audi',
    name: 'Audi',
    nameUk: 'Audi',
    description: 'R8, RS6, RS7, RSQ8 — Valvetronic aggression for Quattro-powered machines.',
    descriptionUk: 'R8, RS6, RS7, RSQ8 — агресія Valvetronic для Quattro-машин.',
    badge: 'Quattro',
    badgeUk: 'Quattro',
    image: '/images/shop/ipe/ipe-aventador-system.jpg',
    link: '/shop/ipe/collections/audi',
  },
  {
    id: 'bmw',
    name: 'BMW',
    nameUk: 'BMW',
    description: 'M3, M4, M5, X5M — titanium systems for the ultimate driving machines.',
    descriptionUk: 'M3, M4, M5, X5M — титанові системи для машин абсолютного драйву.',
    badge: 'M Power',
    badgeUk: 'M Power',
    image: '/images/shop/ipe/ipe-installation.jpg',
    link: '/shop/ipe/collections/bmw',
  },
];

export const IPE_HERITAGE = {
  fallbackImage: '/images/shop/ipe/ipe-porsche-components.jpg',
  title: 'Born in Taiwan',
  titleUk: 'Народжено в Тайвані',
  description:
    'Since 2005, iPE (Innotech Performance Exhaust) has been designing, testing, and manufacturing exhaust systems in their state-of-the-art facility in Taiwan. With over 100 engineers combining CNC precision machining, hand TIG welding, and advanced acoustic engineering — iPE has become the world\'s leading Valvetronic exhaust manufacturer. Every system undergoes 200+ hours of R&D before production.',
  descriptionUk:
    'З 2005 року iPE (Innotech Performance Exhaust) проєктує, тестує та виготовляє вихлопні системи на сучасному виробництві в Тайвані. Понад 100 інженерів поєднують CNC-обробку, ручне TIG-зварювання та передову акустичну інженерію — iPE стали світовим лідером Valvetronic-виробництва. Кожна система проходить 200+ годин R&D перед запуском у серію.',
};
