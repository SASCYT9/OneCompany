export const SHOP_WAREHOUSE_IN_STOCK_EVENTURI_SKUS = [
  "EVE-G9X-CF-INT",
  "EVE-G9X-CF-CHG",
  "EVE-F9XM5M8-CF-INT",
  "EVE-F9XM5M8-CHG",
  "EVE-X56M-CHG",
  "EVE-G8XMV2-CF-INT",
  "EVE-G8XM-CF-SC",
  "EVE-4V8TT-CF-INT",
  "EVE-AMGGT-CF-INT",
  "EVE-W192-FTR",
  "EVE-FLC",
] as const;

export const SHOP_WAREHOUSE_IN_STOCK_KW_SKUS = [
  "253200EB",
  "253200CC",
  "253200ED",
  "253200CW",
  "2532500Y",
  "253200GG",
] as const;

export const SHOP_WAREHOUSE_IN_STOCK_SKUS = [
  ...SHOP_WAREHOUSE_IN_STOCK_EVENTURI_SKUS,
  ...SHOP_WAREHOUSE_IN_STOCK_KW_SKUS,
  "0WX595-NVNM0-2",
] as const;

export const SHOP_WAREHOUSE_IN_STOCK_SLUGS = [
  "ipe-bmw-x5m-x6m-f95-f96-exhaust-system",
] as const;

const normalizeWarehouseSku = (value: string | null | undefined) =>
  value?.trim().toUpperCase() ?? "";

const warehouseSkuSet = new Set<string>(SHOP_WAREHOUSE_IN_STOCK_SKUS);
const warehouseSlugSet = new Set<string>(SHOP_WAREHOUSE_IN_STOCK_SLUGS);

const warehouseHeroImageBySku: Readonly<Record<string, string>> = {
  "EVE-G9X-CF-CHG": "/images/shop/eventuri/eve-g9x-cf-chg-hero.jpg",
  "EVE-W192-FTR": "/images/shop/eventuri/eve-w192-ftr-hero.jpg",
};

type WarehouseProductCopy = {
  title: { ua: string; en: string };
  description: { ua: string; en: string };
};

