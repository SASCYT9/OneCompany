/* ──────────────────────────────────────────────────
   CSF Racing Home Data  (EN / UA)
   ────────────────────────────────────────────────── */

export const CSF_HERO = {
  heroVideoUrl: '', // Removed unfitting video
  heroImageFallback: '/images/shop/csf/hero-fallback.jpg',
  subtitle:
    'High-performance aluminum radiators, intercoolers, and oil coolers engineered for maximum heat dissipation.',
  subtitleUk:
    'Високопродуктивні алюмінієві радіатори, інтеркулери та масляні охолоджувачі, спроєктовані для максимального розсіювання тепла.',
};

export const CSF_STATS = [
  { val: '1974', en: 'Founded', ua: 'Засновано' },
  { val: '+15%', en: 'B-Tube Efficiency', ua: 'Ефективність B-Tube' },
  { val: '−40%', en: 'Weight vs OEM', ua: 'Вага vs OEM' },
  { val: '200+', en: 'Vehicle Apps', ua: 'Моделей авто' },
];

export const CSF_MATERIALS = {
  aluminum: {
    title: 'Aerospace Aluminum',
    titleUk: 'Аерокосмічний алюміній',
    description:
      'All-aluminum TIG-welded construction using the same alloys found in aerospace applications. 40% lighter than factory plastic-tank designs with dramatically improved thermal conductivity and zero risk of plastic failure under extreme heat cycles.',
    descriptionUk:
      'Повністю алюмінієва конструкція з TIG-зварюванням із тих самих сплавів, що використовуються в аерокосмічній галузі. На 40% легша за заводські конструкції з пластиковими бачками, з помітно кращою теплопровідністю та нульовим ризиком руйнування пластику при екстремальних термоциклах.',
    image: '/images/shop/csf/aluminum-closeup.jpg',
  },
  btube: {
    title: 'B-Tube Technology',
    titleUk: 'Технологія B-Tube',
    description:
      'CSF\'s patented B-Tube design shapes coolant tubes into a "B" cross-section instead of the standard oval. This increases heat transfer surface area by 15% while using thinner, lighter aluminum — delivering superior cooling without increasing package size.',
    descriptionUk:
      'Запатентована технологія CSF B-Tube формує трубки охолодження в перерізі "B" замість стандартного овалу. Це збільшує площу теплообміну на 15%, використовуючи тонший та легший алюміній — забезпечуючи покращене охолодження без збільшення габаритів.',
    image: '/images/shop/csf/btube-closeup.jpg',
  },
};

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
};

export const CSF_PRODUCT_LINES: CSFProductLine[] = [
  {
    id: 'radiators',
    name: 'Radiators',
    nameUk: 'Радіатори',
    description: 'All-aluminum direct-fit radiators with dual & triple-pass designs for maximum cooling efficiency.',
    descriptionUk: 'Повністю алюмінієві радіатори прямої установки з дво- та трипрохідною конструкцією для максимальної ефективності охолодження.',
    badge: 'Core',
    badgeUk: 'Основа',
    image: '/images/shop/csf/line-radiators.jpg',
    link: '/shop/csf/collections',
  },
  {
    id: 'intercoolers',
    name: 'Intercoolers',
    nameUk: 'Інтеркулери',
    description: 'Front-mount and top-mount intercoolers with bar-and-plate core technology for forced-induction builds.',
    descriptionUk: 'Фронтальні та верхні інтеркулери з технологією bar-and-plate для турбованих та компресорних збірок.',
    badge: 'Boost',
    badgeUk: 'Буст',
    image: '/images/shop/csf/line-intercoolers.jpg',
    link: '/shop/csf/collections',
  },
  {
    id: 'oil-coolers',
    name: 'Oil Coolers',
    nameUk: 'Охолоджувачі масла',
    description: 'Engine & transmission oil cooling solutions. Stacked-plate design for optimal oil temperature management.',
    descriptionUk: 'Охолодження масла двигуна та АКПП. Дизайн з набірних пластин для оптимального керування температурою масла.',
    badge: 'Protection',
    badgeUk: 'Захист',
    image: '/images/shop/csf/line-oil-coolers.jpg',
    link: '/shop/csf/collections',
  },
  {
    id: 'heat-exchangers',
    name: 'Heat Exchangers',
    nameUk: 'Теплообмінники',
    description: 'Liquid-to-air auxiliary heat exchangers for supercharged and turbocharged applications.',
    descriptionUk: 'Допоміжні теплообмінники рідина-повітря для компресорних та турбованих застосувань.',
    badge: 'Advanced',
    badgeUk: 'Просунутий',
    image: '/images/shop/csf/line-heat-exchangers.jpg',
    link: '/shop/csf/collections',
  },
  {
    id: 'competition',
    name: 'Competition Series',
    nameUk: 'Серія Competition',
    description: 'Universal race radiators, V-mount setups, and custom cooling solutions for professional motorsport teams.',
    descriptionUk: 'Універсальні гоночні радіатори, V-mount конфігурації та індивідуальні рішення охолодження для професійних команд.',
    badge: 'Race',
    badgeUk: 'Гонки',
    image: '/images/shop/csf/line-competition.jpg',
    link: '/shop/csf/collections',
  },
];

export const CSF_HERITAGE = {
  videoUrl: '', // Removed unfitting video
  fallbackImage: '/images/shop/csf/factory-fallback.jpg',
  title: 'Engineering Since 1974',
  titleUk: 'Інженерія з 1974 року',
  description:
    'For over 50 years, CSF has been at the forefront of cooling technology — from OEM replacement to championship-winning motorsport solutions. Every radiator is designed with CAD/CAM precision, wind tunnel tested, and built to exceed factory specifications. From Formula Drift to Baja 1000, CSF cools the machines that matter.',
  descriptionUk:
    'Понад 50 років CSF знаходиться на передовій технологій охолодження — від OEM-заміни до рішень для чемпіонських автоспортивних команд. Кожен радіатор спроектований з CAD/CAM точністю, протестований в аеродинамічній трубі та побудований, щоб перевершити заводські характеристики. Від Formula Drift до Baja 1000 — CSF охолоджує машини, які мають значення.',
};
