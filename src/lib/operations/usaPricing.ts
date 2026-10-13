/**
 * One Company price formula for goods bought in the USA (agreed 03.09.2026):
 *
 *   (item price + shipping inside the USA) × 1.20 + $9 × weight (kg)
 *
 * - 20 % is our markup, charged on the item together with US shipping;
 * - US shipping is to Brooklyn, New York, ZIP 11223;
 * - $9/kg (USA → Kyiv) is added after the markup;
 * - US sales tax is not added.
 */
export const OPS_USA_PRICE_FORMULA = {
  agreedOn: "03.09.2026",
  markupRate: 0.2,
  perKgUsd: 9,
  usDestination: "Brooklyn, New York, ZIP 11223",
} as const;

export const OPS_USA_FORMULA_TEXT = "(Цена товара + доставка по США) × 1,20 + $9 × вес (кг)";

export type OpsUsaPriceInput = {
  itemUsd: number;
  usShippingUsd: number;
  weightKg: number;
};

export type OpsUsaPriceBreakdown = OpsUsaPriceInput & {
  markupUsd: number;
  deliveryUsd: number;
  totalUsd: number;
};

const cents = (value: number) => Math.round(value * 100) / 100;

export function calculateOpsUsaPrice(input: OpsUsaPriceInput): OpsUsaPriceBreakdown {
  const base = input.itemUsd + input.usShippingUsd;
  const markupUsd = cents(base * OPS_USA_PRICE_FORMULA.markupRate);
  const deliveryUsd = cents(input.weightKg * OPS_USA_PRICE_FORMULA.perKgUsd);
  return {
    ...input,
    markupUsd,
    deliveryUsd,
    totalUsd: cents(base + markupUsd + deliveryUsd),
  };
}

export function formatOpsUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatKg(value: number) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

/** The same lines as the agreed example: item, US shipping, markup, delivery, total. */
export function formatOpsUsaPriceBreakdown(price: OpsUsaPriceBreakdown) {
  return [
    `Цена товара: ${formatOpsUsd(price.itemUsd)}`,
    `Доставка по США до Brooklyn: ${formatOpsUsd(price.usShippingUsd)}`,
    `Наценка 20%: ${formatOpsUsd(price.markupUsd)}`,
    `Доставка в Киев ${formatKg(price.weightKg)} кг × $${OPS_USA_PRICE_FORMULA.perKgUsd}: ${formatOpsUsd(price.deliveryUsd)}`,
    `Итого: ${formatOpsUsd(price.totalUsd)}`,
  ].join("\n");
}

const USA_WORDS = /(?:сша|usa|\bus\b|америк|штат)/iu;
const WEIGHT = /(\d+(?:[.,]\d+)?)\s*(?:кг|kg|кило\p{L}*)/iu;
const MONEY =
  /\$?\s*(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)\s*(?:\$|usd|дол\p{L}*)?/giu;
const SHIPPING_WORD = /(?:доставк|shipping|пересылк|до\s+brooklyn|до\s+нью)/iu;
const ITEM_WORD = /(?:товар|цен|цін|price|стоимост|вартіст)/iu;

function parseMoney(whole: string, fraction: string | undefined) {
  const value = Number(`${whole.replace(/[ ,]/g, "")}${fraction ? `.${fraction}` : ""}`);
  return Number.isFinite(value) ? value : null;
}

export type OpsUsaPriceQuestion = {
  itemUsd: number | null;
  usShippingUsd: number | null;
  weightKg: number | null;
};

/**
 * «США 1000 + 50, 10 кг», «сша: товар $1,000, доставка 50, вес 10 кг»,
 * «формула США». Returns null when the question is not about US pricing.
 */
