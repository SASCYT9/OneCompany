export type OpsShippingEstimate = {
  key: string;
  label: string;
  amountUsd: number;
  terms: string[];
  note?: string;
};

/**
 * Historical USA → Ukraine body-part references from the verified legacy
 * pricing helper. They are intentionally estimates, never checkout totals.
 */
export const OPS_USA_UA_SHIPPING_ESTIMATES: OpsShippingEstimate[] = [
  { key: "front-lip", label: "Губа / сплиттер", amountUsd: 125, terms: ["губа", "сплиттер", "splitter", "front lip"] },
  { key: "diffuser", label: "Диффузор", amountUsd: 145, terms: ["диффузор", "дифузор", "diffuser"] },
  { key: "side-skirts", label: "Пороги", amountUsd: 165, terms: ["пороги", "side skirt", "side skirts"] },
  {
    key: "small-carbon",
    label: "Канарды / зеркала / мелкие вставки",
    amountUsd: 25,
    terms: ["канард", "canard", "зеркал", "дзеркал", "mirror cap", "вставк", "insert"],
  },
  { key: "bumper", label: "Бампер", amountUsd: 275, terms: ["бампер", "bumper"] },
  { key: "small-spoiler", label: "Малый спойлер", amountUsd: 55, terms: ["малый спойлер", "спойлер мал", "small spoiler", "lip spoiler"] },
  { key: "roof-spoiler", label: "Спойлер на крышу", amountUsd: 110, terms: ["спойлер на крыш", "спойлер на дах", "roof spoiler"] },
  { key: "large-wing", label: "Большое антикрыло", amountUsd: 200, terms: ["антикрыло", "антикрило", "large wing"] },
  { key: "extra-large-wing", label: "Очень большое антикрыло", amountUsd: 245, terms: ["очень большое антикрыло", "дуже велике антикрило", "extra large wing"] },
  { key: "hood", label: "Капот", amountUsd: 365, terms: ["капот", "hood", "bonnet"] },
  {
    key: "performance-speed-shop-hood",
    label: "Капот Performance Speed Shop",
    amountUsd: 485,
    terms: ["performance speed shop капот", "performance speed shop hood"],
  },
  { key: "winglets", label: "Винглеты", amountUsd: 45, terms: ["винглет", "winglet"] },
  { key: "grille", label: "Решётка / гриль", amountUsd: 65, terms: ["решетк", "решётк", "гриль", "grille", "grill"] },
];

export const OPS_FORGED_WHEEL_SHIPPING_ESTIMATES = [
  { size: "R17", amountUsd: 485 },
  { size: "R18", amountUsd: 535 },
  { size: "R19", amountUsd: 585 },
  { size: "R20", amountUsd: 730 },
  { size: "R21", amountUsd: 775 },
  { size: "R22", amountUsd: 825 },
  { size: "R23", amountUsd: 920 },
  { size: "R24", amountUsd: 1020 },
] as const;

export const OPS_SHIPPING_REFERENCE_SLUG = "product-shipping-reference";

export const OPS_UK_UA_SHIPPING_ROUTE = {
  key: "uk-london-medyka-ua",
  slug: "uk-shipping-route",
  label: "Великобритания → Medyka → Украина",
  warehouseCode: "UK_LONDON_W7",
  destinationReference: "UK-LONDON-W7-01",
  formula:
    "Цена сайта + 15% + доставка на адрес в Великобритании + доставка в Medyka + объёмная доставка в Украину",
  steps: [
    "Проверить цену сайта и наличие.",
    "Добавить 15%.",
    "Добавить доставку по Великобритании на склад UK-LONDON-W7-01.",
    "Добавить доставку из Великобритании в Medyka.",
    "Добавить объёмную доставку из Medyka в Украину.",
  ],
  terms: [
    "британия",
    "британии",
    "великобритания",
    "великобритании",
    "англия",
    "united kingdom",
    "england",
    "london",
    "uk",
  ],
} as const;

