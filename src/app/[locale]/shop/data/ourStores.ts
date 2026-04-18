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
  /** true = магазин тимчасово прихований (для релізів) */
  isHidden?: boolean;
  /** URL зображення для картки магазину */
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
    imageUrl: "/images/shop/brabus/hq/brabus-portal-hero.png",
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
    id: "akrapovic",
    name: "Akrapovič",
    nameUk: "Akrapovič",
    description: "Hand-crafted titanium & carbon fibre exhaust systems. The sound of perfection since 1990.",
    descriptionUk: "Титанові та карбонові вихлопні системи ручної роботи. Звук досконалості з 1990 року.",
    href: "/shop/akrapovic",
    imageUrl: "/images/shop/akrapovic/hero-fallback.jpg",
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
    id: "csf",
    name: "CSF Racing",
    nameUk: "CSF Racing",
    description: "High-performance aluminum radiators, intercoolers, and oil coolers engineered for maximum heat dissipation.",
    descriptionUk: "Високопродуктивні алюмінієві радіатори, інтеркулери та масляні охолоджувачі, спроєктовані для максимального розсіювання тепла.",
    href: "/shop/csf",
    imageUrl: "/images/shop/csf/hero-fallback.jpg",
  },
  {
    id: "ohlins",
    name: "Öhlins",
    nameUk: "Öhlins",
    description: "Advanced suspension technology. Championship-winning dampers for the world's most demanding drivers.",
    descriptionUk: "Передові технології підвіски. Чемпіонські амортизатори для найвимогливіших водіїв у світі.",
    href: "/shop/ohlins",
    imageUrl: "/images/shop/ohlins/hero-fallback.jpg",
  },
  {
    id: "girodisc",
    name: "GiroDisc",
    nameUk: "GiroDisc",
    description: "High-performance floating 2-piece brake rotors engineered for the track and street.",
    descriptionUk: "Високопродуктивні плаваючі 2-складові гальмівні диски, розроблені для треку та вулиці.",
    href: "/shop/girodisc",
    imageUrl: "/images/shop/girodisc/girodisc-hero.jpg",
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
  {
    id: "ipe",
    name: "iPE Exhaust",
    nameUk: "iPE Exhaust",
    description:
      "Innotech Performance Exhaust. Hand-crafted, F1-inspired valvetronic titanium systems.",
    descriptionUk:
      "Innotech Performance Exhaust. Вихлопні системи ручної роботи з титану з фірмовим F1-звучанням.",
    href: "/shop/ipe",
    imageUrl: "/images/shop/ipe/ipe-porsche-gt3.jpg",
  },
  {
    id: "adro",
    name: "ADRO",
    nameUk: "ADRO",
    description:
      "Premium prepreg carbon fiber aerokits with F1-level CFD engineering. Not for everybody.",
    descriptionUk:
      "Преміальні аерокіти з препрег-карбону з CFD-інженерією рівня F1. Не для всіх.",
    href: "/shop/adro",
    imageUrl: "/images/shop/adro/adro-hero-m4.jpg",
  },
];
