/**
 * Our stores — реальні магазини One Company.
 * Дані узгоджені з брендами (lib/brands.ts) та hero-секціями (StoreHeroSection).
 * Urban — наш власний магазин на сайті (/shop/urban). Інші — офіційні магазини партнерів (зовнішні посилання).
 */

export type OurStore = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  /** Відносний шлях (наш сайт) або повний URL (зовнішній) */
  href: string;
  /** true = зовнішній магазин (відкривати в новій вкладці) */
  external?: boolean;
  imageUrl?: string;
};

/** Список магазинів. Для Urban href будуємо як /{locale}/shop/urban, для інших — з поля href. */
export const OUR_STORES: OurStore[] = [
  {
    id: "urban",
    name: "Urban Automotive",
    nameUk: "Urban Automotive",
    description:
      "Premium body kits and styling. Official Urban supplier in Ukraine.",
    descriptionUk:
      "Преміальні обвіси та стилізація. Офіційний постачальник Urban в Україні.",
    href: "",
    imageUrl: "/images/shop/urban/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp",
  },
  {
    id: "do88",
    name: "DO88 Performance",
    nameUk: "DO88 Performance",
    description:
      "Premium cooling systems, intercoolers, and silicone hoses engineered in Sweden.",
    descriptionUk:
      "Преміальні системи охолодження, інтеркулери та силіконові патрубки розроблені у Швеції.",
    href: "/shop/do88",
    imageUrl: "/branding/do88/do88_car_hero_m4_drift_1774441428540.png",
  },
  {
    id: "brabus",
    name: "Brabus",
    nameUk: "Brabus",
    description:
      "Premium tuning and lifestyle. Official Brabus supplier in Ukraine.",
    descriptionUk:
      "Преміальний тюнінг та стиль життя. Офіційний постачальник Brabus в Україні.",
    href: "/shop/brabus",
    imageUrl: "/images/shop/brabus/hq/brabus-supercars-29.jpg",
  },
  {
    id: "burger",
    name: "Burger Motorsports",
    nameUk: "Burger Motorsports",
    description: "World-famous plug & play performance tuning since 2007. JB4 tuners, flex fuel kits, and precision parts.",
    descriptionUk: "Всесвітньо відомий plug & play performance тюнінг з 2007 року. JB4 тюнери та високоточні деталі.",
    href: "/shop/burger",
    imageUrl: "/images/shop/burger/hero-engine.jpg",
  },
  {
    id: "racechip",
    name: "RaceChip",
    nameUk: "RaceChip",
    description: "Premium ECU tuning modules with App Control. GTS 5 chip tuning for 50+ vehicle brands.",
    descriptionUk: "Преміальні ECU тюнінг-модулі з App Control. GTS 5 чіп-тюнінг для 50+ марок авто.",
    href: "/shop/racechip",
    imageUrl: "/images/shop/racechip/hero-racechip.jpg",
  },
  {
    id: "kw",
    name: "KW Suspension",
    nameUk: "KW Suspension",
    description:
      "German suspension engineering. Adjustable coilovers trusted by motorsport worldwide.",
    descriptionUk:
      "Німецька інженерія підвісок. Регульовані койловери, яким довіряють у автоспорті.",
    href: "https://kwsuspension.shop",
    external: true,
    // Один продукт — KW V4 Clubsport, чистий кадр без композиту
    imageUrl: "/images/shop/stores/kw-suspension-coilovers.png",
  },
  {
    id: "fi",
    name: "FI Exhaust",
    nameUk: "FI Exhaust",
    description:
      "Valvetronic exhaust systems and distinctive sound for exotic vehicles.",
    descriptionUk:
      "Керовані вихлопні системи з фірмовим звучанням для преміальних спортивних авто.",
    href: "https://fiexhaust.shop",
    external: true,
    // Офіційне фото — Lamborghini Revuelto Valvetronic Muffler (збережено локально)
    imageUrl: "/images/shop/stores/fi-reveulto-valvetronic-exhaust.webp",
  },
  {
    id: "eventuri",
    name: "Eventuri",
    nameUk: "Eventuri",
    description:
      "Carbon fiber intake systems. Maximum airflow and track-proven performance.",
    descriptionUk:
      "Карбонові впускні системи. Максимальний повітряний потік та перевірена на треку продуктивність.",
    href: "https://eventuri.shop",
    external: true,
    // Карбоновий впуск з каталогу — BMW G8X, виразний продукт
    imageUrl: "/images/shop/products/eventuri-carbon-intake-g8x.webp",
  },
];
