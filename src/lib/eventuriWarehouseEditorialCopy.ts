export type EventuriWarehouseEditorialCopy = {
  sku: string;
  titleUa: string;
  titleEn: string;
  shortDescUa: string;
  shortDescEn: string;
  longDescUa: string;
  longDescEn: string;
};

const intake = (sku: string, fitmentUa: string, fitmentEn: string): EventuriWarehouseEditorialCopy => ({
  sku,
  titleUa: `Карбонова впускна система Eventuri для ${fitmentUa}`,
  titleEn: `Eventuri carbon intake system for ${fitmentEn}`,
  shortDescUa: `Карбонова впускна система Eventuri для ${fitmentUa} з оптимізованою подачею холодного повітря.`,
  shortDescEn: `Eventuri carbon intake system for ${fitmentEn}, engineered for an optimized cold-air path.`,
  longDescUa: `Повна впускна система Eventuri для ${fitmentUa}. Карбонові корпуси та повітроводи формують плавний, менш обмежений потік повітря й зберігають точну сумісність із зазначеною моделлю.`,
  longDescEn: `A complete Eventuri intake system for ${fitmentEn}. Carbon housings and ducts create a smooth, less restrictive airflow path while preserving precise model-specific fitment.`,
});

const inlets = (sku: string, fitmentUa: string, fitmentEn: string): EventuriWarehouseEditorialCopy => ({
  sku,
  titleUa: `Карбонові турбоінлети Eventuri для ${fitmentUa}`,
  titleEn: `Eventuri carbon turbo inlets for ${fitmentEn}`,
  shortDescUa: `Комплект карбонових турбоінлетів Eventuri для ${fitmentUa}, створений для вільнішої подачі повітря до турбін.`,
  shortDescEn: `Eventuri carbon turbo inlet set for ${fitmentEn}, designed for a less restricted airflow path to the turbos.`,
  longDescUa: `Модельний комплект турбоінлетів Eventuri для ${fitmentUa}. Геометрія каналів зменшує опір перед турбінами, а препрег-карбон забезпечує точну посадку та акуратну інтеграцію під капотом.`,
  longDescEn: `A model-specific Eventuri turbo inlet set for ${fitmentEn}. The duct geometry reduces restriction before the turbos, while pre-preg carbon provides precise fitment and clean engine-bay integration.`,
});