const warehouseProductCopyBySku: Record<string, WarehouseProductCopy> = {
  "EVE-G9X-CF-INT": {
    title: { ua: "Карбонова впускна система для BMW M5 G90 / G99", en: "Carbon intake system for BMW M5 G90 / G99" },
    description: { ua: "Повний карбоновий впуск для нового BMW M5 із двигуном S68: точна посадка, швидший відгук і виразніший звук.", en: "A complete carbon intake for the new S68-powered BMW M5, engineered for precise fitment, sharper response and a richer sound." },
  },
  "EVE-G9X-CF-CHG": {
    title: { ua: "Карбонові турбоінлети для BMW M5 G90 / G99", en: "Carbon turbo inlets for BMW M5 G90 / G99" },
    description: { ua: "Комплект турбоінлетів із препрег-карбону для двигуна S68, створений для вільнішого потоку повітря до турбін.", en: "Pre-preg carbon turbo inlets for the S68 engine, designed to deliver a cleaner, less restricted airflow path to the turbos." },
  },
  "EVE-F9XM5M8-CF-INT": {
    title: { ua: "Карбонова впускна система V2 для BMW M5 F90 / M8 F9X", en: "V2 carbon intake for BMW M5 F90 / M8 F9X" },
    description: { ua: "Друге покоління впуску Eventuri з оптимізованими повітроводами для стабільного потоку, нижчих температур і насиченого звуку.", en: "Eventuri's second-generation intake with optimized ducts for stable airflow, lower temperatures and a more purposeful induction sound." },
  },
  "EVE-F9XM5M8-CHG": {
    title: { ua: "Карбонові турбоінлети для BMW M5 F90 / M8 F9X", en: "Carbon turbo inlets for BMW M5 F90 / M8 F9X" },
    description: { ua: "Прямі карбонові канали до турбін зменшують опір і доповнюють штатну або Eventuri впускну систему.", en: "Direct carbon airflow paths reduce restriction at the turbos and complement either the factory or Eventuri intake system." },
  },
  "EVE-X56M-CHG": {
    title: { ua: "Карбонові турбоінлети для BMW X5 M F95 / X6 M F96", en: "Carbon turbo inlets for BMW X5 M F95 / X6 M F96" },
    description: { ua: "Точні препрег-карбонові інлети для S63, розраховані на штатні й тюнінговані конфігурації до рестайлінгу.", en: "Precision pre-preg carbon inlets for the S63, developed for stock and tuned pre-LCI applications." },
  },
  "EVE-G8XMV2-CF-INT": {
    title: { ua: "Карбонова впускна система V2 для BMW M2 G87 / M3 G8X / M4 G8X", en: "V2 carbon intake for BMW M2 G87 / M3 G8X / M4 G8X" },
    description: { ua: "Флагманський впуск Eventuri для двигуна S58 з великими фільтрами, карбоновими корпусами та продуманим холодним потоком.", en: "Eventuri's flagship S58 intake with large filters, carbon housings and a carefully managed cold-air path." },
  },
  "EVE-G8XM-CF-SC": {
    title: { ua: "Карбонові повітрозабірники для BMW M3 G8X / M4 G8X", en: "Carbon air scoops for BMW M3 G8X / M4 G8X" },
    description: { ua: "Комплект карбонових направляючих, що подає більше зовнішнього повітря до впускної системи та акуратно інтегрується за решіткою.", en: "Carbon air guides that channel more outside air toward the intake system while integrating neatly behind the grille." },
  },
  "EVE-4V8TT-CF-INT": {
    title: { ua: "Карбонова впускна система для Audi RSQ8 / Lamborghini Urus", en: "Carbon intake for Audi RSQ8 / Lamborghini Urus" },
    description: { ua: "Високопродуктивний впуск для 4.0 TFSI V8 із великими карбоновими каналами та оптимізованою подачею повітря до двох турбін.", en: "A high-performance 4.0 TFSI V8 intake with large carbon ducts and optimized airflow to both turbochargers." },
  },
  "EVE-AMGGT-CF-INT": {
    title: { ua: "Карбонова впускна система для Mercedes-AMG GT C190 / R190", en: "Carbon intake for Mercedes-AMG GT C190 / R190" },
    description: { ua: "Повний карбоновий впуск для AMG GT, GTS і GTR із точним компонуванням, ефективним потоком і виразною презентацією під капотом.", en: "A complete carbon intake for AMG GT, GTS and GTR with precise packaging, efficient airflow and a striking engine-bay presentation." },
  },
  "EVE-W192-FTR": {
    title: { ua: "Змінний повітряний фільтр Eventuri Type D2", en: "Eventuri Type D2 replacement air filter" },
    description: { ua: "Оригінальний сухий фільтрувальний елемент Type D2 для планового обслуговування сумісних впускних систем Eventuri.", en: "A genuine dry Type D2 filter element for routine servicing of compatible Eventuri intake systems." },
  },
  "EVE-FLC": {
    title: { ua: "Набір для очищення фільтрів Eventuri", en: "Eventuri air-filter cleaning kit" },
    description: { ua: "Фірмовий комплект для делікатного очищення та відновлення багаторазових повітряних фільтрів Eventuri.", en: "The genuine care kit for safely cleaning and refreshing reusable Eventuri air filters." },
  },
  "253200EB": {
    title: { ua: "Регульовані пружини KW HAS для BMW M3 / M4 G8X", en: "KW HAS adjustable springs for BMW M3 / M4 G8X" },
    description: { ua: "Комплект пружин KW Height Adjustable Spring для BMW M3 та M4 покоління G8X із регулюванням висоти та збереженням штатної логіки підвіски.", en: "KW Height Adjustable Spring kit for the G8X BMW M3 and M4, with adjustable ride height while retaining the factory suspension layout." },
  },
  "253200CC": {
    title: { ua: "Регульовані пружини KW HAS для BMW M5 F90", en: "KW HAS adjustable springs for BMW M5 F90" },
    description: { ua: "Комплект регульованих за висотою пружин KW HAS для BMW M5 F90, створений для точного налаштування посадки автомобіля.", en: "KW HAS height-adjustable spring kit for the BMW M5 F90, designed for precise control of the vehicle's ride height and stance." },
  },
  "253200ED": {
    title: { ua: "Регульовані пружини KW HAS для BMW X5 M F95 / X6 M F96", en: "KW HAS adjustable springs for BMW X5 M F95 / X6 M F96" },
    description: { ua: "Комплект пружин KW HAS для BMW X5 M F95 та X6 M F96 із можливістю індивідуального регулювання висоти підвіски.", en: "KW HAS spring kit for the BMW X5 M F95 and X6 M F96, providing individual adjustment of the suspension ride height." },
  },
  "253200CW": {
    title: { ua: "Регульовані пружини KW HAS для BMW M8 F92 / F93", en: "KW HAS adjustable springs for BMW M8 F92 / F93" },
    description: { ua: "Комплект регульованих пружин KW HAS для BMW M8 Coupe F92 та Cabriolet F93 для точної й акуратної зміни висоти автомобіля.", en: "KW HAS adjustable spring kit for the BMW M8 Coupe F92 and Convertible F93, enabling a precise and balanced ride-height adjustment." },
  },
  "2532500Y": {
    title: { ua: "Регульовані пружини KW HAS для Mercedes-AMG G 63", en: "KW HAS adjustable springs for Mercedes-AMG G 63" },
    description: { ua: "Комплект регульованих за висотою пружин KW HAS для Mercedes-AMG G 63 зі збереженням продуманої заводської архітектури підвіски.", en: "KW HAS height-adjustable spring kit for the Mercedes-AMG G 63, engineered around the vehicle's original suspension architecture." },
  },
  "253200GG": {
    title: { ua: "Регульовані пружини KW HAS для BMW M5 G90", en: "KW HAS adjustable springs for BMW M5 G90" },
    description: { ua: "Комплект пружин KW Height Adjustable Spring для нового BMW M5 G90 із регулюванням висоти та точною відповідністю платформі.", en: "KW Height Adjustable Spring kit for the new BMW M5 G90, offering adjustable ride height and platform-specific fitment." },
  },
};

