export const EVENTURI_SHARED_V8_INTAKE_SKU = "EVE-4V8TT-CF-INT";

export const EVENTURI_SHARED_V8_INTAKE_SLUG =
  "4-0tfsi-twin-turbo-v8-black-carbon-intake-system";

export const EVENTURI_SHARED_V8_INTAKE_SLUGS = Object.freeze([
  EVENTURI_SHARED_V8_INTAKE_SLUG,
  "eventuri-bentley-bentayga-carbon-intake-2019",
  "eventuri-lamborghini-urus-carbon-intake",
  "eventuri-porsche-cayenne-carbon-intake",
]);

export const EVENTURI_SHARED_V8_INTAKE_LEGACY_SLUGS = Object.freeze(
  EVENTURI_SHARED_V8_INTAKE_SLUGS.filter((slug) => slug !== EVENTURI_SHARED_V8_INTAKE_SLUG)
);

export const EVENTURI_SHARED_V8_INTAKE_COPY = {
  titleUa:
    "Карбонова впускна система Eventuri 4.0 V8 для Audi, Lamborghini, Porsche та Bentley",
  titleEn:
    "Eventuri 4.0 V8 carbon intake for Audi, Lamborghini, Porsche and Bentley",
  shortDescUa:
    "Єдина карбонова впускна система Eventuri для 4.0 V8: Audi RSQ8 / SQ8 / SQ7, Lamborghini Urus, Porsche Cayenne та Bentley Bentayga.",
  shortDescEn:
    "One Eventuri carbon intake system for the 4.0 V8: Audi RSQ8 / SQ8 / SQ7, Lamborghini Urus, Porsche Cayenne and Bentley Bentayga.",
  longDescUa:
    "Повна карбонова впускна система Eventuri для автомобілів платформи 4.0 V8 twin-turbo: Audi RSQ8, SQ8 і SQ7, Lamborghini Urus, Porsche Cayenne та Bentley Bentayga. Великі препрег-карбонові корпуси, високопродуктивні фільтри та плавні повітроводи зменшують опір на шляху до обох турбін, стабілізують подачу холодного повітря й покращують відгук двигуна. Комплект розроблений як цілісна система з точною посадкою та акуратною інтеграцією у штатний моторний відсік. Перед замовленням сумісність звіряється за моделлю, роком випуску та конфігурацією двигуна.",
  longDescEn:
    "A complete Eventuri carbon intake system for 4.0 V8 twin-turbo applications: Audi RSQ8, SQ8 and SQ7, Lamborghini Urus, Porsche Cayenne and Bentley Bentayga. Large pre-preg carbon housings, high-flow filters and smooth intake ducts reduce restriction to both turbochargers, stabilize the cold-air supply and improve engine response. The components are engineered as one integrated system for precise fitment and a clean factory-style installation. Compatibility should be confirmed by model, production year and engine configuration before ordering.",
} as const;

export function isEventuriSharedV8Intake(
  sku: string | null | undefined
): boolean {
  return sku?.trim().toUpperCase() === EVENTURI_SHARED_V8_INTAKE_SKU;
}

export function matchesEventuriSharedV8Application(
  make: string | null | undefined,
  model: string | null | undefined
): boolean {
  const normalizedMake = make?.trim().toLowerCase() ?? "";
  const normalizedModel = model?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const applications: Record<string, ReadonlySet<string>> = {
    audi: new Set(["q8", "sq7", "sq8", "rsq8"]),
    lamborghini: new Set(["urus"]),
    porsche: new Set(["cayenne"]),
    bentley: new Set(["bentayga"]),
  };
  const models = applications[normalizedMake];
  return Boolean(models && (!normalizedModel || models.has(normalizedModel)));
}