export const EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG = {
  "4-0tfsi-twin-turbo-v8-black-carbon-intake-system": intake("EVE-4V8TT-CF-INT", "Audi RSQ8 (2019–2024)", "Audi RSQ8 (2019–2024)"),
  "eventuri-bentley-bentayga-carbon-intake-2019": intake("EVE-4V8TT-CF-INT", "Bentley Bentayga 4.0 V8", "Bentley Bentayga 4.0 V8"),
  "eventuri-lamborghini-urus-carbon-intake": intake("EVE-4V8TT-CF-INT", "Lamborghini Urus 4.0 V8", "Lamborghini Urus 4.0 V8"),
  "eventuri-porsche-cayenne-carbon-intake": intake("EVE-4V8TT-CF-INT", "Porsche Cayenne 4.0 V8", "Porsche Cayenne 4.0 V8"),
  "c190-r190-amg-gt-black-carbon-intake-engine-cover-gloss": {
    ...intake("EVE-AMGGT-CF-INT", "Mercedes-AMG GT C190 / R190", "Mercedes-AMG GT C190 / R190"),
    titleUa: "Карбоновий впуск Eventuri для Mercedes-AMG GT C190 / R190 — глянець",
    titleEn: "Eventuri carbon intake for Mercedes-AMG GT C190 / R190 — gloss",
  },
  "c190-r190-amg-gt-black-carbon-intake-engine-cover-matte": {
    ...intake("EVE-AMGGT-CF-INT", "Mercedes-AMG GT C190 / R190", "Mercedes-AMG GT C190 / R190"),
    titleUa: "Карбоновий впуск Eventuri для Mercedes-AMG GT C190 / R190 — матовий",
    titleEn: "Eventuri carbon intake for Mercedes-AMG GT C190 / R190 — matte",
  },
  "f90-m5-black-carbon-intake-v2": intake("EVE-F9XM5M8-CF-INT", "BMW M5 F90 / M8 F9X — V2", "BMW M5 F90 / M8 F9X — V2"),
  "bmw-f90-m5-f9x-m8-carbon-turbo-inlet-set": inlets("EVE-F9XM5M8-CHG", "BMW M5 F90 / M8 F9X", "BMW M5 F90 / M8 F9X"),
  "air-filter-cleaning-kit": {
    sku: "EVE-FLC",
    titleUa: "Набір Eventuri для очищення повітряних фільтрів",
    titleEn: "Eventuri air filter cleaning kit",
    shortDescUa: "Фірмовий комплект для очищення та догляду за багаторазовими повітряними фільтрами Eventuri.",
    shortDescEn: "Genuine care kit for cleaning and maintaining reusable Eventuri air filters.",
    longDescUa: "Комплект Eventuri для планового обслуговування багаторазових фільтрів. Допомагає коректно очистити фільтрувальний елемент і підтримувати його робочий стан без заміни справного фільтра.",
    longDescEn: "An Eventuri service kit for routine maintenance of reusable filters. It helps clean the filter element correctly and maintain its condition without replacing a serviceable filter.",
  },
  "g8x-m3-m4-black-carbon-intake-scoop-set-gloss": {
    sku: "EVE-G8XM-CF-SC",
    titleUa: "Карбонові повітрозабірники Eventuri для BMW M3 G8X / M4 G8X",
    titleEn: "Eventuri carbon air scoops for BMW M3 G8X / M4 G8X",
    shortDescUa: "Карбонові направляючі Eventuri для подачі зовнішнього повітря до впускної системи BMW M3 G8X / M4 G8X.",
    shortDescEn: "Eventuri carbon air guides that channel outside air toward the BMW M3 G8X / M4 G8X intake system.",
    longDescUa: "Модельний комплект карбонових повітрозабірників для BMW M3 G8X / M4 G8X. Елементи встановлюються за решіткою та спрямовують зовнішнє повітря до впускної системи.",
    longDescEn: "A model-specific carbon air scoop set for BMW M3 G8X / M4 G8X. The parts install behind the grille and guide outside air toward the intake system.",
  },
  "g8x-m3-m4-m3cs-m4csl-black-carbon-intake-gloss": intake("EVE-G8XMV2-CF-INT", "BMW M2 G87 / M3 G8X / M4 G8X — V2", "BMW M2 G87 / M3 G8X / M4 G8X — V2"),
  "bmw-g90-g99-m5-s68-carbon-turbo-inlet-set": inlets("EVE-G9X-CF-CHG", "BMW M5 G90 / G99 (S68)", "BMW M5 G90 / G99 (S68)"),
  "eventuri-bmw-g90-g99-m5-intake-system": intake("EVE-G9X-CF-INT", "BMW M5 G90 / G99 (S68)", "BMW M5 G90 / G99 (S68)"),
  "eventuri-carbon-intake-system-replacement-filter-type-d2": {
    sku: "EVE-W192-FTR",
    titleUa: "Змінний повітряний фільтр Eventuri Type D2",
    titleEn: "Eventuri Type D2 replacement air filter",
    shortDescUa: "Оригінальний сухий фільтр Type D2 для сумісних карбонових впускних систем Eventuri.",
    shortDescEn: "Genuine dry Type D2 replacement filter for compatible Eventuri carbon intake systems.",
    longDescUa: "Оригінальний змінний фільтрувальний елемент Eventuri Type D2. Призначений для планового обслуговування сумісних впускних систем і відновлення належного повітряного потоку.",
    longDescEn: "A genuine Eventuri Type D2 replacement filter element. Intended for routine servicing of compatible intake systems and restoring the correct airflow.",
  },
  "f95-x5m-f96-x6m-g09-xm-m60i-carbon-turbo-inlet-set-pre-lci": inlets("EVE-X56M-CHG", "BMW X5 M F95 / X6 M F96 до рестайлінгу", "pre-LCI BMW X5 M F95 / X6 M F96"),
} as const satisfies Readonly<Record<string, EventuriWarehouseEditorialCopy>>;

export const EVENTURI_WAREHOUSE_EDITORIAL_SLUGS = Object.freeze(
  Object.keys(EVENTURI_WAREHOUSE_EDITORIAL_BY_SLUG)
);
