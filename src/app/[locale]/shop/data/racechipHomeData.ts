/* ─────────────────────────────────────────────────────
   RaceChip Home Data — bilingual content & product lines
───────────────────────────────────────────────────── */

export const RACECHIP_HERO = {
  eyebrow: 'One Company × RaceChip',
  eyebrowUk: 'One Company × RaceChip',
  subtitle: 'Unlock the full potential of your engine. German-engineered chip tuning trusted by over 500,000 drivers worldwide.',
  subtitleUk: 'Розкрийте повний потенціал двигуна. Німецький чіп-тюнінг, якому довіряють понад 500 000 водіїв у всьому світі.',
  primaryButtonLabel: 'Explore Catalog',
  primaryButtonLabelUk: 'Відкрити каталог',
  primaryButtonLink: '/shop/racechip/catalog',
};

export const RACECHIP_STATS = [
  { value: '30%', label: 'More Power', labelUk: 'Більше потужності' },
  { value: '500K+', label: 'Units Sold', labelUk: 'Продано одиниць' },
  { value: '15 min', label: 'Installation', labelUk: 'Встановлення' },
  { value: '60+', label: 'Vehicle Brands', labelUk: 'Марок авто' },
];

export interface RacechipProductLine {
  title: string;
  titleUk: string;
  subtitle: string;
  subtitleUk: string;
  badge: string;
  badgeUk: string;
  description: string;
  descriptionUk: string;
  imageUrl: string;
  link: string;
}

export const RACECHIP_PRODUCT_LINES: RacechipProductLine[] = [
  {
    title: 'GTS Black',
    titleUk: 'GTS Black',
    subtitle: 'Flagship Performance',
    subtitleUk: 'Флагманська продуктивність',
    badge: 'Flagship',
    badgeUk: 'Флагман',
    description: 'Up to 30% more power. 7-channel mapping with App Control.',
    descriptionUk: 'До 30% більше потужності. 7-канальна калібровка з App Control.',
    imageUrl: '/images/shop/racechip/gts-black-macro.png',
    link: '/shop/racechip/catalog',
  },
  {
    title: 'XLR Throttle',
    titleUk: 'XLR Педаль газу',
    subtitle: 'Response Tuning',
    subtitleUk: 'Тюнінг відгуку',
    badge: 'Popular',
    badgeUk: 'Популярно',
    description: 'Eliminate throttle delay. Instant pedal response via smartphone.',
    descriptionUk: 'Миттєвий відгук педалі газу. Усунення затримки через смартфон.',
    imageUrl: '/images/shop/racechip/app-stealth-realui.png',
    link: '/shop/racechip/catalog',
  },
  {
    title: 'GTS 5',
    titleUk: 'GTS 5',
    subtitle: 'Smart Performance',
    subtitleUk: 'Розумна продуктивність',
    badge: 'Essential',
    badgeUk: 'Базовий',
    description: 'Proven 5-channel chip tuning with plug & drive installation.',
    descriptionUk: 'Перевірений 5-канальний чіп-тюнінг з встановленням Plug & Drive.',
    imageUrl: '/images/shop/racechip/hero-stealth-fixed.png',
    link: '/shop/racechip/catalog',
  },
];

export const RACECHIP_APP = {
  label: 'Smart Control',
  labelUk: 'Розумне керування',
  title: 'Control At Your Fingertips.',
  titleUk: 'Керування під рукою.',
  description: 'Choose between Efficiency, Sport, and Race modes dynamically from your smartphone. The RaceChip app allows you to adapt your car\'s performance to any driving situation instantly.',
  descriptionUk: 'Миттєво перемикайте режими Efficiency, Sport та Race зі свого смартфону. Додаток RaceChip дозволяє динамічно адаптувати характер вашого авто до будь-якої ситуації на дорозі.',
  features: [
    { en: 'Dynamic mode switching on the fly', uk: 'Динамічне перемикання режимів на льоту' },
    { en: 'Warm-up timer integration', uk: 'Інтегрований таймер прогріву двигуна' },
    { en: 'Automatic software updates', uk: 'Автоматичні оновлення ПЗ' },
  ],
  imageUrl: '/images/shop/racechip/app-stealth-realui.png',
};

export const RACECHIP_ENGINEERING = {
  label: 'German Engineering',
  labelUk: 'Німецька інженерія',
  title: 'Power Meets Precision.',
  titleUk: 'Абсолютна точність та динаміка.',
  description: 'Precision engineered in Germany. The RaceChip GTS Black interfaces seamlessly with your engine\'s sensors via a high-grade, plug-and-play wiring harness, safely unlocking hidden power reserves without permanently altering the factory ECU.',
  descriptionUk: 'Справжня німецька інженерія. RaceChip GTS Black підключається безпосередньо до датчиків двигуна через професійну систему Plug & Drive. Він безпечно розкриває прихований потенціал автомобіля, не залишаючи жодних слідів у заводському блоці управління (ECU).',
  features: [
    { en: 'Plug & Drive installation in 15 minutes', uk: 'Встановлення Plug & Drive за 15 хвилин' },
    { en: 'Preserves factory engine warranty limits', uk: 'Зберігає ліміти заводської гарантії' },
    { en: 'Invisible to official dealership diagnostics', uk: 'Невидимий для офіційної діагностики' },
  ],
  imageUrl: '/images/shop/racechip/gts-black-macro.png',
};

export const RACECHIP_HERITAGE = {
  title: 'Born in Germany. Trusted Worldwide.',
  titleUk: 'Народжено в Німеччині. Довіра у всьому світі.',
  description: 'Since 2008, RaceChip has led the chip tuning market with over 500,000 units sold across 135 countries. Every product is developed, tested, and manufactured at our headquarters in Göppingen, Germany — to the highest standards of automotive engineering.',
  descriptionUk: 'З 2008 року RaceChip лідирує на ринку чіп-тюнінгу з понад 500 000 проданих одиниць у 135 країнах. Кожен продукт розробляється, тестується та виготовляється в штаб-квартирі в Гьоппінгені, Німеччина — за найвищими стандартами автомобільної інженерії.',
};
