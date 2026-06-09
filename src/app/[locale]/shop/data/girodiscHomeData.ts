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

export type GirodiscMaterial = {
  id: string;
  title: string;
  titleUk: string;
  description: string;
  descriptionUk: string;
  spec: string;
  specLabel: string;
  specLabelUk: string;
};

export const GIRODISC_HERO = {
  eyebrow: 'One Company × GiroDisc',
  eyebrowUk: 'One Company × GiroDisc',
  title: 'The Pinnacle of Braking Performance.',
  titleUk: 'Вершина гальмівної ефективності.',
  subtitle:
    'Official GiroDisc distributor. 2-piece high-performance rotors, precision-engineered and manufactured in the USA.',
  subtitleUk:
    'Офіційний дистриб\'ютор GiroDisc. Двоскладові високоефективні ротори, точно спроєктовані та вироблені в США.',
  primaryButtonLabel: 'Explore Range',
  primaryButtonLabelUk: 'Модельний ряд',
  primaryButtonLink: '/shop/girodisc/catalog',
  secondaryButtonLabel: 'About Us',
  secondaryButtonLabelUk: 'Про нас',
  secondaryButtonLink: '/about',
  secondaryButtonNewTab: false,
  heroImageUrl: '/images/shop/girodisc/girodisc-hero.jpg',
  heroVideoId: 'slk23FHCF7U',
} as const;

export const GIRODISC_MATERIALS: GirodiscMaterial[] = [
  {
    id: 'iron-alloy',
    title: 'Proprietary Iron Alloy',
    titleUk: 'Власний Сплав Чавуну',
    description:
      'GiroDisc rotors use a proprietary high-carbon iron alloy that delivers exceptional thermal capacity and resistance to cracking under extreme track conditions. The composition is tuned for repeatable performance lap after lap.',
    descriptionUk:
      'Ротори GiroDisc виготовлені з власного високовуглецевого сплаву чавуну, що забезпечує виняткову тепломісткість та стійкість до тріщин в екстремальних трекових умовах. Склад налаштований для стабільних результатів коло за колом.',
    spec: '1400°F',
    specLabel: 'Max Operating Temp',
    specLabelUk: 'Макс. робоча температура',
  },
  {
    id: 'cnc-precision',
    title: 'CNC Machined Precision',
    titleUk: 'Точність ЧПК Обробки',
    description:
      'Every rotor ring and aluminum hat is machined in-house on 5-axis CNC equipment. Tolerances are held to thousandths of an inch, ensuring perfect concentricity and zero-runout performance on every unit shipped.',
    descriptionUk:
      'Кожне кільце ротора та алюмінієвий хаб обробляються на власних 5-осьових верстатах з ЧПК. Допуски витримуються до тисячних долей дюйма, забезпечуючи ідеальну концентричність та нульове биття.',
    spec: '0.001"',
    specLabel: 'Machining Tolerance',
    specLabelUk: 'Точність обробки',
  },
  {
    id: 'floating-assembly',
    title: 'Floating Rotor Assembly',
    titleUk: 'Плаваюча Конструкція Ротора',
    description:
      'The 2-piece floating design allows the iron ring to expand independently from the lightweight aluminum hat during heating. This eliminates warping, reduces unsprung weight, and enables replacement of only the friction surface.',
    descriptionUk:
      'Двоскладова плаваюча конструкція дозволяє чавунному кільцю розширюватися незалежно від легкого алюмінієвого хаба під час нагріву. Це усуває деформацію, зменшує непідресорену масу та дозволяє замінювати лише фрикційну поверхню.',
    spec: '−40%',
    specLabel: 'Unsprung Weight',
    specLabelUk: 'Непідресорена маса',
  },
];

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
    link: '/shop/girodisc/catalog',
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
    link: '/shop/girodisc/catalog',
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
    link: '/shop/girodisc/catalog',
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
    link: '/shop/girodisc/catalog',
    imageUrl: '/images/shop/girodisc/line-shields.jpg',
  },
];

export const GIRODISC_FACTORY_CONTENT = {
  title: 'Machined to Absolute Perfection',
  titleUk: 'Обробка до абсолютної досконалості',
  description: 'Every rotor is designed, engineered, and manufactured in-house at the USA facility using state-of-the-art CNC machines. This guarantees unparalleled precision and quality control.',
  descriptionUk: 'Кожен диск спроєктовано та виготовлено на власному заводі у США з використанням найсучасніших верстатів із ЧПК. Це гарантує неперевершену точність та контроль якості.',
  videoId: 'LEMKwXOtuig',
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

export const GIRODISC_HERITAGE = {
  title: 'Engineering Without Compromise',
  titleUk: 'Інженерія без компромісів',
  description:
    'Born from a passion for motorsport and a relentless pursuit of braking perfection. From weekend warriors to professional endurance teams, GiroDisc components are trusted where it matters most — at the limit.',
  descriptionUk:
    'Народжено з пристрасті до автоспорту та невпинного прагнення до досконалості гальмування. Від ентузіастів вихідного дня до професійних команд витривалості — компоненти GiroDisc довіряють там, де це найважливіше — на межі можливостей.',
  backgroundImage: '/images/shop/girodisc/girodisc-factory.jpg',
} as const;