export function parseOpsUsaPriceQuestion(text: string): OpsUsaPriceQuestion | null {
  const value = text.replace(/ /g, " ").trim();
  if (!USA_WORDS.test(value)) return null;
  const weightMatch = WEIGHT.exec(value);
  const weightKg = weightMatch ? Number(weightMatch[1].replace(",", ".")) : null;
  const rest = weightMatch
    ? `${value.slice(0, weightMatch.index)} ${value.slice(weightMatch.index + weightMatch[0].length)}`
    : value;
  const amounts: Array<{ value: number; index: number }> = [];
  for (const match of rest.matchAll(MONEY)) {
    const amount = parseMoney(match[1], match[2]);
    // ZIP 11223 and other long codes are not prices.
    if (amount === null || (/^\d{5,}$/.test(match[1]) && !match[0].includes("$"))) continue;
    amounts.push({ value: amount, index: match.index ?? 0 });
  }
  const labelled = (word: RegExp) =>
    amounts.find((amount) => word.test(rest.slice(Math.max(0, amount.index - 25), amount.index)));
  const shipping = labelled(SHIPPING_WORD) ?? null;
  const item = labelled(ITEM_WORD) ?? amounts.find((amount) => amount !== shipping) ?? null;
  const shippingAmount = shipping ?? amounts.find((amount) => amount !== item) ?? null;
  const asksFormula = /формул|как\s+счит|як\s+рах|расч[её]т|рахун/iu.test(value);
  if (!item && !weightKg && !asksFormula) return null;
  return {
    itemUsd: item?.value ?? null,
    usShippingUsd: shippingAmount?.value ?? null,
    weightKg: weightKg !== null && weightKg > 0 ? weightKg : null,
  };
}

export function buildOpsUsaFormulaExplanation() {
  const example = calculateOpsUsaPrice({ itemUsd: 1000, usShippingUsd: 50, weightKg: 10 });
  return [
    `🇺🇸 Формула США (с ${OPS_USA_PRICE_FORMULA.agreedOn}):`,
    OPS_USA_FORMULA_TEXT,
    "",
    "• +20% — наша наценка, на товар вместе с доставкой по США.",
    `• Доставка по США — до ${OPS_USA_PRICE_FORMULA.usDestination}.`,
    `• $${OPS_USA_PRICE_FORMULA.perKgUsd}/кг — доставка из США в Киев, добавляем после наценки.`,
    "• Sales Tax США не добавляем.",
    "",
    "Пример:",
    formatOpsUsaPriceBreakdown(example),
    "",
    "Посчитаю сам: «? США 1000 + 50 доставка, 10 кг».",
  ].join("\n");
}

