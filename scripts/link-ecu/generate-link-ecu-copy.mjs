#!/usr/bin/env node
/**
 * Ukrainian and English product copy for the Link ECU catalogue (Gemini).
 *
 * Input:  data/link-ecu/source.json (scripts/link-ecu/collect-link-ecu-source.mjs)
 * Output: data/link-ecu/copy.json   (one entry per SKU, resumable)
 *
 *   node --env-file=<env with SHOP_AI_API_KEY> scripts/link-ecu/generate-link-ecu-copy.mjs [--only=122-4000] [--force] [--validate-only]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { COMMON_RULES, runSupplierCopy } from "../catalog-copy/supplier-copy-core.mjs";

const SYSTEM_PROMPT = `You write product pages for One Company (onecompany.global), a Kyiv tuning-parts shop, in Ukrainian and English.
Brand: Link ECU (New Zealand), programmable engine management.

${COMMON_RULES}
- Keep established English tuning terms where Ukrainian tuners use them: ECU, CAN, USB, Flex Fuel, E-Throttle, launch control, anti-lag, VVT, PCLink.
- Glossary (EN → UA): engine management unit / ECU → блок керування двигуном (ECU); Plug-In ECU → Plug-In ECU (встановлюється замість штатного блока);
  Wire-In ECU → Wire-In ECU (під власну проводку); injection drives → канали керування форсунками; ignition drives → канали запалювання;
  auxiliary outputs → допоміжні виходи; digital/analogue/temperature/trigger/knock inputs → цифрові/аналогові/температурні/тригерні входи/входи датчиків детонації;
  wideband lambda → широкосмуговий лямбда-зонд; closed loop → замкнений контур; boost control → керування тиском наддуву;
  data logging → запис логів; traction control → контроль тяги; cruise control → круїз-контроль; nitrous control → керування закисом азоту;
  paddle shift → перемикання пелюстками; gear shift control → керування перемиканням передач; startup map → стартова карта (базові налаштування для запуску);
  expansion loom → додатковий кабель Expansion Loom; power distribution module → модуль розподілу живлення (PDM); fuse → запобіжник; relay → реле; harness → джгут проводки;
  terminated harness → готовий джгут проводки; fuse box → блок запобіжників; camshaft → розподільний вал; crankshaft → колінчастий вал;
  throttle body → дросельна заслінка; drive-by-wire → електронна дросельна заслінка (drive-by-wire); cable throttle → тросовий привід заслінки.
- Units for electronics: В, А, МБ, кГц.

Fields:
- titleEn / titleUa: start with "Link", then the model name, then what it is, then the car or cylinder count. Examples:
  EN "Link G4X FuryX Wire-In ECU (up to 6 cylinders)"; UA "Link G4X FuryX — блок керування двигуном Wire-In (до 6 циліндрів)";
  EN "Link WRX9X Plug-In ECU for Subaru WRX / STI V7–V9 (GD/GG)"; UA "Link WRX9X — Plug-In ECU для Subaru WRX / STI V7–V9 (GD/GG)".
  For bundles name the ECU and what the kit is for (e.g. "для двигунів GM LS Gen4 з електронною заслінкою"). Max 100 characters.
- shortDescEn / shortDescUa: 1–2 sentences, max 230 characters: what it is and the main reason to buy.
- introEn / introUa: exactly 2 paragraphs, 2–3 sentences each, for a buyer deciding to purchase.
- keyPointsEn / keyPointsUa: 4–6 short bullets (max 110 characters each) with the most useful capabilities.
- specsEn / specsUa: 4–8 rows {label, value} that summarise SOURCE specifications compactly (outputs, inputs, communications, data logging,
  electrical, dimensions and weight, connector, enclosure). Only rows that SOURCE supports. If SOURCE says the full I/O list is in the manual, say so.
- inBoxEn / inBoxUa: what is in the box, from SOURCE only; empty if SOURCE has no box list.
- fitmentEn / fitmentUa: one line per vehicle application from "Models Supported" (make, model/version, chassis, engine, years). Empty for universal products.
- importantEn / importantUa: every caution from the "Important" or "Warnings" rows in SOURCE, rewritten clearly. Empty if there are none.
- seoTitleEn / seoTitleUa: max 60 characters, include "Link" and the model name, no shop name; UA must be in Ukrainian.
- seoDescriptionEn / seoDescriptionUa: 130–160 characters, factual, no prices, no delivery.
- imageAltEn / imageAltUa: short alt text for the main photo: brand, model and what it is.
- vehicles: structured applications from "Models Supported" (empty for universal products and engine-swap kits).
  make as usual ("Subaru", "Mitsubishi", "Nissan", "Toyota", "Honda", "Mazda", "BMW", "MINI", "Audi", "Volkswagen");
  model as commonly listed for the make ("Impreza WRX", "Impreza WRX STI", "Lancer Evolution", "Skyline", "Silvia", "300ZX", "350Z", "GT-R",
  "Supra", "Chaser", "Altezza", "MR2", "Celica", "GT86", "BRZ", "Land Cruiser", "Patrol", "Civic", "S2000", "Integra", "MX-5", "RX-7", "3 Series", "Cooper S", "TT", "Golf");
  the version or generation name (e.g. "Version 7", "Evolution IX", "Series 6") goes to note; chassisCode and engine exactly as SOURCE;
  yearFrom/yearTo as numbers or null; market ("JDM", "USDM", "EDM", "RHD", "LHD") only if SOURCE says so.`;

function sourceText(product) {
  const lines = [
    `SKU: ${product.sku}`,
    `Title on linkecu.com: ${product.titleSource}`,
    `Kind: ${product.kind}`,
    "Description:",
    ...product.bodyParagraphs,
  ];
  for (const section of product.sections) {
    lines.push(`## ${section.title}`);
    lines.push(...section.paragraphs);
    lines.push(...section.items.map((item) => `- ${item}`));
    for (const row of section.rows) {
      lines.push(`${row.heading}:`);
      lines.push(...row.values.map((value) => `  - ${value}`));
    }
  }
  return lines.join("\n");
}

const source = JSON.parse(await readFile(path.resolve("data/link-ecu/source.json"), "utf8"));
await runSupplierCopy({
  label: "Link ECU",
  items: source.products.map((product) => ({ id: product.sku, sourceText: sourceText(product) })),
  outputPath: path.resolve("data/link-ecu/copy.json"),
  overridesPath: path.resolve("data/link-ecu/overrides.json"),
  systemPrompt: SYSTEM_PROMPT,
});
