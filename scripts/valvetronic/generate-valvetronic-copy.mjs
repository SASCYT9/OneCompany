#!/usr/bin/env node
/**
 * Ukrainian and English product copy for the Valvetronic Designs catalogue (Gemini).
 *
 * Input:  data/valvetronic/source.json (scripts/valvetronic/collect-valvetronic-source.mjs)
 * Output: data/valvetronic/copy.json   (one entry per Valvetronic product id, resumable)
 *
 *   node --env-file=<env with SHOP_AI_API_KEY> scripts/valvetronic/generate-valvetronic-copy.mjs [--only=<id>,<id>] [--concurrency=4] [--force] [--validate-only]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { runSupplierCopy } from "../catalog-copy/supplier-copy-core.mjs";
import { VALVETRONIC_COPY_PROMPT, valvetronicCopySourceText } from "./valvetronic-copy-source.mjs";

/** Russian words that slip into Ukrainian copy ("с", "и" as separate words). */
const RUSSIAN_WORDS = /(?:^|[\s(«"])(?:с|и|со)(?=[\s,.)»"]|$)/i;
const UA_FIELDS = [
  "titleUa",
  "shortDescUa",
  "introUa",
  "keyPointsUa",
  "specsUa",
  "inBoxUa",
  "fitmentUa",
  "importantUa",
  "seoTitleUa",
  "seoDescriptionUa",
  "imageAltUa",
];
/** Product line names that must survive in the titles when the source title has them. */
const LINES = [/SHUTO/i, /Blackbear/i, /True F1/i, /\bHFD\b/];

function checkCopy(product) {
  return (copy) => {
    const issues = [];
    for (const field of ["titleEn", "titleUa"]) {
      if (!/^Valvetronic Designs\b/.test(copy[field] ?? "")) {
        issues.push(`${field} does not start with Valvetronic Designs`);
      }
      for (const line of LINES) {
        if (line.test(product.title) && !line.test(copy[field] ?? "")) {
          issues.push(`${field} lost the product line ${line.source}`);
        }
      }
    }
    for (const field of UA_FIELDS) {
      const text = JSON.stringify(copy[field] ?? "");
      if (RUSSIAN_WORDS.test(text)) issues.push(`${field}: Russian word in Ukrainian copy`);
      if (/згорі/i.test(text)) issues.push(`${field}: "burnt" finish translated as згорілий`);
    }
    return issues;
  };
}

const source = JSON.parse(await readFile(path.resolve("data/valvetronic/source.json"), "utf8"));
await runSupplierCopy({
  label: "Valvetronic Designs",
  items: source.products.map((product) => ({
    id: String(product.id),
    sourceText: valvetronicCopySourceText(product),
    check: checkCopy(product),
  })),
  outputPath: path.resolve("data/valvetronic/copy.json"),
  overridesPath: path.resolve("data/valvetronic/overrides.json"),
  systemPrompt: VALVETRONIC_COPY_PROMPT,
});
