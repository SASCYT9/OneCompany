#!/usr/bin/env node
/**
 * Ukrainian labels for the Valvetronic Designs variant choices (Gemini), kept in
 * src/lib/shopOptionValueLabelsUa.json, which the product page reads for exact matches.
 * Existing (reviewed) labels are kept; only new values are translated.
 *
 *   node --env-file=<env with SHOP_AI_API_KEY> scripts/valvetronic/translate-valvetronic-option-values.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { GoogleGenAI, Type } from "@google/genai";

const LABELS_PATH = path.resolve("src/lib/shopOptionValueLabelsUa.json");
const source = JSON.parse(await readFile(path.resolve("data/valvetronic/source.json"), "utf8"));
const labels = JSON.parse(await readFile(LABELS_PATH, "utf8").catch(() => "{}"));

const values = Array.from(
  new Set(
    source.products.flatMap((product) => product.variants.flatMap((variant) => variant.options))
  )
).sort();
const missing = values.filter((value) => !labels[value]);
if (!missing.length) {
  console.log(`all ${values.length} values already have Ukrainian labels`);
  process.exit(0);
}

const PROMPT = `Translate exhaust-system option labels from an online shop into short Ukrainian labels for a product page selector.
Rules:
- Keep every number, size, code, chassis and model name exactly (3.5", 63 mm, 400 Cell, Euro 6, B58, R8 V10 5.2, F91/F92, SVJ, 6Al-4V, T304, OEM, OPF, F1, HFD).
- Keep brand and product line names in Latin letters (Blackbear™, Cerakote®, True F1, Lamborghini, Ferrari, BMW).
- Inches stay with the inch sign (3.5"); "mm" becomes "мм"; decimal comma only for metric numbers (2,0 л), inch sizes keep the dot (3.5").
- Short and natural for car tuners, no Russian words. A leading "+ " means "plus this add-on": keep it.
- Glossary: valved → клапанна / з клапанами; catback / cat-back → кет-бек; axleback / axle-back → аксл-бек; rear section → задня секція;
  midpipe → середня секція (midpipe); front pipes → передні труби; downpipes → даунпайпи; test pipes / race pipes → прямі труби;
  free flow → без каталізаторів (free flow); headers / manifolds → колектори; bypass pipes → байпас-труби; over axle pipes → труби над мостом;
  400 cell catted / catalytic converters → з каталізаторами 400 cell (never «коміркові»); resonated → з резонаторами; quad / dual → чотири / два;
  tips → насадки; outlet → вихід; single wall → одностінні; brushed (steel) → шліфована сталь; burnt → палений; raw titanium → необроблений титан;
  black → чорні; 1x1 carbon (fiber) → карбон 1x1; forged carbon (fiber) → кований карбон; stainless steel → нержавіюча сталь;
  Grade 5 titanium → титан Grade 5; anodized gold → анодоване золото; full system → повна система; only → лише; system → система;
  muffler → глушник; X pipe → X-труба; non valved → без клапанів; race → гоночна; sport → спортивна; package → пакет;
  inlet → вхід; single inlet dual outlet → один вхід, два виходи; set of 2 → комплект із 2 шт.; pair → пара; pin → контакти;
  valve actuator → актуатор клапана; controller wire → дріт до контролера; control box → блок керування; vacuum → вакуумний;
  bolt → болти; straight → прямий; angled → під кутом; reducer clamp → перехідний хомут; reuse OEM → використовуються штатні;
  equal length → рівної довжини; select no tips → без насадок; supercharged → з компресором; naturally aspirated → атмосферний;
  turbocharged inline-4 / turbo i4 → турбо, рядна 4; with / without OPF bungs → зі штуцерами / без штуцерів OPF; Version → Версія; Gen / Generation → покоління.
Return JSON {"labels":[{"en": <exactly the input>, "ua": <Ukrainian>}]} with one entry per input line, in the same order.`;

const ai = new GoogleGenAI({ apiKey: process.env.SHOP_AI_API_KEY });
const response = await ai.models.generateContent({
  model: process.env.SUPPLIER_COPY_MODEL?.trim() || "gemini-3.5-flash",
  contents: [{ role: "user", parts: [{ text: missing.join("\n") }] }],
  config: {
    systemInstruction: PROMPT,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        labels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { en: { type: Type.STRING }, ua: { type: Type.STRING } },
            required: ["en", "ua"],
          },
        },
      },
      required: ["labels"],
    },
    maxOutputTokens: 32768,
  },
});
const result = JSON.parse(response.text);
let added = 0;
for (const { en, ua } of result.labels) {
  if (missing.includes(en) && ua.trim()) {
    labels[en] = ua.trim();
    added += 1;
  }
}
const sorted = Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(LABELS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
const still = values.filter((value) => !sorted[value]);
console.log(`added ${added}; ${values.length - still.length}/${values.length} values labelled`);
if (still.length) console.log(`missing: ${still.join(" | ")}`);
