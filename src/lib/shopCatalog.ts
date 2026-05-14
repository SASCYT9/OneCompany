export type ShopScope = "auto" | "moto";
export type ShopStock = "inStock" | "preOrder";

type LocalizedText = {
  ua: string;
  en: string;
};

export type ShopMoneySet = {
  eur: number;
  usd: number;
  uah: number;
};

export type ShopProductCollectionLink = {
  id?: string;
  handle: string;
  title: LocalizedText;
  brand?: string | null;
  isUrban?: boolean;
  sortOrder?: number;
};

export type ShopProductVariantSummary = {
  id?: string;
  title?: string | null;
  sku?: string | null;
  position?: number;
  optionValues?: string[];
  inventoryQty?: number;
  image?: string | null;
  isDefault?: boolean;
  price: ShopMoneySet;
  b2bPrice?: ShopMoneySet;
  compareAt?: ShopMoneySet;
  b2bCompareAt?: ShopMoneySet;
  weightKg?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
};

export type ShopBundleComponentSummary = {
  id: string;
  quantity: number;
  availableQuantity: number;
  variantId?: string | null;
  variantTitle?: string | null;
  product: {
    id: string;
    slug: string;
    scope: ShopScope;
    brand: string;
    image: string;
    title: LocalizedText;
    collection: LocalizedText;
    collections?: ShopProductCollectionLink[];
    tags?: string[];
  };
};

export type ShopBundleSummary = {
  id: string;
  availableQuantity: number;
  items: ShopBundleComponentSummary[];
};

