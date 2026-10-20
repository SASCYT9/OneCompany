#!/usr/bin/env node
/**
 * Ukrainian and English product copy for the CT Carbon catalogue (Gemini).
 *
 * Input:  data/ct-carbon/source.json (scripts/ct-carbon/collect-ct-carbon-source.mjs)
 * Output: data/ct-carbon/copy.json   (one entry per CT product id, resumable)
 *
 *   node --env-file=<env with SHOP_AI_API_KEY> scripts/ct-carbon/generate-ct-carbon-copy.mjs [--only=<id>,<id>] [--concurrency=4] [--force] [--validate-only]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { runSupplierCopy } from "../catalog-copy/supplier-copy-core.mjs";
import { CT_CARBON_COPY_PROMPT, ctCarbonCopySourceText } from "./ct-carbon-copy-source.mjs";

const KIT_LIST_HEADER =
  /\b(?:included in (?:the|this) (?:kit|package|pack)|comprised of|consists of|kit includes|package includes|includes the following|the kit includes|this kit includes|kit features|what'?s included|in the box)\b/i;
const KIT_LIST_END = /\b(?:designed in[- ]house|please note|note:)/i;
const versions = (text) =>
  (String(text).match(/\bV\d+(?:\.\d+)?\b/gi) ?? []).map((v) => v.toUpperCase()).sort();
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

/** Version labels of the parts in SOURCE's kit list, and the product's own version from its title. */
function versionFacts(product) {
  const start = product.bodyParagraphs.findIndex((line) => KIT_LIST_HEADER.test(line));
  const listLines = [];
  if (start >= 0) {
    for (const line of product.bodyParagraphs.slice(start + 1)) {
      if (KIT_LIST_END.test(line)) break;
      listLines.push(line);
    }
  }
  return {
    listVersions: versions(listLines.join(" ")),
    // A version label ends the title or a " - " part ("KIT - V25 - CT DESIGN", "CT DESIGN V2");
    // engine names stay inside the car name ("R8 V10 GEN 2.5", "V8 AMG").
    titleVersion:
      product.title.match(/\bV\d+(?:\.\d+)?(?=\s*(?:-|\(|$))/i)?.[0]?.toUpperCase() ?? null,
  };
}

function checkCopy(product) {
  const facts = versionFacts(product);
  return (copy) => {
    const issues = [];
    for (const field of ["titleEn", "titleUa"]) {
      if (/\bCT DESIGN\b/i.test(copy[field] ?? "")) issues.push(`${field} contains CT DESIGN`);
      if (facts.titleVersion && !versions(copy[field]).includes(facts.titleVersion)) {
        issues.push(`${field} lost the version ${facts.titleVersion}`);
      }
    }
    for (const field of UA_FIELDS) {
      const text = JSON.stringify(copy[field] ?? "");
      if (RUSSIAN_WORDS.test(text)) issues.push(`${field}: Russian word in Ukrainian copy`);
    }
    if (facts.listVersions.length) {
      for (const field of ["inBoxEn", "inBoxUa"]) {
        const got = versions((copy[field] ?? []).join(" "));
        if (got.join(",") !== facts.listVersions.join(",")) {
          issues.push(
            `${field} part versions ${got.join(" ") || "none"} differ from SOURCE ${facts.listVersions.join(" ")}`
          );
        }
      }
    }
    return issues;
  };
}

const source = JSON.parse(await readFile(path.resolve("data/ct-carbon/source.json"), "utf8"));
await runSupplierCopy({
  label: "CT Carbon",
  items: source.products.map((product) => ({
    id: String(product.id),
    sourceText: ctCarbonCopySourceText(product),
    check: checkCopy(product),
  })),
  outputPath: path.resolve("data/ct-carbon/copy.json"),
  overridesPath: path.resolve("data/ct-carbon/overrides.json"),
  systemPrompt: CT_CARBON_COPY_PROMPT,
});
