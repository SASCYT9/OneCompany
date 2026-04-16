export type GirodiscProductLine = {
  title: string;
  titleUk: string;
  subtitle: string;
  subtitleUk: string;
  badge: string;
  badgeUk: string;
  tagOne: string;
  tagTwo: string;
  buttonLabel: string;
  buttonLabelUk: string;
  link: string;
  imageUrl: string;
};

export const GIRODISC_HERO = {
  eyebrow: 'One Company × GiroDisc',
  eyebrowUk: 'One Company × GiroDisc',
  title: 'The Pinnacle of Braking Performance.',
  titleUk: 'Вершина гальмівної ефективності.',
  subtitle:
    'Official GiroDisc distributor. 100% US-made, 2-piece high-performance rotors for both street and track.',
  subtitleUk:
    'Офіційний дистриб\'ютор GiroDisc. Високоефективні двоскладові гальмівні диски, 100% вироблені в США, для міста та треку.',
  primaryButtonLabel: 'Explore Range',
  primaryButtonLabelUk: 'Модельний ряд',
  primaryButtonLink: '/shop/girodisc/collections',
  secondaryButtonLabel: 'About Us',
  secondaryButtonLabelUk: 'Про нас',
  secondaryButtonLink: '/about',
  secondaryButtonNewTab: false,
  heroImageUrl: '/images/shop/girodisc/girodisc-hero.jpg',
} as const;

export const GIRODISC_PRODUCT_LINES: GirodiscProductLine[] = [
  {
    title: '2-Piece Rotors',
    titleUk: 'Двоскладові Ротори',
    subtitle: 'Track-Ready Performance',
    subtitleUk: 'Для Треку та Міста',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    tagOne: 'Lightweight',
    tagTwo: 'Cooling',
    buttonLabel: 'View Rotors',
    buttonLabelUk: 'Переглянути ротори',
    link: '/shop/girodisc/rotors',
    imageUrl: '/images/shop/girodisc/line-rotors.jpg',
  },
  {
    title: 'Performance Pads',
    titleUk: 'Спортивні Колодки',
    subtitle: 'Magic Pads',
    subtitleUk: 'Серія Magic Pads',
    badge: 'Popular',
    badgeUk: 'Популярно',
    tagOne: 'Low Dust',
    tagTwo: 'High Bite',
    buttonLabel: 'View Pads',
    buttonLabelUk: 'Переглянути колодки',
    link: '/shop/girodisc/pads',
    imageUrl: '/images/shop/girodisc/line-pads.jpg',
  },
  {
    title: 'Rebuild Kits',
    titleUk: 'Ремонтні Набори',
    subtitle: 'Hardware & Bobbins',
    subtitleUk: 'Кріплення та бобіни',
    badge: 'Essential',
    badgeUk: 'Важливо',
    tagOne: 'Service',
    tagTwo: 'OEM Spec',
    buttonLabel: 'View Kits',
    buttonLabelUk: 'Переглянути набори',
    link: '/shop/girodisc/rebuild-kits',
    imageUrl: '/images/shop/girodisc/line-rebuild.jpg',
  },
  {
    title: 'Titanium Shields',
    titleUk: 'Титанові Щити',
    subtitle: 'Thermal Management',
    subtitleUk: 'Терморегуляція',
    badge: 'Track',
    badgeUk: 'Трек',
    tagOne: 'Titanium',
    tagTwo: 'Heat Shield',
    buttonLabel: 'View Shields',
    buttonLabelUk: 'Переглянути щити',
    link: '/shop/girodisc/shields',
    imageUrl: '/images/shop/girodisc/line-shields.jpg',
  },
];

export const GIRODISC_FACTORY_CONTENT = {
  title: 'Machined to Absolute Perfection',
  titleUk: 'Обробка до абсолютної досконалості',
  description: 'Every rotor is designed, engineered, and manufactured in-house at the USA facility using state-of-the-art CNC machines. This guarantees unparalleled precision and quality control.',
  descriptionUk: 'Кожен диск спроєктовано та виготовлено на власному заводі у США з використанням найсучасніших верстатів із ЧПК. Це гарантує неперевершену точність та контроль якості.',
  cards: [
    {
      title: 'CNC Precision',
      titleUk: 'Точність ЧПК',
      desc: 'Surgical accuracy in every cut.',
      descUk: 'Хірургічна точність у кожному зрізі.',
      img: '/images/shop/girodisc/girodisc-cnc.jpg'
    },
    {
      title: 'Iron Casting',
      titleUk: 'Власне Лиття',
      desc: 'Proprietary iron alloys for max thermal capacity.',
      descUk: 'Власні сплави чавуну для максимальної тепломісткості.',
      img: '/images/shop/girodisc/girodisc-iron.jpg'
    },
    {
      title: 'In-House Testing',
      titleUk: 'Внутрішнє Тестування',
      desc: 'Rigorous tests on tracks and labs.',
      descUk: 'Жорсткі тести на треках та в лабораторіях.',
      img: '/images/shop/girodisc/girodisc-factory.jpg'
    }
  ]
};