/** A ready answer for «? США …», or null when the question is about something else. */
export function answerOpsUsaPriceQuestion(question: string) {
  const parsed = parseOpsUsaPriceQuestion(question);
  if (!parsed) return null;
  if (parsed.itemUsd === null) return buildOpsUsaFormulaExplanation();
  if (parsed.weightKg === null) {
    return [
      `Цена товара ${formatOpsUsd(parsed.itemUsd)} — нужен ещё вес в кг.`,
      "Напишите, например: «? США 1000 + 50 доставка, 10 кг».",
      "",
      `Формула: ${OPS_USA_FORMULA_TEXT}`,
    ].join("\n");
  }
  const price = calculateOpsUsaPrice({
    itemUsd: parsed.itemUsd,
    usShippingUsd: parsed.usShippingUsd ?? 0,
    weightKg: parsed.weightKg,
  });
  const base = price.itemUsd + price.usShippingUsd;
  return [
    `🇺🇸 Цена по формуле США (с ${OPS_USA_PRICE_FORMULA.agreedOn}):`,
    "",
    formatOpsUsaPriceBreakdown(price),
    "",
    `(${formatOpsUsd(price.itemUsd)} + ${formatOpsUsd(price.usShippingUsd)}) × 1,20 + $${OPS_USA_PRICE_FORMULA.perKgUsd} × ${formatKg(price.weightKg)} = ${formatOpsUsd(price.totalUsd)}`,
    "Sales Tax США не добавляем.",
    parsed.usShippingUsd === null
      ? `\n⚠️ Доставку по США не указали — посчитал $0. Уточните её до ${OPS_USA_PRICE_FORMULA.usDestination} и пересчитайте: «? США ${base} + 50 доставка, ${formatKg(price.weightKg)} кг».`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

const USA_BANNER = `> С ${OPS_USA_PRICE_FORMULA.agreedOn} для товаров из США действует общая формула: ${OPS_USA_FORMULA_TEXT}. Доставка по США — до ${OPS_USA_PRICE_FORMULA.usDestination}; Sales Tax США не добавляем. Подробно — статья «Формула цены США».`;
export const OPS_USA_FORMULA_STATUS = `Общая формула США (${OPS_USA_PRICE_FORMULA.agreedOn})`;
const USA_RETAIL = OPS_USA_FORMULA_TEXT;
const USA_LOGISTICS = `По США — до Brooklyn, NY 11223; США → Киев — $${OPS_USA_PRICE_FORMULA.perKgUsd}/кг`;

function replaceTableCell(content: string, label: string, next: (current: string) => string) {
  const pattern = new RegExp(`^(\\|\\s*${label}\\s*\\|\\s*)(.*?)(\\s*\\|\\s*)$`, "mu");
  return content.replace(pattern, (_row, prefix: string, current: string, suffix: string) => {
    return `${prefix}${next(current.trim())}${suffix}`;
  });
}

/**
 * US suppliers whose cards were filed under another group («Европа»,
 * «Общее правило») although they sell from the USA.
 */
export const OPS_USA_EXTRA_BRAND_TITLES = ["ADRO", "Performance Speed Shop", "SooQoo"] as const;

export function isOpsUsaBrandGuide(content: string) {
  return /^\|\s*Группа\s*\|\s*США\s*\|\s*$/mu.test(content);
}

/**
 * Rewrites a US brand guide for the new formula. The old brand rule stays
 * visible as history, partner/wholesale and our-cost rows are not touched.
 */
export function applyOpsUsaFormulaToBrandGuide(
  content: string,
  options: { forceUsa?: boolean } = {}
) {
  const source = options.forceUsa ? replaceTableCell(content, "Группа", () => "США") : content;
  if (!isOpsUsaBrandGuide(source) || source.includes(OPS_USA_FORMULA_STATUS)) return content;
  let next = source.replace(/^> .*$/mu, USA_BANNER);
  next = replaceTableCell(next, "Статус формулы", () => OPS_USA_FORMULA_STATUS);
  next = replaceTableCell(next, "Розница", (current) =>
    current && current !== "Не указано"
      ? `${USA_RETAIL}. Было до ${OPS_USA_PRICE_FORMULA.agreedOn}: ${current}`
      : USA_RETAIL
  );
  next = replaceTableCell(next, "Логистика", (current) =>
    current && current !== "Не указано" ? `${USA_LOGISTICS}. ${current}` : USA_LOGISTICS
  );
  next = next.replace(
    /(## Следующее действие\n\n)(?:Confirm formula[^\n]*|Use verified pricing rule[^\n]*)/u,
    `$1Узнать цену товара, доставку по США до Brooklyn (ZIP 11223) и вес — и посчитать по формуле США. В боте: «? США 1000 + 50 доставка, 10 кг».`
  );
  return next;
}

export function buildOpsUsaFormulaArticle() {
  const example = calculateOpsUsaPrice({ itemUsd: 1000, usShippingUsd: 50, weightKg: 10 });
  return `# Формула цены США (с ${OPS_USA_PRICE_FORMULA.agreedOn})

> Действует для всех товаров, которые мы покупаем в США. Заменяет старое правило «сайт +10% + shipping до NY + вес в Украину».

## Формула

**${OPS_USA_FORMULA_TEXT}**

- **+20%** — наша наценка. Начисляется на товар **вместе с доставкой по США**.
- **Доставка по США** — до ${OPS_USA_PRICE_FORMULA.usDestination}.
- **$${OPS_USA_PRICE_FORMULA.perKgUsd}/кг** — доставка из США до Киева. Добавляется **после** наценки.
- **Sales Tax США** — не добавляем.

## Пример

| Параметр | Стоимость |
| --- | ---: |
| Цена товара | ${formatOpsUsd(example.itemUsd)} |
| Доставка до Brooklyn | ${formatOpsUsd(example.usShippingUsd)} |
| Наценка 20% | ${formatOpsUsd(example.markupUsd)} |
| Доставка 10 кг × $${OPS_USA_PRICE_FORMULA.perKgUsd} | ${formatOpsUsd(example.deliveryUsd)} |
| **Конечная цена** | **${formatOpsUsd(example.totalUsd)}** |

## Как посчитать в Telegram

Напишите боту: \`? США 1000 + 50 доставка, 10 кг\` — он посчитает по формуле и покажет разбивку.

## Где применяется

Все бренды с группой «США» в базе и американские поставщики: RW Carbon, ADRO, Vorsteiner, Burger Motorsports, Performance Speed Shop (в том числе SooQoo), IND Distribution, USP Motorsports, Turn14, Real Street, FMIC.

## Что важно

- 20% считаем на товар **вместе** с внутренней доставкой по США, а $${OPS_USA_PRICE_FORMULA.perKgUsd}/кг добавляем уже после наценки.
- Партнёрские и оптовые условия отдельных брендов (если записаны в карточке бренда) — без изменений.
- ⚠️ На 13.10.2026 бот @OneCompany1_bot ещё считает розницу США по-старому: сайт ×1,1 + доставка до NY + $2 за позицию + $9/кг авиа (или $6/кг море), вес — типовой по виду детали. Его цена выходит на 6–9% ниже этой формулы — сверяйтесь с формулой.
`;
}