const warehouseProductCopyBySlug: Readonly<Record<string, WarehouseProductCopy>> = {
  "ipe-bmw-x5m-x6m-f95-f96-exhaust-system": {
    title: {
      ua: "Клапанна вихлопна система iPE для BMW X5 M F95 / X6 M F96 LCI",
      en: "iPE valvetronic exhaust for BMW X5 M F95 / X6 M F96 LCI",
    },
    description: {
      ua: "Повна клапанна система iPE з нержавіючої сталі T304 для рестайлінгових BMW X5 M та X6 M: керований звук, точна посадка й комплектна конфігурація cat-back.",
      en: "A complete T304 stainless-steel iPE valvetronic system for the LCI BMW X5 M and X6 M, with controllable sound, precise fitment and a full cat-back configuration.",
    },
  },
};

warehouseProductCopyBySku["0WX595-NVNM0-2"] = warehouseProductCopyBySlug["ipe-bmw-x5m-x6m-f95-f96-exhaust-system"];

export const isShopWarehouseInStockSku = (value: string | null | undefined) =>
  warehouseSkuSet.has(normalizeWarehouseSku(value));

export const isShopWarehouseInStockProduct = (
  sku: string | null | undefined,
  slug: string | null | undefined
) => isShopWarehouseInStockSku(sku) || warehouseSlugSet.has(slug?.trim().toLowerCase() ?? "");

export const getShopWarehouseStockStatus = (value: string | null | undefined) =>
  isShopWarehouseInStockSku(value) ? ("inStock" as const) : ("preOrder" as const);

export const resolveShopWarehouseHeroImage = (
  sku: string | null | undefined,
  fallback: string | null
) => warehouseHeroImageBySku[normalizeWarehouseSku(sku)] ?? fallback;

export const resolveShopWarehouseProductCopy = (
  sku: string | null | undefined,
  locale: "ua" | "en",
  fallback: { title: string; description: string },
  slug?: string | null
) => {
  const copy =
    warehouseProductCopyBySku[normalizeWarehouseSku(sku)] ??
    warehouseProductCopyBySlug[slug?.trim().toLowerCase() ?? ""];
  return copy
    ? { title: copy.title[locale], description: copy.description[locale] }
    : fallback;
};
