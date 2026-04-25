/* ──────────────────────────────────────────────────
   CSF Racing Home Data  (EN / UA)
   Engineering Editorial — updated imagery
   ────────────────────────────────────────────────── */

export const CSF_HERO = {
  heroImage: '/images/shop/csf/hero-main.jpg',
  subtitle:
    'High-performance aluminum radiators, intercoolers, and oil coolers engineered for maximum heat dissipation.',
  subtitleUk:
    'Високопродуктивні алюмінієві радіатори, інтеркулери та масляні охолоджувачі, спроєктовані для максимального розсіювання тепла.',
};

export const CSF_TECH_PILLARS = [
  {
    id: 'btube',
    title: 'B-Tube Technology',
    titleUk: 'Технологія B-Tube',
    description:
      'CSF\'s patented B-Tube shapes coolant tubes into a "B" cross-section, increasing heat transfer surface area by 15% while using thinner, lighter aluminum.',
    descriptionUk:
      'Запатентована технологія CSF B-Tube формує трубки охолодження в перерізі "B", збільшуючи площу теплообміну на 15% при використанні тоншого та легшого алюмінію.',
    image: '/images/shop/csf/btube-tech.jpg',
    specs: [
      { val: '+15%', en: 'Surface Area', ua: 'Площа обміну' },
      { val: 'B-Shape', en: 'Cross Section', ua: 'Переріз' },
      { val: 'Patent', en: 'CSF Exclusive', ua: 'Ексклюзив CSF' },
    ],
  },
  {
    id: 'aluminum',
    title: 'Aerospace Aluminum',
    titleUk: 'Аерокосмічний алюміній',
    description:
      'All-aluminum TIG-welded construction using 6061-T6 aerospace-grade alloys. 40% lighter than factory plastic-tank designs with zero risk of thermal failure.',
    descriptionUk:
      'Повністю алюмінієва TIG-зварна конструкція зі сплавів аерокосмічного класу 6061-T6. На 40% легша за заводські пластикові бачки.',
    image: '/images/shop/csf/aluminum-fin.jpg',
    specs: [
      { val: '6061-T6', en: 'Alloy Grade', ua: 'Марка сплаву' },
      { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs OEM' },
      { val: 'TIG', en: 'Weld Method', ua: 'Тип зварювання' },
    ],
  },
  {
    id: 'testing',
    title: 'Wind Tunnel Tested',
    titleUk: 'Аеродинамічна труба',
    description:
      'Every CSF radiator is designed with CAD/CAM precision and validated through wind tunnel and vibration testing to exceed factory specifications.',
    descriptionUk:
      'Кожен радіатор CSF спроектований з CAD/CAM точністю та пройшов випробування в аеродинамічній трубі та на вібростенді, перевершуючи заводські характеристики.',
    image: '/images/shop/csf/wind-tunnel.jpg',
    specs: [
      { val: 'CAD/CAM', en: 'Design', ua: 'Проектування' },
      { val: '100%', en: 'Tested', ua: 'Протестовано' },
      { val: 'OEM+', en: 'Spec Level', ua: 'Рівень' },
    ],
  },
];

export type CSFProductLine = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  badge: string;
  badgeUk: string;
  image: string;
  link: string;
  categoryFilter?: string;
  featured?: boolean;
};

export const CSF_PRODUCT_LINES: CSFProductLine[] = [
  {
    id: 'radiators',
    name: 'Radiators',
    nameUk: 'Радіатори',
    description:
      'All-aluminum direct-fit radiators with dual & triple-pass designs for maximum cooling efficiency.',
    descriptionUk:
      'Повністю алюмінієві радіатори прямої установки з дво- та трипрохідною конструкцією для максимальної ефективності охолодження.',
    badge: 'Core',
    badgeUk: 'Основа',
    image: '/images/shop/csf/line-radiators.jpg',
    link: '/shop/csf/collections',
    categoryFilter: 'radiators',
    featured: true,
  },
  {
    id: 'intercoolers',
    name: 'Intercoolers',
    nameUk: 'Інтеркулери',
    description:
      'Front-mount and top-mount intercoolers with bar-and-plate core technology for forced-induction builds.',
    descriptionUk:
      'Фронтальні та верхні інтеркулери з технологією bar-and-plate для турбованих та компресорних збірок.',
    badge: 'Boost',
    badgeUk: 'Буст',
    image: '/images/shop/csf/line-intercoolers.jpg',
    link: '/shop/csf/collections',
    categoryFilter: 'intercoolers',
  },
  {
    id: 'oil-coolers',
    name: 'Oil Coolers',
    nameUk: 'Охолоджувачі масла',
    description:
      'Engine & transmission oil cooling solutions. Stacked-plate design for optimal oil temperature management.',
    descriptionUk:
      'Охолодження масла двигуна та АКПП. Дизайн з набірних пластин для оптимального керування температурою масла.',
    badge: 'Protection',
    badgeUk: 'Захист',
    image: '/images/shop/csf/line-oil-coolers.jpg',
    link: '/shop/csf/collections',
    categoryFilter: 'oil-coolers',
  },
  {
    id: 'heat-exchangers',
    name: 'Heat Exchangers',
    nameUk: 'Теплообмінники',
    description:
      'Liquid-to-air auxiliary heat exchangers for supercharged and turbocharged applications.',
    descriptionUk:
      'Допоміжні теплообмінники рідина-повітря для компресорних та турбованих застосувань.',
    badge: 'Advanced',
    badgeUk: 'Просунутий',
    image: '/images/shop/csf/line-heat-exchangers.jpg',
    link: '/shop/csf/collections',
    categoryFilter: 'trans-cooling',
  },
  {
    id: 'competition',
    name: 'Competition Series',
    nameUk: 'Серія Competition',
    description:
      'Universal race radiators, V-mount setups, and custom cooling solutions for professional motorsport teams.',
    descriptionUk:
      'Універсальні гоночні радіатори, V-mount конфігурації та індивідуальні рішення охолодження для професійних команд.',
    badge: 'Race',
    badgeUk: 'Гонки',
    image: '/images/shop/csf/line-competition.jpg',
    link: '/shop/csf/collections',
  },
];

export const CSF_HERITAGE = {
  backgroundImage: '/images/shop/csf/sema-csf911.jpg',
  title: 'Engineering Since 1947',
  titleUk: 'Інженерія з 1947 року',
  description:
    'For over 75 years, CSF has been at the forefront of cooling technology — from OEM replacement to championship-winning motorsport solutions. Every radiator is designed with CAD/CAM precision, wind tunnel tested, and built to exceed factory specifications. From Formula Drift to Baja 1000, CSF cools the machines that matter.',
  descriptionUk:
    'Понад 75 років CSF знаходиться на передовій технологій охолодження — від OEM-заміни до рішень для чемпіонських автоспортивних команд. Кожен радіатор спроектований з CAD/CAM точністю, протестований в аеродинамічній трубі та побудований, щоб перевершити заводські характеристики. Від Formula Drift до Baja 1000 — CSF охолоджує машини, які мають значення.',
};
