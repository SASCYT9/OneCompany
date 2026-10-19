/**
 * Shared engine for supplier product copy (Link ECU, Dinan, APR): Gemini writes
 * UA/EN copy from the manufacturer's own page text, and every result is
 * validated against that text before it can be imported.
 *
 * A brand script supplies the brand prompt and one `{ id, sourceText }` item per
 * product; this module handles the model call, resume, validation and output.
 *
 * Flags: --only=ID1,ID2  --force  --concurrency=4  --validate-only (re-check
 * stored copy plus manual overrides without calling the model).
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const RATES = {
  "gemini-3.8-flash": [1.5, 7.5],
  "gemini-3.5-flash": [1.5, 9],
  "gemini-3.5-flash-lite": [0.3, 2.5],
};

export const COMMON_RULES = `Hard rules:
- Use ONLY facts from SOURCE. Never invent numbers, horsepower, compatibility, warranty, delivery, stock, prices or awards.
- Never mention delivery, shipping speed, stock, prices, the shop or "One Company". Do not describe the physical form (colour, material, finish) unless SOURCE does.
- Copy every number, model code, chassis code, engine code, year, connector name and part number exactly as in SOURCE.
- Keep each number in the unit SOURCE gives it (inches, pounds, psi, CFM, °F stay as they are); never convert units or calculate new numbers.
- Do not copy SOURCE sentences word for word in English: rewrite them in your own words for a buyer.
- Ukrainian must be natural, literate Ukrainian written for car enthusiasts and tuners. No Russian words, no surzhyk, no calques.
- Units in Ukrainian: мм, см, кг, г, В, А, л, к.с., Нм; decimal comma in Ukrainian (6,5 мм), dot in English.
- In Ukrainian write inches with the inch sign (3", 2,5") and pounds as фунти; never leave IN, in., lb or lbs in Ukrainian text.
- Write counts that SOURCE gives as words ("quad", "dual", "pair") as words, not as new digits.`;

const stringArray = { type: Type.ARRAY, items: { type: Type.STRING } };
const specArray = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: { label: { type: Type.STRING }, value: { type: Type.STRING } },
    required: ["label", "value"],
  },
};

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    titleEn: { type: Type.STRING },
    titleUa: { type: Type.STRING },
    shortDescEn: { type: Type.STRING },
    shortDescUa: { type: Type.STRING },
    introEn: stringArray,
    introUa: stringArray,
    keyPointsEn: stringArray,
    keyPointsUa: stringArray,
    specsEn: specArray,
    specsUa: specArray,
    inBoxEn: stringArray,
    inBoxUa: stringArray,
    fitmentEn: stringArray,
    fitmentUa: stringArray,
    importantEn: stringArray,
    importantUa: stringArray,
    seoTitleEn: { type: Type.STRING },
    seoTitleUa: { type: Type.STRING },
    seoDescriptionEn: { type: Type.STRING },
    seoDescriptionUa: { type: Type.STRING },
    imageAltEn: { type: Type.STRING },
    imageAltUa: { type: Type.STRING },
    vehicles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          make: { type: Type.STRING },
          model: { type: Type.STRING },
          chassisCode: { type: Type.STRING, nullable: true },
          engine: { type: Type.STRING, nullable: true },
          yearFrom: { type: Type.INTEGER, nullable: true },
          yearTo: { type: Type.INTEGER, nullable: true },
          market: { type: Type.STRING, nullable: true },
          note: { type: Type.STRING, nullable: true },
        },
        required: ["make", "model"],
      },
    },
  },
  required: [
    "titleEn",
    "titleUa",
    "shortDescEn",
    "shortDescUa",
    "introEn",
    "introUa",
    "keyPointsEn",
    "keyPointsUa",
    "specsEn",
    "specsUa",
    "inBoxEn",
    "inBoxUa",
    "fitmentEn",
    "fitmentUa",
    "importantEn",
    "importantUa",
    "seoTitleEn",
    "seoTitleUa",
    "seoDescriptionEn",
    "seoDescriptionUa",
    "imageAltEn",
    "imageAltUa",
    "vehicles",
  ],
};

const RUSSIAN_ONLY = /[ыэъёЫЭЪЁ]/;
// ".00004" (no leading zero) is 0.00004.
const NUMBER = /(?<![\d.])\.\d+|\d+(?:[.,]\d+)?/g;

export function numbersIn(text, { commaDecimal = false, grouping = true } = {}) {
  // "1,000 grams", "5,500cm³", "30000kPa" and "30 000 кПа" are one number each; "6,5" stays a
  // decimal; "G20 330i" stays two numbers. With commaDecimal, "5,285" is the Ukrainian 5.285,
  // not 5285; without grouping, "911 992" (Porsche 911, type 992) stays two numbers.
  let ungrouped = text;
  if (grouping) {
    const spaceGrouped = /(?<![\p{L}\d.,])\d{1,3}(?:\s\d{3})+(?![\d\p{L}])/gu;
    const commaGrouped = /(?<![\p{L}\d.,])\d{1,3}(?:,\d{3})+(?!\d)/gu;
    for (const grouped of commaDecimal ? [spaceGrouped] : [commaGrouped, spaceGrouped]) {
      ungrouped = ungrouped.replace(grouped, (match) => match.replace(/[,\s]/g, ""));
    }
  }
  return (ungrouped.match(NUMBER) ?? []).map((value) =>
    value.replace(",", ".").replace(/^\./, "0.")
  );
}

/** Ways to read the numbers in one text; the reading with the fewest unknown numbers wins. */
const NUMBER_READINGS = [{}, { commaDecimal: true }, { grouping: false }];

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