export interface ShopProduct {
  id?: string;
  slug: string;
  sku: string;
  scope: ShopScope;
  brand: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  collections?: ShopProductCollectionLink[];
  title: LocalizedText;
  category: LocalizedText;
  shortDescription: LocalizedText;
  longDescription: LocalizedText;
  leadTime: LocalizedText;
  stock: ShopStock;
  collection: LocalizedText;
  price: ShopMoneySet;
  b2bPrice?: ShopMoneySet;
  compareAt?: ShopMoneySet;
  b2bCompareAt?: ShopMoneySet;
  weightKg?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  image: string;
  gallery?: string[];
  /**
   * Per-image material tag aligned with `gallery` order. Only set on iPE
   * products that have both Titanium and Stainless Steel variants AND a
   * gallery whose original (pre-rebase) filenames hint material. Used by the
   * iPE PDP to filter the gallery to the active variant's material.
   * `'ti' | 'ss' | null` per image.
   */
  galleryMaterials?: Array<"ti" | "ss" | null>;
  highlights: LocalizedText[];
  variants?: ShopProductVariantSummary[];
  categoryNode?: {
    id: string;
    slug: string;
    title: LocalizedText;
  } | null;
  bundle?: ShopBundleSummary | null;
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    slug: "kw-v4-clubsport",
    sku: "OC-KW-V4-G8X",
    scope: "auto",
    brand: "KW Suspension",
    title: { ua: "KW V4 Clubsport", en: "KW V4 Clubsport" },
    category: { ua: "Підвіска", en: "Suspension" },
    shortDescription: {
      ua: "Трек-орієнтована підвіска з точним налаштуванням відбою та стискання.",
      en: "Track-focused suspension with precise rebound and compression control.",
    },
    longDescription: {
      ua: "KW V4 Clubsport для BMW G8X поєднує комфорт міста та стабільність на треку. Комплект включає top-mount опори, широкий діапазон налаштувань і motorsport-геометрію.",
      en: "KW V4 Clubsport for BMW G8X combines road comfort with track stability. Package includes top mounts, extended damping range, and motorsport-grade geometry.",
    },
    leadTime: { ua: "7-10 днів", en: "7-10 days" },
    stock: "inStock",
    collection: { ua: "Street x Track", en: "Street x Track" },
    price: { eur: 3499, usd: 3780, uah: 148900 },
    compareAt: { eur: 3690, usd: 3990, uah: 156200 },
    image: "/images/shop/products/kw-v4-clubsport.jpg",
    gallery: ["/images/shop/products/kw-v4-clubsport.jpg"],
    highlights: [
      { ua: "Налаштування під street і track", en: "Dual setup support for street and track" },
      { ua: "Top-mount опори в комплекті", en: "Top mount kit included" },
      { ua: "Сертифіковано для легального road-use", en: "Certified for legal road use" },
    ],
  },
  {
    slug: "eventuri-carbon-intake-g8x",
    sku: "OC-EVT-G8X-INT",
    scope: "auto",
    brand: "Eventuri",
    title: { ua: "Eventuri Carbon Intake G8X", en: "Eventuri Carbon Intake G8X" },
    category: { ua: "Впуск", en: "Intake" },
    shortDescription: {
      ua: "Карбоновий intake-kit із venturi-геометрією для покращеного airflow.",
      en: "Carbon intake kit with venturi geometry and improved airflow.",
    },
    longDescription: {
      ua: "Eventuri Intake підвищує відгук і стабільність на високих навантаженнях. Ідеально для власників, які хочуть premium-look і технічний результат.",
      en: "Eventuri intake is engineered for response and sustained performance under load. Ideal for owners who want premium aesthetics and technical gains.",
    },
    leadTime: { ua: "10-14 днів", en: "10-14 days" },
    stock: "preOrder",
    collection: { ua: "Carbon Airflow", en: "Carbon Airflow" },
    price: { eur: 1890, usd: 2035, uah: 80400 },
    image: "/images/shop/products/eventuri-carbon-intake-g8x.webp",
    gallery: ["/images/shop/products/eventuri-carbon-intake-g8x.webp"],
    highlights: [
      { ua: "Карбонова архітектура", en: "Carbon architecture" },
      { ua: "Швидший intake-response", en: "Improved intake response" },
      { ua: "Акуратна установка у штатні точки", en: "Clean install using OEM points" },
    ],
  },
  {
    slug: "fi-valvetronic-full-system",
    sku: "OC-FI-VLV-FULL",
    scope: "auto",
    brand: "FI Exhaust",
    title: { ua: "FI Valvetronic Full System", en: "FI Valvetronic Full System" },
    category: { ua: "Вихлоп", en: "Exhaust" },
    shortDescription: {
      ua: "Повна valvetronic-система для керованого звуку і спортивної подачі.",
      en: "Complete valvetronic system for controlled sound and motorsport tone.",
    },
    longDescription: {
      ua: "FI Full System додає глибину звуку, виразну емоцію та преміальне виконання. Режими клапанів дозволяють змінювати характер авто під місто чи активну їзду.",
      en: "FI Full System adds richer tone, stronger emotion, and premium craftsmanship. Valve modes let you tune the character for city and aggressive driving.",
    },
    leadTime: { ua: "14-21 день", en: "14-21 days" },
    stock: "preOrder",
    collection: { ua: "Valvetronic Series", en: "Valvetronic Series" },
    price: { eur: 4999, usd: 5380, uah: 212500 },
    compareAt: { eur: 5290, usd: 5690, uah: 225900 },
    image: "/images/shop/products/fi-valvetronic-full-system.jpg",
    gallery: ["/images/shop/products/fi-valvetronic-full-system.jpg"],
    highlights: [
      { ua: "Керовані звукові клапани", en: "Selectable valve control" },
      { ua: "Преміальна якість зварювання", en: "Premium weld finish" },
      { ua: "Агресивний sport-profile", en: "Active sport profile" },
    ],
  },
  {
    slug: "brembo-gt-big-brake-kit",
    sku: "OC-BRM-GT-6P",
    scope: "auto",
    brand: "Brembo",
    title: { ua: "Brembo GT Big Brake Kit", en: "Brembo GT Big Brake Kit" },
    category: { ua: "Гальма", en: "Brakes" },
    shortDescription: {
      ua: "6-поршневі супорти та вентильовані диски для контрольованого гальмування.",
      en: "6-piston calipers with vented discs for high-confidence braking.",
    },
    longDescription: {
      ua: "GT-kit орієнтований на стабільну роботу під навантаженням і точну дозованість педалі. Добре підходить і для швидкого міста, і для track-day.",
      en: "GT kit is tuned for consistent performance under load and better pedal modulation. Works equally well for fast road and track sessions.",
    },
    leadTime: { ua: "8-12 днів", en: "8-12 days" },
    stock: "inStock",
    collection: { ua: "Brake Authority", en: "Brake Authority" },
    price: { eur: 3120, usd: 3360, uah: 132700 },
    image: "/images/shop/products/brembo-gt-big-brake-kit.jpg",
    highlights: [
      { ua: "6-поршневі супорти", en: "6-piston calipers" },
      { ua: "Підвищена термостійкість", en: "Higher thermal resilience" },
      { ua: "Готовність до track-day", en: "Track-day capable" },
    ],
  },
  {
    slug: "hre-rs200m-forged-wheel-set",
    sku: "OC-HRE-RS200M-20",
    scope: "auto",
    brand: "HRE wheels",
    title: { ua: "HRE RS200M Forged Wheels", en: "HRE RS200M Forged Wheels" },
    category: { ua: "Диски", en: "Wheels" },
    shortDescription: {
      ua: "Кований wheel-set з індивідуальним offset і premium-finish.",
      en: "Forged wheel set with bespoke offset and premium finish.",
    },
    longDescription: {
      ua: "RS200M створений для точного fitment і легкої конструкції. Додає виразний стиль і покращує керованість на швидкості.",
      en: "RS200M targets premium fitment with lightweight construction. It elevates visual identity while sharpening handling feel.",
    },
    leadTime: { ua: "15-25 днів", en: "15-25 days" },
    stock: "preOrder",
    collection: { ua: "Forged Icons", en: "Forged Icons" },
    price: { eur: 4200, usd: 4520, uah: 178600 },
    image: "/images/shop/products/hre-rs200m-forged-wheel-set.png",
    highlights: [
      { ua: "Кована конструкція", en: "Forged construction" },
      { ua: "Підбір fitment під авто", en: "Custom fitment support" },
      { ua: "Преміальний лакофарбовий finish", en: "Premium paint finish" },
    ],
  },
  {
    slug: "termignoni-panigale-full-titanium",
    sku: "OC-TRM-PAN-V4-TI",
    scope: "moto",
    brand: "Termignoni",
    title: { ua: "Termignoni Panigale Full Titanium", en: "Termignoni Panigale Full Titanium" },
    category: { ua: "Мото вихлоп", en: "Moto Exhaust" },
    shortDescription: {
      ua: "Титановий full-system для Panigale з яскравим race-звуком.",
      en: "Titanium full system for Panigale with vivid race character.",
    },
    longDescription: {
      ua: "Система зменшує вагу та додає виразний тон на середніх і високих обертах. Для райдерів, які хочуть чистий спорт-профіль і якісний монтаж.",
      en: "System reduces weight and adds strong tone at mid and high rpm. Built for riders who want a pure race profile and premium installation quality.",
    },
    leadTime: { ua: "7-12 днів", en: "7-12 days" },
    stock: "inStock",
    collection: { ua: "Moto Race Sound", en: "Moto Race Sound" },
    price: { eur: 2540, usd: 2740, uah: 108100 },
    image: "/images/shop/products/termignoni-panigale-full-titanium.jpg",
    highlights: [
      { ua: "Титанова конструкція", en: "Titanium construction" },
      { ua: "Race-profile звучання", en: "Race profile sound" },
      { ua: "Зменшена маса системи", en: "Reduced mass" },
    ],
  },
  {
    slug: "ohlins-fgr-front-fork-kit",
    sku: "OC-OHL-FGR-43",
    scope: "moto",
    brand: "Ohlins",
    title: { ua: "Ohlins FGR Front Fork", en: "Ohlins FGR Front Fork" },
    category: { ua: "Мото підвіска", en: "Moto Suspension" },
    shortDescription: {
      ua: "Професійна передня вилка для точного відгуку і стабільної траєкторії.",
      en: "Professional front fork for sharper response and line control.",
    },
    longDescription: {
      ua: "FGR-kit підвищує стабільність у поворотах та інформативність на гальмуванні. Підійде для спортивної їзди й інтенсивних тренувань.",
      en: "FGR kit improves cornering stability and braking feedback. Designed for sport riding and high-intensity training sessions.",
    },
    leadTime: { ua: "10-16 днів", en: "10-16 days" },
    stock: "preOrder",
    collection: { ua: "Precision Control", en: "Precision Control" },
    price: { eur: 3390, usd: 3660, uah: 144200 },
    image: "/images/shop/products/ohlins-fgr-front-fork-kit.jpg",
    highlights: [
      { ua: "Racing-клас демпфування", en: "Racing-class damping" },
      { ua: "Стабільність під навантаженням", en: "Stable under heavy load" },
      { ua: "Точний кермовий feedback", en: "Clear steering feedback" },
    ],
  },
  {
    slug: "sc-project-race-system-v4",
    sku: "OC-SCP-V4-RACE",
    scope: "moto",
    brand: "SC-Project",
    title: { ua: "SC-Project Race System V4", en: "SC-Project Race System V4" },
    category: { ua: "Мото вихлоп", en: "Moto Exhaust" },
    shortDescription: {
      ua: "Race-вихлоп для V4-платформ із вираженим motorsport-характером.",
      en: "Race exhaust for V4 platforms with motorsport DNA.",
    },
    longDescription: {
      ua: "SC-Project дає агресивний тон і нижчу вагу системи. Рішення для тих, хто хоче максимальної емоції та fitment на рівні race-paddock.",
      en: "SC-Project brings aggressive tone and reduced system weight. Tailored for riders who want maximum emotion and race-paddock fitment quality.",
    },
    leadTime: { ua: "6-9 днів", en: "6-9 days" },
    stock: "inStock",
    collection: { ua: "Track Hero", en: "Track Hero" },
    price: { eur: 2290, usd: 2470, uah: 97400 },
    image: "/images/shop/products/sc-project-race-system-v4.avif",
    highlights: [
      { ua: "Race-геометрія колекторів", en: "Race collector geometry" },
      { ua: "Висока термостійкість", en: "High heat resilience" },
      { ua: "Виразний спортивний тон", en: "Distinctive sport tone" },
    ],
  },
  {
    slug: "rizoma-billet-components-pack",
    sku: "OC-RZM-BILLET-PACK",
    scope: "moto",
    brand: "Rizoma",
    title: { ua: "Rizoma Billet Components Pack", en: "Rizoma Billet Components Pack" },
    category: { ua: "Мото керування", en: "Moto Controls" },
    shortDescription: {
      ua: "Billet-компоненти для кокпіту та точної ергономіки райдера.",
      en: "Billet components for cockpit precision and rider ergonomics.",
    },
    longDescription: {
      ua: "Набір покращує контроль і додає преміальну деталізацію для naked та supersport платформ. Фокус на ергономіці та візуальній чистоті.",
      en: "Pack improves control precision and premium detailing for naked and supersport platforms. Focused on ergonomics and clean design language.",
    },
    leadTime: { ua: "5-8 днів", en: "5-8 days" },
    stock: "inStock",
    collection: { ua: "Billet Atelier", en: "Billet Atelier" },
    price: { eur: 980, usd: 1050, uah: 41700 },
    image: "/images/shop/products/rizoma-billet-components-pack.jpg",
    highlights: [
      { ua: "CNC billet-якість", en: "CNC billet quality" },
      { ua: "Преміальна анодування", en: "Premium anodized finish" },
      { ua: "Покращена ергономіка", en: "Improved ergonomics" },
    ],
  },
  {
    slug: "rotobox-carbon-wheelset",
    sku: "OC-RTB-CARBON-SET",
    scope: "moto",
    brand: "Rotobox",
    title: { ua: "Rotobox Carbon Wheelset", en: "Rotobox Carbon Wheelset" },
    category: { ua: "Мото диски", en: "Moto Wheels" },
    shortDescription: {
      ua: "Карбоновий wheelset для зменшення unsprung-маси.",
      en: "Carbon wheelset to reduce unsprung mass.",
    },
    longDescription: {
      ua: "Rotobox суттєво знижує інерцію коліс, покращуючи маневреність і прискорення. Для райдерів, які відчувають кожну деталь балансу мотоцикла.",
      en: "Rotobox dramatically lowers wheel inertia, improving agility and acceleration. Built for riders who feel every detail of bike balance.",
    },
    leadTime: { ua: "12-18 днів", en: "12-18 days" },
    stock: "preOrder",
    collection: { ua: "Lightweight Motion", en: "Lightweight Motion" },
    price: { eur: 3690, usd: 3980, uah: 156900 },
    compareAt: { eur: 3890, usd: 4190, uah: 164900 },
    image: "/images/shop/products/rotobox-carbon-wheelset.jpeg",
    highlights: [
      { ua: "Низька unsprung-маса", en: "Low unsprung mass" },
      { ua: "Кращий turn-in", en: "Sharper turn-in" },
      { ua: "Преміальний carbon-finish", en: "Premium carbon finish" },
    ],
  },
  {
    slug: "jetprime-race-controls-set",
    sku: "OC-JTP-RACE-CONTROL",
    scope: "moto",
    brand: "Jetprime",
    title: { ua: "Jetprime Race Controls Set", en: "Jetprime Race Controls Set" },
    category: { ua: "Мото електроніка", en: "Moto Electronics" },
    shortDescription: {
      ua: "Race-controls для launch, map-switch і pit-limit функцій.",
      en: "Quick race controls for launch, map and pit-limit operations.",
    },
    longDescription: {
      ua: "Jetprime-set дає швидкий доступ до критичних функцій під час активної їзди. Додає контроль та стабільність без компромісів по надійності.",
      en: "Jetprime set is designed for immediate access to key functions during aggressive riding. Adds control and performance confidence without reliability compromises.",
    },
    leadTime: { ua: "9-13 днів", en: "9-13 days" },
    stock: "inStock",
    collection: { ua: "Rider Interface", en: "Rider Interface" },
    price: { eur: 720, usd: 780, uah: 30600 },
    image: "/images/shop/products/jetprime-race-controls-set.jpg",
    highlights: [
      { ua: "Race-ready ергономіка", en: "Race-ready ergonomics" },
      { ua: "Швидке перемикання map", en: "Fast map switching" },
      { ua: "Надійна електронна частина", en: "Reliable electronics" },
    ],
  },
];

export function getShopProductBySlug(slug: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((product) => product.slug === slug);
}

export function getShopProductsByScope(scope: "all" | ShopScope): ShopProduct[] {
  if (scope === "all") {
    return SHOP_PRODUCTS;
  }

  return SHOP_PRODUCTS.filter((product) => product.scope === scope);
}
