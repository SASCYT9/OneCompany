/**
 * What the Valvetronic Designs copy is written from: the Gemini prompt and each product's
 * SOURCE text. runSupplierCopy stores sha256(prompt + SOURCE) as sourceHash, so the importer
 * can refuse copy written for an older SOURCE.
 */
import { createHash } from "node:crypto";

import { COMMON_RULES } from "../catalog-copy/supplier-copy-core.mjs";

export const VALVETRONIC_COPY_PROMPT = `You write product pages for One Company (onecompany.global), a Kyiv tuning-parts shop, in Ukrainian and English.
Brand: Valvetronic Designs: valved sport exhaust systems, F1 race exhausts, downpipes, headers, exhaust tips and exhaust valve control parts.
"Valvetronic" here is the brand name; "valved" means the exhaust has electronic or vacuum valves that open and close.

${COMMON_RULES}
- Keep chassis, generation and engine codes exactly (G80, G82, F87, B9, C8, 992, 991.2, 9Y0, E9X, S58, B58, EA839, LP610, FL5, RZ34 …).
- Keep product line names as they are: SHUTO™, Blackbear™, True F1, HFD.
- The SOURCE "Options" lines are choices the buyer makes on the product page (system, material, tips, front pipes); describe the product as a whole, do not write a title for one option.
- Ukrainian exhaust words (EN → UA): valved exhaust → клапанна вихлопна система; valves → клапани; cat-back / catback → кет-бек (cat-back);
  axle-back → аксл-бек (axle-back); rear section → задня секція; midpipe / mid-section → середня секція (midpipe); front pipes → передні труби;
  downpipes → даунпайпи; test pipes / race pipes / free flow pipes → прямі труби без каталізаторів (free flow); headers / manifolds → випускні колектори (headers);
  catted / catalytic converters → з каталізаторами; 400 cell / 200 cell → «каталізатори 400 cell» / «з каталізаторами 200 cell» (tuners say "cell"; never «коміркові»); Euro 6 → Euro 6; resonated → з резонаторами;
  muffler → глушник; X-pipe → X-труба (X-pipe); Y-pipe → Y-труба (Y-pipe); bypass → байпас; exhaust tips → насадки вихлопу; outlet → вихідний діаметр;
  single wall / double wall → одностінні / двостінні; brushed → шліфовані; burnt / burnt titanium → палений титан (з кольоровою побіжалістю); black → чорні;
  1x1 carbon fiber → карбон 1x1; forged carbon → кований карбон; T304 stainless steel → нержавіюча сталь T304; Grade 5 titanium → титан Grade 5;
  mandrel-bent → гнуття на дорні (mandrel-bent); TIG welds → зварювання TIG; drone → гул у салоні; overrun crackles / pops → постріли на скиданні газу;
  key fob remote → брелок керування; valve controller / control box → блок керування клапанами; actuator → актуатор; vacuum → вакуумний;
  harness → джгут проводів; clamp → хомут; V-band → V-band; hangers → підвіси; OPF / GPF → сажовий фільтр (OPF/GPF); O2 sensor → лямбда-зонд;
  bungs → штуцери; direct fit / bolt-on → встановлюється без переробок; sedan → седан; coupe → купе; convertible → кабріолет.
- "Burnt" is a heat-coloured titanium finish, never "згорілий".
- Weights and weight savings stay in pounds in both languages ("16.4 lb lighter" → UA "на 16,4 фунта легша"); never convert to kilograms.
- Years only as SOURCE gives them: never extend a range or add an end year.
- Never call a product "official", "OEM" or "factory" unless SOURCE does.

Fields:
- titleEn / titleUa: start with "Valvetronic Designs", then what the product is, then the car (make, model, chassis code, years when SOURCE gives them).
  Examples: EN "Valvetronic Designs Valved Sport Exhaust System for Audi S4 / S5 B9 (2017–2024)";
  UA "Valvetronic Designs — клапанна вихлопна система для Audi S4 / S5 B9 (2017–2024)";
  EN "Valvetronic Designs 400 Cell Catted Downpipes for BMW M2 / M3 / M4 G87 / G80 / G82"; UA "Valvetronic Designs — даунпайпи з каталізаторами 400 cell для BMW M2 / M3 / M4 G87 / G80 / G82".
  Universal parts (clamps, tips, remotes) name the part and its size. Max 110 characters.
- shortDescEn / shortDescUa: 1–2 sentences, max 200 characters: what it is and the main reason to buy.
- introEn / introUa: exactly 2 short paragraphs, 2 sentences each.
- keyPointsEn / keyPointsUa: 3–5 short bullets (max 100 characters each).
- specsEn / specsUa: 3–6 rows {label, value}: material, valve type, tips, construction, weight saving, what it replaces — only what SOURCE states.
- inBoxEn / inBoxUa: one line per item SOURCE lists as included; empty when SOURCE gives no list.
- fitmentEn / fitmentUa: one line per car SOURCE names (make, model, chassis, years, body style or "does not fit" notes).
- importantEn / importantUa: cautions SOURCE gives (body styles it does not fit, modifications needed, off-road / race use only, tune required). Empty if none.
- seoTitleEn / seoTitleUa: max 60 characters, include "Valvetronic", the car and the part; UA must be in Ukrainian.
- seoDescriptionEn / seoDescriptionUa: 130–160 characters, factual, no prices, no delivery.
- imageAltEn / imageAltUa: short alt text for the main photo: brand, car and part.
- vehicles: every car from the title and the fitment lines. make as usual ("BMW", "Audi", "Mercedes-Benz", "Porsche", "Lamborghini", "Ferrari",
  "McLaren", "Aston Martin", "Bentley", "Chevrolet", "Ford", "Toyota", "Subaru", "Nissan", "Honda", "Acura", "Lexus", "Jeep", "Ram", "Volkswagen", "Bugatti", "Lotus");
  model as the car is sold ("M3", "M4", "S4", "RS6", "911", "Cayenne", "Huracan", "Urus", "Corvette", "Mustang", "Wrangler", "1500");
  chassisCode exactly as SOURCE (one code per entry; split "G80/G82" into two entries); engine when SOURCE ties the part to one engine (B58, S58);
  yearFrom/yearTo as numbers or null ("2021+" → 2021 and null); body style or version note goes to note.
  Universal parts and parts for "all models" of a make (e.g. "fits all Ferraris with vacuum valves"): empty list, never a placeholder model such as "All Models".`;

export function valvetronicCopySourceText(product) {
  const lines = [
    `Title on valvetronic.com: ${product.title}`,
    `Product type: ${product.productType || "not set"}`,
  ];
  if (product.optionNames.length) {
    lines.push(`Options: ${product.optionNames.join(", ")}`);
    lines.push(...product.variants.map((variant) => `- variant: ${variant.options.join(" / ")}`));
  }
  lines.push("Description:", ...product.bodyParagraphs);
  return lines.join("\n");
}

/** The sourceHash runSupplierCopy records for this product's copy. */
export function valvetronicCopySourceHash(product) {
  return createHash("sha256")
    .update(`${VALVETRONIC_COPY_PROMPT}\n${valvetronicCopySourceText(product)}`)
    .digest("hex")
    .slice(0, 16);
}
