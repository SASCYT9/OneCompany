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
    id: "ind",
    name: "IND Distribution",
    nameUk: "IND Distribution",
    description:
      "Premium BMW parts and accessories. Curated catalog of performance upgrades.",
    descriptionUk:
      "Преміальні запчастини та аксесуари BMW. Каталог продуктів для покращення продуктивності.",
    href: "/shop/stock?source=local",
    imageUrl: "/images/shop/urban/banners/home/webp/urban-automotive-widetrack-defender-grey-1920.webp",
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
    imageUrl: "/images/shop/products/kw-v4-clubsport.jpg",
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
