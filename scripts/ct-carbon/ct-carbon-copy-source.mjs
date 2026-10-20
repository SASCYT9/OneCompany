/**
 * What the CT Carbon copy is written from: the Gemini prompt and each product's SOURCE text.
 * runSupplierCopy stores sha256(prompt + SOURCE) as sourceHash, so the importer can refuse
 * copy written for an older SOURCE.
 */
import { createHash } from "node:crypto";

import { COMMON_RULES } from "../catalog-copy/supplier-copy-core.mjs";

export const CT_CARBON_COPY_PROMPT = `You write product pages for One Company (onecompany.global), a Kyiv tuning-parts shop, in Ukrainian and English.
Brand: CT Carbon (United Kingdom): carbon fibre exterior and interior styling parts, plus the BLAK by CT range in gloss black ABS plastic.
"CT DESIGN" in a title means CT Carbon's own in-house design.

${COMMON_RULES}
- Keep version labels exactly (V1, V2, V12 …): products differ only by version, so every title must keep its version.
- Never write "CT DESIGN" in titles; say it is CT Carbon's own design in the intro instead.
- A bootlid / boot lid is the rear boot (trunk) lid: кришка багажника, never капот.
- Keep chassis and generation codes exactly (G80, G82, F90, 8Y, B9, C8, L663, W213, 992.2 …).
- Glossary (EN → UA): carbon fibre → карбон; pre-preg carbon fibre → препрег-карбон (pre-preg); dry carbon → сухий карбон (dry carbon);
  forged carbon → кований карбон (forged carbon); matte carbon → матовий карбон; gloss black → глянцевий чорний; ABS plastic → ABS-пластик;
  front splitter → передній спліттер; side skirts / side skirt extensions → накладки порогів; rear diffuser → задній дифузор;
  boot spoiler / ducktail → спойлер на кришку багажника (дактейл); roof spoiler → спойлер на дах; middle spoiler → середній спойлер;
  canards → канарди; bonnet / hood → капот; bootlid → кришка багажника; arches / wide arch kit → розширювачі арок / широкий обвіс;
  mirror covers / mirrors → накладки на дзеркала; grille / kidney grille → решітка радіатора / ніздрі решітки; vents → повітрозабірники;
  bumper trim → накладки бампера; bumper corners → накладки кутів бампера; exhaust tips → насадки вихлопу; engine cover → кришка двигуна;
  DRL module → модуль денних ходових вогнів (DRL); steering wheel → кермо; flat bottom → з пласким низом; Alcantara → алькантара;
  full kit → повний обвіс; rear end kit → обвіс задньої частини; front end pack → обвіс передньої частини;
  LCI / facelift → рестайлінг (LCI); pre-LCI → дорестайлінг (pre-LCI); RHD → праворульні авто (RHD); LHD → ліворульні авто (LHD);
  lane assist → асистент утримання смуги; ACC → адаптивний круїз-контроль (ACC); OEM → заводська деталь (OEM).

Fields:
- titleEn / titleUa: start with "CT Carbon", then the car (make, model, chassis code, years as in SOURCE), then what the part is, its material and version.
  Examples: EN "CT Carbon BMW M3 G80 (2021+) Carbon Fibre Full Kit V25"; UA "CT Carbon — карбоновий повний обвіс для BMW M3 G80 (2021+), V25";
  EN "CT Carbon Land Rover Defender L663 (2020+) Gloss Black Diffuser"; UA "CT Carbon — глянцевий чорний дифузор для Land Rover Defender L663 (2020+)".
  Max 110 characters.
- shortDescEn / shortDescUa: 1–2 sentences, max 200 characters: what it is and the main reason to buy.
- introEn / introUa: exactly 2 short paragraphs, 2 sentences each.
- keyPointsEn / keyPointsUa: 3–5 short bullets (max 100 characters each).
- specsEn / specsUa: 3–6 rows {label, value}: material, finish, number of pieces, what it replaces, fitment notes — only what SOURCE states.
- inBoxEn / inBoxUa: for kits and packs, one line per part SOURCE lists, keeping that part's version label (V1, V2 …) and piece count exactly as on its own SOURCE line ("1-Piece Front Splitter V2" → "Передній спліттер V2 (1 деталь)"); empty for single parts or when SOURCE gives no list.
- fitmentEn / fitmentUa: one line per car SOURCE names (make, model, chassis, years, version notes such as LHD/RHD or "not S or Performante").
- importantEn / importantUa: cautions SOURCE gives (e.g. which versions it does not fit, LHD/RHD, needs the factory aero pack). Empty if none.
- seoTitleEn / seoTitleUa: max 60 characters, include "CT Carbon", the car and the part; UA must be in Ukrainian.
- seoDescriptionEn / seoDescriptionUa: 130–160 characters, factual, no prices, no delivery.
- imageAltEn / imageAltUa: short alt text for the main photo: brand, car and part.
- vehicles: every car from the title and the fitment note. make as usual ("BMW", "Audi", "Mercedes-Benz", "Porsche", "Lamborghini", "Ferrari",
  "McLaren", "Land Rover", "Volkswagen", "Toyota", "Ford", "Rolls-Royce"); model as the car is sold ("M3", "M4", "3 Series", "X5 M", "RS3", "A3",
  "Urus", "911", "Defender", "Golf"); chassisCode exactly as SOURCE (one code per entry; split "G80/G81" into two entries);
  yearFrom/yearTo as numbers or null ("2021+" → 2021 and null); body style or facelift note (e.g. "Saloon", "Sportback", "LCI") goes to note.`;

export function ctCarbonCopySourceText(product) {
  const lines = [
    `Title on ctcarbon.co: ${product.title}`,
    `Range: ${/blak/i.test(product.vendor) ? "BLAK by CT (gloss black)" : "CT Carbon"}`,
    `Part type: ${product.productType || "not set"}`,
  ];
  if (product.fitmentNote) lines.push(`Fitment note: ${product.fitmentNote}`);
  if (product.optionNames.length) {
    lines.push(`Options: ${product.optionNames.join(", ")}`);
    lines.push(...product.variants.map((variant) => `- variant: ${variant.options.join(" / ")}`));
  }
  lines.push("Description:", ...product.bodyParagraphs);
  return lines.join("\n");
}

/** The sourceHash runSupplierCopy records for this product's copy. */
export function ctCarbonCopySourceHash(product) {
  return createHash("sha256")
    .update(`${CT_CARBON_COPY_PROMPT}\n${ctCarbonCopySourceText(product)}`)
    .digest("hex")
    .slice(0, 16);
}