/** "Dual 63.5mm" may become "2 × 63,5 мм": counts SOURCE spells out as words. */
const COUNT_WORDS = [
  [/\b(?:single|one)\b/i, "1"],
  [/\b(?:dual|twin|pair|double|two)\b/i, "2"],
  [/\b(?:triple|three)\b/i, "3"],
  [/\b(?:quad|four)\b/i, "4"],
  [/\b(?:six)\b/i, "6"],
  [/\b(?:eight)\b/i, "8"],
];

/**
 * Years SOURCE writes with two digits ("Fits Audi RS3 17-20, A6 06, 09") may be
 * written out in full ("2017–2020").
 */
function shortYears(sourceText) {
  const twoDigit = [
    ...[...sourceText.matchAll(/\bfits\b[^\n]*/gi)].flatMap(
      (line) => line[0].match(/\b\d{2}\b/g) ?? []
    ),
    ...[...sourceText.matchAll(/\b(\d{2})\s*[-–]\s*(\d{2})\b/g)].flatMap((range) => [
      range[1],
      range[2],
    ]),
  ];
  return twoDigit.map((yy) => `${Number(yy) <= 40 ? 20 : 19}${yy}`);
}

/**
 * Problems that block import: numbers absent from the source, Russian-only
 * letters in Ukrainian text, over-long titles and SEO fields.
 */
export function validateSupplierCopy(copy, sourceText, extraAllowedNumbers = []) {
  const issues = [];
  const spelledCounts = COUNT_WORDS.filter(([word]) => word.test(sourceText)).map(([, n]) => n);
  const sourceNumbers = NUMBER_READINGS.flatMap((reading) => numbersIn(sourceText, reading));
  // "EA888.4" also names the EA888 family.
  const familyNumbers = sourceNumbers
    .filter((n) => n.includes(".") && Number(n) >= 100)
    .map((n) => n.split(".")[0]);
  // "30k miles" may be written out as 30 000, and "16-24,000 km" as 16 000–24 000 km.
  const thousands = [
    ...[...sourceText.matchAll(/(\d+(?:\.\d+)?)\s?k\b/gi)].map((match) => match[1]),
    ...[...sourceText.matchAll(/\b(\d{1,3})\s*[-–]\s*\d{1,3},000\b/g)].map((match) => match[1]),
  ].map((value) => String(Math.round(Number(value) * 1000)));
  const allowed = new Set(
    [
      ...sourceNumbers,
      ...familyNumbers,
      ...thousands,
      ...spelledCounts,
      ...shortYears(sourceText),
      ...extraAllowedNumbers.map(String),
    ].flatMap((n) => [n, String(Number(n))])
  );
  const unknown = (numbers) =>
    numbers.filter((n) => !allowed.has(n) && !allowed.has(String(Number(n))));
  for (const [field, value] of Object.entries(copy)) {
    if (field === "vehicles") continue;
    for (const rawText of collectStrings(value)) {
      // Model ranges such as "BMW 1 та 3 Series" name a series, "G8x" a chassis family and
      // "E91" / "E36/7" / "R56" a BMW or MINI body, not a number from SOURCE.
      const text = rawText
        .replace(
          /(^|\D)[1-8](?=(?:[\s-]|\s(?:та|і|and|&)\s[1-8][\s-])*(?:Series|series|серії|серія|серій))/g,
          "$1"
        )
        .replace(/\b[EFG]\d[xX]\b/g, "")
        .replace(/\b[EFGR]\d{2}(?:\/\d)?\b/g, "")
        // BMW engine families (B58, N55, S63) are names, not figures.
        .replace(/\b[BNS]\d{2}\b/g, "");
      let missing = null;
      for (const reading of NUMBER_READINGS) {
        const candidate = unknown(numbersIn(text, reading));
        if (!missing || candidate.length < missing.length) missing = candidate;
        if (!missing.length) break;
      }
      for (const n of missing) issues.push(`${field}: number "${n}" is not in the source`);
      if (field.endsWith("Ua") && RUSSIAN_ONLY.test(text))
        issues.push(`${field}: Russian-only letter in "${text.slice(0, 60)}"`);
    }
  }
  for (const vehicle of copy.vehicles ?? []) {
    for (const year of [vehicle.yearFrom, vehicle.yearTo]) {
      if (year != null && !allowed.has(String(year)))
        issues.push(`vehicles: year ${year} is not in the source`);
    }
  }
  // A little above the prompt's targets: a few characters over is not worth a rewrite.
  const limits = {
    titleEn: 120,
    titleUa: 120,
    shortDescEn: 250,
    shortDescUa: 250,
    seoTitleEn: 65,
    seoTitleUa: 65,
    seoDescriptionEn: 170,
    seoDescriptionUa: 170,
  };
  for (const [field, max] of Object.entries(limits)) {
    if ((copy[field] ?? "").length > max)
      issues.push(`${field}: ${copy[field].length} > ${max} characters`);
  }
  if (!/[Ѐ-ӿ]/u.test(copy.titleUa + copy.seoTitleUa)) issues.push("UA title has no Cyrillic text");
  if (copy.introUa?.length !== 2 || copy.introEn?.length !== 2)
    issues.push("intro must have exactly 2 paragraphs");
  return [...new Set(issues)];
}

