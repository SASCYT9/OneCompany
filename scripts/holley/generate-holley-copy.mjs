#!/usr/bin/env node
/**
 * Ukrainian and English product copy for Dinan / APR product groups (Gemini).
 *
 * Input:  data/<brand>/source.json (scripts/holley/build-holley-source.ts)
 * Output: data/<brand>/copy.json   (one entry per product group, resumable)
 *
 *   node --env-file=<env with SHOP_AI_API_KEY> scripts/holley/generate-holley-copy.mjs --brand=dinan [--only=dinan:D120-0630] [--force] [--validate-only]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { COMMON_RULES, runSupplierCopy } from "../catalog-copy/supplier-copy-core.mjs";

const brand = process.argv.find((value) => value.startsWith("--brand="))?.split("=")[1];
if (brand !== "dinan" && brand !== "apr") throw new Error("--brand=dinan|apr is required");

const BRAND_LINE = {
  dinan: "Brand: Dinan (USA), performance parts for BMW, MINI and Toyota GR Supra.",
  apr: "Brand: APR (USA), performance parts for Volkswagen, Audi, SEAT, Škoda and Porsche.",
}[brand];
const BRAND_NAME = { dinan: "Dinan", apr: "APR" }[brand];

const SYSTEM_PROMPT = `You write product pages for One Company (onecompany.global), a Kyiv tuning-parts shop, in Ukrainian and English.
${BRAND_LINE}

${COMMON_RULES}
- Do not mention the brand's history, US laws, California/CARB/EPA emissions status, Proposition 65, warranty or reviews.
- Do not list shipping weight or package dimensions as product specifications.
- When SOURCE lists versions, the description text belongs to one version only: write about the product as a whole, never present
  that version's length, size, colour or finish as the product's own, list every version in one spec row, and keep facts that hold
  for one version only (e.g. which spacer a bolt length suits) in importantEn / importantUa, naming that version.
- Keep established English terms where Ukrainian tuners use them: cat-back, axle-back, downpipe, intake, Big Brake Kit, catch can, Haldex, Stage 1/2.
- Glossary (EN → UA): cold air intake → система холодного впуску; turbo inlet → впускний патрубок турбіни; charge pipe → патрубок наддуву;
  intercooler → інтеркулер; heat exchanger → теплообмінник; axle-back exhaust → задня частина вихлопу (axle-back); cat-back → вихлопна система cat-back;
  midpipe → середня частина вихлопу (midpipe); resonator delete → видалення резонатора; exhaust tips → насадки вихлопу; muffler → глушник;
  anti-roll bar / sway bar → стабілізатор поперечної стійкості; spring set → комплект пружин; coilovers → койловери; shock / strut → амортизатор / стійка;
  camber plate → опори для регулювання розвалу; ball joint / monoball → кульова опора; strut brace → розпірка стійок; toe link → тяга сходження;
  bushing → сайлентблок; big brake kit → гальмівна система Big Brake Kit; caliper → супорт; rotor / disc → гальмівний диск; brake pads → гальмівні колодки;
  brake line → гальмівний шланг; ignition coil → котушка запалювання; spark plug → свічка запалювання; forged wheel → кований диск;
  flow formed wheel → диск flow forming; lug bolt → колісний болт; center cap → ковпачок диска; pulley → шків; throttle body → дросельна заслінка;
  fuel pump → паливний насос; injector → форсунка; diverter valve → перепускний клапан; short shifter → короткоходова куліса;
  floor mats → килимки салону; pedal covers → накладки на педалі; steering wheel → кермо; carbon fiber → карбон; engine cover → кришка двигуна;
  mirror caps → накладки дзеркал; splitter → спліттер; diffuser → дифузор; side skirts → пороги; air filter → повітряний фільтр;
  double-walled → двостінні; single-walled → одностінні; slash-cut → з косим зрізом; polished → поліровані; brushed → шліфовані;
  supercharger belt → ремінь компресора; lug bolt → колісний болт; wheel spacer → колісна проставка.
- The Ukrainian title also starts with "${BRAND_NAME}" (e.g. "${BRAND_NAME} ремінь компресора для …").

Fields:
- titleEn / titleUa: start with "${BRAND_NAME}", then what it is, then "for"/"для" the make, models and chassis codes from SOURCE (years in brackets if SOURCE gives them).
  Example: EN "${BRAND_NAME} Anti-Roll Bar Set for BMW 330i/M340i (G20) and 430i/M440i (G22)"; UA "${BRAND_NAME} стабілізатори поперечної стійкості для BMW 330i/M340i (G20) та 430i/M440i (G22)".
  When SOURCE lists too many models for the title, name the main models with their platform or years
  (e.g. "for VW Golf R and Audi S3 (MQB, 2015–2020)"); never only the makes.
  Keep every detail of the brand's product name that sets it apart from similar products: front/rear, left/right, FWD/AWD,
  single-/double-walled, set size, engine code, FMSI code of brake pads, and for universal parts the sizes (for mufflers also the body length).
  Do not put the finish or colour in the title when the product has variants; keep it when it has none. Max 110 characters.
- shortDescEn / shortDescUa: 1–2 sentences, max 230 characters: what it is and the main reason to buy.
- introEn / introUa: exactly 2 paragraphs, 2–3 sentences each, for a buyer deciding to purchase.
- keyPointsEn / keyPointsUa: 4–6 short bullets (max 110 characters each) with concrete benefits and facts from SOURCE (gains, sizes, materials).
- specsEn / specsUa: 3–8 rows {label, value} from SOURCE specifications and features: material, finish, sizes, adjustability, what changes vs stock,
  installation time (from "Labor Time (Hours)"), and the available versions when the product has variants. Never invent a value.
- inBoxEn / inBoxUa: kit contents only if SOURCE lists them; otherwise empty.
- fitmentEn / fitmentUa: one line per model from the vehicle applications and names (make, model, chassis code, years). Empty for universal parts.
  At most 12 lines: for long lists put the models of one series or chassis on one line.
- importantEn / importantUa: installation notes, incompatibilities and requirements from SOURCE (e.g. professional installation, parts needed). Empty if none.
- seoTitleEn / seoTitleUa: max 60 characters, include "${BRAND_NAME}", what it is and the main model; UA must be in Ukrainian.
- seoDescriptionEn / seoDescriptionUa: 130–160 characters, factual, no prices, no delivery.
- imageAltEn / imageAltUa: short alt text for the main photo: brand, product and car.
- vehicles: one entry per model from the vehicle applications ("BMW", "MINI", "Toyota", "Volkswagen", "Audi", "SEAT", "Škoda", "Porsche").
  model exactly as the applications list it (e.g. "M340i", "M3", "Golf R", "S3"); chassisCode only when SOURCE names it for that model;
  engine from SOURCE (e.g. "B58", "S58", "EA888") or null; yearFrom/yearTo from the name or applications for that model; market and note null unless SOURCE says.
  For long application lists (more than 12 models) leave yearFrom/yearTo null unless SOURCE gives years for each model.
  Empty for universal parts.`;

function normalizeName(name) {
  return String(name ?? "")
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const IGNORED_ATTRIBUTES = new Set([
  "Brand",
  "Dinan Point Value",
  "Emission Code",
  "Warning",
  "UPC",
  "Part Number",
  "Category",
  "Sub Category",
]);

function sourceText(group, sharedNames) {
  const primary =
    group.variants.find((variant) => variant.sku === group.primarySku) ?? group.variants[0];
  const page = primary.page;
  const lines = [`Brand: ${BRAND_NAME}`];
  if (page && sharedNames.has(normalizeName(page.name))) {
    // The brand gives several products this very name: the dealer price list and the
    // short description are what tell them apart, and the title has to say it.
    lines.push(
      "Another product has the same name on the brand site: the title must name what sets this one apart.",
      `Dealer price-list description: ${group.variants.map((variant) => variant.priceList.description).join(" / ")}`
    );
  }
  if (group.variants.length > 1) {
    lines.push(`Versions (${group.optionNames.join(" / ")}):`);
    for (const variant of group.variants) {
      const own = variant.page
        ? ` (${[variant.page.name.split("\n")[0], variant.page.short].filter(Boolean).join(" | ")})`
        : "";
      lines.push(`- ${variant.sku}: ${variant.optionValues.join(" / ")}${own}`);
    }
    lines.push(`The description below is from the ${primary.sku} page.`);
  } else {
    lines.push(`Part number: ${primary.sku}`);
  }
  if (!page) {
    lines.push(`Price-list description: ${primary.priceList.description ?? ""}`);
    lines.push(`Price-list category: ${primary.priceList.category ?? ""}`);
    return lines.join("\n");
  }
  lines.push(`Name on the brand site: ${page.name.split("\n").join(" | ")}`);
  if (page.short) lines.push(`Short description: ${page.short}`);
  if (page.category) lines.push(`Category: ${page.category}`);
  lines.push("Description:", stripHtml(page.desc).slice(0, 4000));
  if (page.features?.length) {
    lines.push("Features:");
    lines.push(...page.features.map((feature) => `- ${stripHtml(feature)}`));
  }
  const attrs = Object.entries(page.attrs ?? {}).filter(([key]) => !IGNORED_ATTRIBUTES.has(key));
  if (attrs.length) {
    lines.push("Specifications:");
    lines.push(...attrs.map(([key, value]) => `- ${key}: ${value}`));
  }
  if (page.install) lines.push(`Installation notes: ${stripHtml(page.install)}`);
  if (page.notes) lines.push(`Product notes: ${stripHtml(page.notes)}`);
  const apps = page.apps;
  if (apps && !apps.error && apps.makes?.length) {
    lines.push(
      "Vehicle applications:",
      `- makes: ${apps.makes.join(", ")}`,
      `- models: ${apps.models.join(", ")}`,
      `- years: ${apps.years.join(", ")}`,
      `- engines: ${apps.engines.map((engine) => engine.replace(/^\//, "")).join(", ")}`,
      `- body styles: ${apps.bodies.join(", ")}`
    );
  } else if (String(page.universal) === "true") {
    lines.push("Vehicle applications: universal part");
  }
  if (page.docs?.length) lines.push("Installation instructions: available as PDF from the brand.");
  return lines.join("\n");
}

const source = JSON.parse(await readFile(path.resolve("data", brand, "source.json"), "utf8"));
// Without the brand's own page there is no description, photo or fitment to write from.
const withPage = source.groups.filter((group) => group.variants.some((variant) => variant.page));
const nameCounts = new Map();
for (const group of withPage) {
  const primary =
    group.variants.find((variant) => variant.sku === group.primarySku) ?? group.variants[0];
  if (!primary.page) continue;
  const name = normalizeName(primary.page.name);
  nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
}
const sharedNames = new Set([...nameCounts].filter(([, count]) => count > 1).map(([name]) => name));
await runSupplierCopy({
  label: BRAND_NAME,
  items: withPage.map((group) => ({ id: group.id, sourceText: sourceText(group, sharedNames) })),
  outputPath: path.resolve("data", brand, "copy.json"),
  overridesPath: path.resolve("data", brand, "overrides.json"),
  systemPrompt: SYSTEM_PROMPT,
});
