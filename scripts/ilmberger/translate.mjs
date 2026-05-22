/**
 * UA translation pass for Ilmberger products.
 *
 * Phase 1 (this script): glossary-based — replaces ~50 known carbon/moto
 * terms in titles. Descriptions are left as EN (rendered in both locales
 * until Gemini pass added). This is a baseline, NOT a final translation.
 *
 * Phase 2 (future): when GEMINI_API_KEY is set, run full LLM translation
 * via scripts/translate-atomic-products-en.js pattern.
 *
 * Run: node scripts/ilmberger/translate.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const JSON_PATH = "tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json";

// Glossary: EN-fragment → UA-fragment. Order matters: longer phrases first.
const GLOSSARY = [
  // Parts (longest first)
  ["Upper Tank Cover", "Верхня накладка на бак"],
  ["Tank Side Panel left Full Version", "Бокова накладка бака ліва (повна)"],
  ["Tank Side Panel right Full Version", "Бокова накладка бака права (повна)"],
  [
    "Tank side panel right with OEM Panel attachments",
    "Бокова накладка бака права (з OEM-кріпленнями)",
  ],
  [
    "Tank side panel left with OEM Panel attachments",
    "Бокова накладка бака ліва (з OEM-кріпленнями)",
  ],
  ["Rear Hugger incl. Upper Chainguard", "Задній бризковик з накладкою на ланцюг"],
  ["Front Sprocket Cover", "Кришка передньої зірки"],
  ["Front Fender", "Переднє крило"],
  ["Heel Guard left", "Захист п'ятки лівий"],
  ["Heel Guard right", "Захист п'ятки правий"],
  ["Belly pan long version", "Нижній піддон (довга версія)"],
  ["Belly pan for Full Racing Exhaust", "Нижній піддон під повний гоночний вихлоп"],
  ["Bellypan one piece street version", "Нижній піддон вуличний (цілісний)"],
  ["Numberplate holder", "Тримач номерного знака"],
  ["Alternator cover", "Кришка генератора"],
  ["Clutch cover", "Кришка зчеплення"],
  ["Frame Cover big left", "Накладка рами велика ліва"],
  ["Frame Cover big right", "Накладка рами велика права"],
  ["Frame Cover small left", "Накладка рами мала ліва"],
  ["Frame Cover small right", "Накладка рами мала права"],
  ["Swing arm cover left", "Накладка маятника ліва"],
  ["Swing arm cover right", "Накладка маятника права"],
  ["Ignition Rotor Cover", "Кришка ротора запалювання"],
  ["Water pump Cover", "Кришка водяної помпи"],
  ["Instrument cover", "Накладка приладової панелі"],
  ["Muffler/Silencer Protector", "Захист глушника"],
  ["Electrical cable cover", "Накладка електрожгута"],
  ["Badge Holder left", "Тримач емблеми лівий"],
  ["Badge Holder right", "Тримач емблеми правий"],
  ["Rear seat cover", "Накладка пасажирського сидіння"],
  ["Tail Fairing", "Заднє оперення"],
  ["Tail Cover bottom", "Нижня накладка хвоста"],
  ["Passenger Seat Cover", "Накладка пасажирського сидіння"],
  ["Tail Cover Monoposto", "Заднє оперення Monoposto"],
  // Generic words
  ["from MY", "з модельного року"],
  ["from year", "з"],
];

function translateTitle(en) {
  let ua = en;
  for (const [from, to] of GLOSSARY) {
    ua = ua.replaceAll(from, to);
  }
  return ua;
}

async function main() {
  const products = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
  console.log(`🌐 Translating ${products.length} products (glossary-based, no LLM)...\n`);

  let translated = 0;
  for (const p of products) {
    const ua = translateTitle(p.titleEn);
    p.titleUa = ua;
    // Description left as EN — full LLM pass is a separate tour
    if (!p.descriptionHtmlUa) {
      p.descriptionHtmlUa = p.descriptionHtmlEn;
    }
    if (ua !== p.titleEn) translated++;
    const sample = ua.length > 60 ? ua.substring(0, 60) + "..." : ua;
    console.log(`  ${p.sku} → ${sample}`);
  }

  writeFileSync(JSON_PATH, JSON.stringify(products, null, 2));
  console.log(`\n✅ ${translated}/${products.length} titles translated via glossary.`);
  console.log(`   descriptionHtmlUa = descriptionHtmlEn (fallback; full LLM pass deferred).`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