export function parseCopyArgs(argv = process.argv.slice(2)) {
  const args = new Map(
    argv.map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=");
      return [key, value ?? "1"];
    })
  );
  return {
    only: args.get("only") ? new Set(args.get("only").split(",")) : null,
    force: args.has("force"),
    validateOnly: args.has("validate-only"),
    concurrency: Math.max(1, Number(args.get("concurrency") ?? 1) || 1),
  };
}

/**
 * Generates (or re-validates) copy for every item and keeps the result in
 * `outputPath` as `{ products: { [id]: copy & { issues, model, generatedAt } } }`.
 */
export async function runSupplierCopy({
  label,
  items,
  outputPath,
  overridesPath,
  systemPrompt,
  model = process.env.SUPPLIER_COPY_MODEL?.trim() || "gemini-3.8-flash",
  argv,
}) {
  const { only, force, validateOnly, concurrency } = parseCopyArgs(argv);
  const overrides = JSON.parse(await readFile(overridesPath, "utf8").catch(() => "{}"));
  let existing = { schemaVersion: 1, model, products: {} };
  try {
    existing = JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    // first run
  }
  // Parallel workers share one file: writes are chained so they never interleave.
  let saving = Promise.resolve();
  const save = () =>
    (saving = saving.then(() => writeFile(outputPath, `${JSON.stringify(existing, null, 1)}\n`)));
  const validateWithOverrides = (copy, item) =>
    validateSupplierCopy(
      { ...copy, ...(overrides[item.id] ?? {}) },
      item.sourceText,
      item.allowedNumbers
    );

  if (validateOnly) {
    let withIssues = 0;
    for (const item of items) {
      const entry = existing.products[item.id];
      if (!entry) {
        withIssues += 1;
        console.log(`${item.id.padEnd(14)} no copy yet`);
        continue;
      }
      const {
        issues: _issues,
        model: _model,
        generatedAt: _generatedAt,
        sourceHash: _sourceHash,
        ...copy
      } = entry;
      entry.issues = validateWithOverrides(copy, item);
      if (entry.issues.length) {
        withIssues += 1;
        console.log(`${item.id.padEnd(14)} ${entry.issues.join("; ")}`);
      }
    }
    await save();
    console.log(`${label}: ${items.length - withIssues}/${items.length} ready`);
    return;
  }

  if (!process.env.SHOP_AI_API_KEY) throw new Error("SHOP_AI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey: process.env.SHOP_AI_API_KEY });
  let cost = 0;
  const generate = async (item) => {
    const previous = existing.products[item.id];
    const sourceHash = createHash("sha256")
      .update(`${systemPrompt}\n${item.sourceText}`)
      .digest("hex")
      .slice(0, 16);
    // Regenerate when the source or the prompt changed (e.g. variants regrouped), not only on issues.
    const sameSource = !previous?.sourceHash || previous.sourceHash === sourceHash;
    if (!force && previous && !previous.issues?.length && sameSource) return;
    const started = Date.now();
    let response;
    let copy;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: `SOURCE:\n${item.sourceText}` }] }],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            maxOutputTokens: 16384,
          },
        });
        // A cut-off answer (very long fitment lists) is not valid JSON: ask again.
        copy = JSON.parse(response.text);
        break;
      } catch (error) {
        console.log(
          `${item.id.padEnd(14)} attempt ${attempt} failed: ${String(error).slice(0, 160)}`
        );
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
      }
    }
    if (!copy) return;
    const issues = validateWithOverrides(copy, item);
    const usage = response.usageMetadata ?? {};
    const [inRate, outRate] = RATES[model] ?? [1.5, 9];
    const callCost =
      ((usage.promptTokenCount ?? 0) * inRate +
        ((usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)) * outRate) /
      1e6;
    cost += callCost;
    existing.products[item.id] = {
      ...copy,
      issues,
      model,
      sourceHash,
      generatedAt: new Date().toISOString(),
    };
    existing.model = model;
    await save();
    console.log(
      `${item.id.padEnd(14)} ${((Date.now() - started) / 1000).toFixed(1)}s $${callCost.toFixed(4)} issues=${issues.length} ${copy.titleUa}`
    );
    for (const issue of issues) console.log(`    ! ${issue}`);
  };
  const queue = items.filter((item) => !only || only.has(item.id));
  const worker = async () => {
    while (queue.length) await generate(queue.shift());
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  await saving;
  console.log(`${label}: total model cost ≈ $${cost.toFixed(3)}`);
}
