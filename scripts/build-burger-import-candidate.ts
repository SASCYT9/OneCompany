/**
 * Build a review-only catalog candidate with every source variant and an
 * estimate for the agreed Brooklyn-to-Ukraine price formula.
 * Run: npx tsx scripts/build-burger-import-candidate.ts YYYY-MM-DD
 * This writes only under tmp/ and never calls the import API.
 */
import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { calculateBurgerVariantPrice } from "../src/lib/burgerRepricing";

type SourceVariant = {
  id: number;
  title: string;
  sku?: string | null;
  price: string;
  compare_at_price?: string | null;
  grams?: number;
  available?: boolean;
  image_id?: number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};
type SourceProduct = {
  id: number;
  handle: string;
  title: string;
  vendor?: string;
  product_type?: string;
  body_html?: string;
  tags?: string[];
  options?: Array<{ name: string; position: number; values: string[] }>;
  variants: SourceVariant[];
  images?: Array<{ id: number; src: string; alt?: string }>;
};

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Pass YYYY-MM-DD");
const root = process.cwd();
const tmpDir = path.join(root, "tmp");
const pageFiles = fs.readdirSync(tmpDir)
  .filter((name) => name.startsWith(`burger-products-${date}-page`) && name.endsWith(".json"))
  .sort((a, b) => Number(a.match(/page(\d+)/)?.[1]) - Number(b.match(/page(\d+)/)?.[1]));
if (!pageFiles.length) throw new Error(`No supplier snapshot found for ${date}`);

const source: SourceProduct[] = pageFiles.flatMap((name) =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, name), "utf8")).products ?? []
);
const config = JSON.parse(fs.readFileSync(
  path.join(tmpDir, `burger-configurations-${date}.json`), "utf8"
)) as Array<{
  handle: string;
  variants: Array<{
    sourceVariantId: number;
    title: string;
    optionValues: string[];
    supplierSku: string | null;
    internalKey: string;
    salePriceUsd: number;
    compareAtUsd: number | null;
    regularSupplierUsd: number;
    sourceGrams: number;
    available: boolean;
  }>;
}>;
const configByHandle = new Map(config.map((item) => [item.handle, item]));
const catalogPath = path.join(root, "public", "catalog-fallback");
const catalogManifest = JSON.parse(fs.readFileSync(path.join(catalogPath, "manifest.json"), "utf8"));
const burgerDescriptor = catalogManifest.stores?.burger;
if (!burgerDescriptor?.file) throw new Error("Burger fallback shard missing");
const local = JSON.parse(fs.readFileSync(path.join(catalogPath, burgerDescriptor.file), "utf8"));
const localBySlug = new Map(local.map((item: { slug: string }) => [item.slug, item]));
const fitmentOptions = JSON.parse(fs.readFileSync(
  path.join(root, "src", "app", "[locale]", "shop", "data", "burgerFitmentOptions.json"), "utf8"
)) as Record<string, { models: Record<string, unknown> }>;
const copyDraftsPath = path.join(tmpDir, `burger-copy-drafts-${date}.json`);
const copyDrafts = fs.existsSync(copyDraftsPath)
  ? JSON.parse(fs.readFileSync(copyDraftsPath, "utf8"))
  : {};

const profiles: Record<string, {
  minProductKg: number; packagingKg: number; lengthCm: number; widthCm: number;
  heightCm: number; domesticShippingUsd: number; confidence: "category-estimate" | "source-weight";
}> = {
  "JB4 Tuners": { minProductKg: 1.2, packagingKg: 0.35, lengthCm: 25, widthCm: 20, heightCm: 9, domesticShippingUsd: 10, confidence: "category-estimate" },
  "JB+ Tuners": { minProductKg: 0.8, packagingKg: 0.3, lengthCm: 23, widthCm: 18, heightCm: 8, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Stage 1 Tuners": { minProductKg: 0.8, packagingKg: 0.3, lengthCm: 23, widthCm: 18, heightCm: 8, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Flex Fuel Kits": { minProductKg: 0.8, packagingKg: 0.35, lengthCm: 38, widthCm: 30, heightCm: 18, domesticShippingUsd: 15, confidence: "category-estimate" },
  Intakes: { minProductKg: 2.5, packagingKg: 0.9, lengthCm: 70, widthCm: 45, heightCm: 35, domesticShippingUsd: 25, confidence: "category-estimate" },
  "Oil Catch Cans": { minProductKg: 1.0, packagingKg: 0.55, lengthCm: 42, widthCm: 32, heightCm: 25, domesticShippingUsd: 18, confidence: "category-estimate" },
  "Wheel Spacers & Accessories": { minProductKg: 1.4, packagingKg: 0.45, lengthCm: 32, widthCm: 30, heightCm: 16, domesticShippingUsd: 15, confidence: "category-estimate" },
  "Methanol Injection": { minProductKg: 1.6, packagingKg: 0.65, lengthCm: 48, widthCm: 32, heightCm: 24, domesticShippingUsd: 20, confidence: "category-estimate" },
  "Universal Methanol Injection": { minProductKg: 1.6, packagingKg: 0.65, lengthCm: 48, widthCm: 32, heightCm: 24, domesticShippingUsd: 20, confidence: "category-estimate" },
  "Fuel Pumps": { minProductKg: 0.7, packagingKg: 0.4, lengthCm: 32, widthCm: 26, heightCm: 18, domesticShippingUsd: 15, confidence: "category-estimate" },
  "Port Injection & Manifolds": { minProductKg: 1.3, packagingKg: 0.55, lengthCm: 42, widthCm: 34, heightCm: 26, domesticShippingUsd: 20, confidence: "category-estimate" },
  "Charge Pipes": { minProductKg: 1.8, packagingKg: 0.7, lengthCm: 68, widthCm: 32, heightCm: 22, domesticShippingUsd: 22, confidence: "category-estimate" },
  "Air Filters": { minProductKg: 0.6, packagingKg: 0.35, lengthCm: 40, widthCm: 30, heightCm: 16, domesticShippingUsd: 15, confidence: "category-estimate" },
  "Engine Accessories": { minProductKg: 0.6, packagingKg: 0.35, lengthCm: 32, widthCm: 26, heightCm: 16, domesticShippingUsd: 12, confidence: "category-estimate" },
  "Blow Off Valves & Adapters": { minProductKg: 0.6, packagingKg: 0.35, lengthCm: 30, widthCm: 24, heightCm: 17, domesticShippingUsd: 12, confidence: "category-estimate" },
  "Spark Plugs & Accessories": { minProductKg: 0.6, packagingKg: 0.3, lengthCm: 28, widthCm: 22, heightCm: 14, domesticShippingUsd: 12, confidence: "category-estimate" },
  "Cooling & Heat Shields": { minProductKg: 1.8, packagingKg: 0.7, lengthCm: 54, widthCm: 42, heightCm: 28, domesticShippingUsd: 22, confidence: "category-estimate" },
  Sensors: { minProductKg: 0.35, packagingKg: 0.25, lengthCm: 26, widthCm: 20, heightCm: 12, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Exhaust Tips": { minProductKg: 1.1, packagingKg: 0.55, lengthCm: 62, widthCm: 25, heightCm: 23, domesticShippingUsd: 20, confidence: "category-estimate" },
  "Strut Braces": { minProductKg: 2.5, packagingKg: 0.9, lengthCm: 120, widthCm: 28, heightCm: 20, domesticShippingUsd: 30, confidence: "category-estimate" },
  "Chassis Reinforcement & Accessories": { minProductKg: 1.8, packagingKg: 0.75, lengthCm: 86, widthCm: 42, heightCm: 26, domesticShippingUsd: 25, confidence: "category-estimate" },
  "Turbo Inlets & Turbo Accessories": { minProductKg: 1.2, packagingKg: 0.45, lengthCm: 42, widthCm: 30, heightCm: 21, domesticShippingUsd: 16, confidence: "category-estimate" },
  "OBDII Dongles & Accessories": { minProductKg: 0.35, packagingKg: 0.25, lengthCm: 24, widthCm: 18, heightCm: 9, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Transmission Coolers": { minProductKg: 3.0, packagingKg: 1.0, lengthCm: 86, widthCm: 52, heightCm: 32, domesticShippingUsd: 35, confidence: "category-estimate" },
  "Clutch Stops": { minProductKg: 0.3, packagingKg: 0.25, lengthCm: 21, widthCm: 17, heightCm: 10, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Billet Accessories": { minProductKg: 0.4, packagingKg: 0.28, lengthCm: 26, widthCm: 20, heightCm: 11, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Pedal Tuners": { minProductKg: 0.5, packagingKg: 0.3, lengthCm: 28, widthCm: 21, heightCm: 12, domesticShippingUsd: 10, confidence: "category-estimate" },
  "Dragy & Dragy Accessories": { minProductKg: 0.4, packagingKg: 0.28, lengthCm: 25, widthCm: 18, heightCm: 9, domesticShippingUsd: 10, confidence: "category-estimate" },
  "License Plate Accessories": { minProductKg: 0.4, packagingKg: 0.3, lengthCm: 32, widthCm: 24, heightCm: 10, domesticShippingUsd: 12, confidence: "category-estimate" },
  "Universal Products": { minProductKg: 0.7, packagingKg: 0.4, lengthCm: 36, widthCm: 27, heightCm: 18, domesticShippingUsd: 15, confidence: "category-estimate" },
  PARTS: { minProductKg: 0.7, packagingKg: 0.4, lengthCm: 36, widthCm: 27, heightCm: 18, domesticShippingUsd: 15, confidence: "category-estimate" },
  DEFAULT: { minProductKg: 0.7, packagingKg: 0.4, lengthCm: 36, widthCm: 27, heightCm: 18, domesticShippingUsd: 15, confidence: "category-estimate" },
};

const TYPE_TAGS: Record<string, string> = {
  "JB4 Tuners": "jb4-tuners", "JB+ Tuners": "jb-plus-tuners", "Stage 1 Tuners": "stage-1-tuners",
  "Flex Fuel Kits": "flex-fuel", Intakes: "intakes", "Oil Catch Cans": "oil-catch-cans",
  "Wheel Spacers & Accessories": "wheel-spacers", "Methanol Injection": "methanol-injection",
  "Fuel Pumps": "fuel-pumps", "Port Injection & Manifolds": "port-injection", "Charge Pipes": "charge-pipes",
  "Air Filters": "air-filters", "Engine Accessories": "engine-accessories",
  "Blow Off Valves & Adapters": "blow-off-valves", "Spark Plugs & Accessories": "spark-plugs",
  "Cooling & Heat Shields": "cooling", Sensors: "sensors", "Exhaust Tips": "exhaust-tips",
  "Strut Braces": "strut-braces", "Turbo Inlets & Turbo Accessories": "turbo-accessories",
  "OBDII Dongles & Accessories": "obdii-accessories", "Chassis Reinforcement & Accessories": "chassis-reinforcement",
  "Transmission Coolers": "transmission-coolers", "Clutch Stops": "clutch-stops", "Billet Accessories": "billet-accessories",
  "Pedal Tuners": "pedal-tuners", "Dragy & Dragy Accessories": "dragy", "Universal Products": "universal",
  "Universal Methanol Injection": "methanol-injection", "License Plate Accessories": "universal", PARTS: "universal",
};
const brandRules: Array<[string, RegExp]> = [
  ["BMW", /\bBMW\b|\bN54\b|\bN55\b|\bB58\b|\bS58\b|\bS63\b|\bS68\b/i],
  ["Toyota", /\bToyota\b|\bSupra\b|\bTacoma\b|\b4Runner\b|\bTundra\b/i],
  ["Mercedes", /\bMercedes(?:-Benz)?\b|\bAMG\b/i],
  ["Porsche", /\bPorsche\b|\bCayenne\b|\bMacan\b|\b718\b/i],
  ["Audi", /\bAudi\b|\bEA888\b|\bTTRS\b/i],
  ["VW", /\bVolkswagen\b|\bVW\b|\bGTI\b|\bGolf R\b|\bEA888\b/i],
  ["Kia", /\bKia\b|\bStinger\b|\bOptima\b|\bSportage\b/i],
  ["Hyundai", /\bHyundai\b|\bGenesis\b|\bVeloster\b|\bSonata\b|\bElantra N\b/i],
  ["Infiniti", /\bInfiniti\b|\bQ50\b|\bQ60\b|\bQX80\b/i],
  ["Nissan", /\bNissan\b|\bGT-?R\b|\b370Z\b|\b400Z\b/i],
  ["Ford", /\bFord\b|\bMustang\b|\bBronco\b|\bF-?150\b|\bRaptor\b/i],
  ["Dodge", /\bDodge\b|\bCharger\b|\bChallenger\b|\bHellcat\b/i],
  ["Jeep", /\bJeep\b|\bCompass\b|\bWrangler\b/i],
  ["Subaru", /\bSubaru\b|\bWRX\b|\bBRZ\b/i],
  ["Honda", /\bHonda\b|\bCivic\b|\bAccord\b/i],
  ["Chevrolet", /\bChevrolet\b|\bCamaro\b|\bCorvette\b|\bGMC\b/i],
  ["Lexus", /\bLexus\b|\bLX ?600\b|\bGX ?550\b/i],
  ["Mini", /\bMINI\b|\bMini Cooper\b/i],
  ["Volvo", /\bVolvo\b/i],
  ["Tesla", /\bTesla\b|\bModel [S3XY]\b/i],
  ["Mazda", /\bMazda\b|\bMiata\b|\bCX-?\d\b/i],
  ["Alfa Romeo", /\bAlfa Romeo\b|\bGiulia\b|\bStelvio\b/i],
  ["Maserati", /\bMaserati\b|\bGhibli\b/i],
  ["McLaren", /\bMcLaren\b/i], ["Lotus", /\bLotus\b|\bEmira\b/i],
  ["Aston Martin", /\bAston Martin\b/i], ["Cadillac", /\bCadillac\b|\bCT[45]-?V\b/i],
  ["Acura", /\bAcura\b|\bIntegra\b|\bTLX\b/i], ["RAM", /\bRAM\b|\bHemi\b/i],
  ["Range Rover", /\bRange Rover\b|\bLand Rover\b|\bDefender\b/i],
];

function stripHtml(html: string) {
  const $ = load(String(html ?? ""));
  $("script, style, noscript").remove();
  return $.root().text().replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'").replace(/\s+/g, " ").trim();
}
function cleanSku(value: string | null | undefined, variantId: number) {
  const sku = String(value ?? "").trim();
  return sku && !/\s/.test(sku) && /^[A-Za-z0-9]/.test(sku) ? sku : `BURGER-V-${variantId}`;
}
function cleanOptionValue(value: string) {
  return String(value ?? "")
    .replace(/\s*\([^)]*\$\s*[\d,.]+[^)]*\)/gi, "")
    .replace(/\s*save\s+\$[\d,.]+(?:\s*USD)?/gi, "")
    .replace(/\s*\b(?:save\s+)?\d+(?:\.\d+)?%\s*(?:off)?[^\]]*\]?/gi, "")
    .replace(/\s*\[[^\]]*\$\s*[\d,.]+[^\]]*\]/gi, "")
    .replace(/\s*[-–]?\s*\$\s*[\d,.]+\s*(?:USD)?\b/gi, "")
    .replace(/\bFREE\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function displayOptionValues(values: string[]) {
  return values.map(cleanOptionValue);
}
function embeddedOptionRegularPriceUsd(values: string[]) {
  const pricePatterns = [
    /\(\s*\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:USD)?\s*\)/gi,
    /\[\s*\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:USD)?\s*\]/gi,
    /\s-\s*\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:USD)?\s*$/gi,
  ];
  const amounts: number[] = [];
  for (const value of values) {
    for (const pattern of pricePatterns) {
      pattern.lastIndex = 0;
      for (const match of value.matchAll(pattern)) {
        const amount = Number(String(match[1]).replaceAll(",", ""));
        if (Number.isFinite(amount) && amount > 0) amounts.push(amount);
      }
    }
  }
  return amounts.length ? Math.max(...amounts) : null;
}
function inferSourceFitmentTags(product: SourceProduct) {
  const tags = new Set<string>();
  const makeAliases: Array<[string, string]> = [
    ["mercedes-benz", "Mercedes"], ["mercedes", "Mercedes"],
    ["volkswagen", "VW"], ["vw", "VW"], ["range-rover", "Range Rover"],
    ["land-rover", "Range Rover"], ["alfa-romeo", "Alfa Romeo"],
    ["aston-martin", "Aston Martin"], ["mini", "Mini"], ["genesis", "Hyundai"],
    ["bmw", "BMW"], ["toyota", "Toyota"], ["kia", "Kia"], ["hyundai", "Hyundai"],
    ["infiniti", "Infiniti"], ["nissan", "Nissan"], ["ford", "Ford"], ["dodge", "Dodge"],
    ["subaru", "Subaru"], ["honda", "Honda"], ["chevrolet", "Chevrolet"],
    ["gmc", "Chevrolet"], ["lexus", "Lexus"], ["volvo", "Volvo"], ["tesla", "Tesla"],
    ["mazda", "Mazda"], ["jeep", "Jeep"], ["ram", "RAM"], ["porsche", "Porsche"],
    ["audi", "Audi"], ["maserati", "Maserati"], ["mclaren", "McLaren"], ["lotus", "Lotus"],
    ["cadillac", "Cadillac"], ["acura", "Acura"], ["fiat", "Fiat"],
  ];
  const fitmentTags = (product.tags ?? []).filter((tag) =>
    !/^(?:all products|free shipping|reliable|designed|warning|other-wholesale|bluetooth-app)/i.test(tag)
  );
  for (const raw of fitmentTags) {
    const slug = raw.toLowerCase();
    const alias = makeAliases.find(([prefix]) => slug.startsWith(`${prefix}-`));
    if (!alias) continue;
    const [prefix, brand] = alias;
    const rest = slug.slice(prefix.length + 1);
    const models = Object.keys(fitmentOptions[brand]?.models ?? {});
    for (const model of models) {
      const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const variants = new Set([modelSlug, modelSlug.replaceAll("-", "")]);
      const matches = [...variants].some((candidate) => {
        if (rest === candidate || rest.startsWith(`${candidate}-`) || rest.startsWith(`${candidate}--`)) return true;
        return new RegExp(`(?:^|-)${candidate}(?:-|$)`).test(rest);
      });
      if (matches) tags.add(`model:${model}`);
    }
    if (brand === "BMW") {
      for (const chassis of rest.match(/\b(?:e|f|g|u|i)\d{2}\b/gi) ?? []) {
        tags.add(`chassis:${chassis.toUpperCase()}`);
      }
    }
    for (const year of rest.match(/\b20\d{2}\b/g) ?? []) tags.add(`year:${year}`);
  }
  return [...tags];
}
function brandTags(product: SourceProduct, existingTags: string[] = []) {
  const kept = existingTags.filter((tag) => !tag.startsWith("brand:") && !tag.startsWith("type:") && !tag.startsWith("vendor:"));
  const evidence = `${product.title} ${product.tags?.join(" ") ?? ""}`;
  const brands = brandRules.filter(([, pattern]) => pattern.test(evidence)).map(([brand]) => brand);
  const resolved = brands.length ? brands : ["Universal"];
  return [...new Set([
    ...kept,
    ...inferSourceFitmentTags(product),
    ...resolved.map((brand) => `brand:${brand}`),
    `type:${TYPE_TAGS[product.product_type ?? ""] ?? "universal"}`,
    "vendor:burger-motorsports",
  ])];
}
function optionWeightAdditions(values: string[], infer: boolean) {
  if (!infer) return [] as Array<{ name: string; kg: number }>;
  const additions: Array<{ name: string; kg: number }> = [];
  for (const value of values) {
    const text = value.toLowerCase();
    if (/\b(?:do not|don't|without|no extra|not include|not add)\b/.test(text)) continue;
    // Color or washable/dry filter choices replace the same part and do not
    // add a second filter to the package.
    if (/\b(?:blue|red|black|white|dry|oiled)\b.{0,35}\bfilters?\b/.test(text)) continue;
    if (/\b(?:750|950|1050)\s?cc\b|injectors?\b/.test(text)) {
      additions.push({ name: value, kg: 0.4 });
      if (/fuel line/.test(text)) additions.push({ name: `${value} fuel line`, kg: 0.25 });
      continue;
    }
    if (/fuel pump/.test(text)) additions.push({ name: value, kg: 0.8 });
    else if (/catch ?can|oil catch/.test(text)) additions.push({ name: value, kg: 1.0 });
    else if (/cold air intake|intake kit|intake system/.test(text)) additions.push({ name: value, kg: 1.8 });
    else if (/\b(?:add|include|upgrade)\b/.test(text) && /\bfilters?\b/.test(text)) additions.push({ name: value, kg: 0.5 });
    else if (/flex fuel kit|flex fuel sensor/.test(text)) additions.push({ name: value, kg: 0.65 });
    else if (/controller|\bfsb\b|bluetooth eca|analyzer/.test(text)) additions.push({ name: value, kg: 0.35 });
    else if (/harness|wiring|cable|extension/.test(text)) additions.push({ name: value, kg: 0.25 });
    else if (/adapter|sensor/.test(text)) additions.push({ name: value, kg: 0.2 });
  }
  return additions;
}
function optionValues(variant: SourceVariant) {
  return [variant.option1, variant.option2, variant.option3].filter(
    (value): value is string => Boolean(value)
  );
}
function normalizedColorOptionKey(values: string[]) {
  const colorPattern = /\b(?:blue|red|black|white|green|yellow|orange|silver|gray|grey)\b/gi;
  if (!values.some((value) => /\b(?:blue|red|black|white|green|yellow|orange|silver|gray|grey)\b/i.test(value))) return null;
  return values.map((value) => value.toLowerCase().replace(colorPattern, "color").replace(/\s+/g, " ").trim()).join("|");
}
function hasFreeUsShipping(
  handle: string,
  bodyHtml: string,
  allVariantsAreCompleteKits = false,
  productType = "",
) {
  // Burger's official JB4 collection states free US shipping for JB4 tuners.
  // This is intentionally limited to the JB4 Tuners product type, not JB+ or Stage 1.
  if (productType === "JB4 Tuners") return true;
  // Burger advertises free shipping on complete Flex Fuel kits only; that
  // condition is variant-dependent, so require every available selection to
  // explicitly be a complete kit before applying the free-shipping exception.
  if (handle === "fuel-it-bluetooth-flex-fuel-kit-for-b58-bmw-x3-x4" && !allVariantsAreCompleteKits) return false;
  const text = stripHtml(bodyHtml).toLowerCase();
  if (/free\s+shipping.{0,80}complete\s+kits\s+only/.test(text) && !allVariantsAreCompleteKits) return false;
  return /free\s+shipping.{0,60}(?:in\s+)?(?:the\s+)?(?:usa|u\.s\.a\.?|united states)\b/.test(text);
}
function reviewedPackageOverride(handle: string, values: string[]) {
  const optionText = values.join(" ").toLowerCase();
  const mmWidth = Number(optionText.match(/\b(10|12|13|15|16|18|20)\s?mm\b/)?.[1] ?? 0);
  const inchWidth = /\b1\.5\s?(?:in|inch|\")/.test(optionText) ? 38.1 :
    /\b1\s?(?:in|inch|\")/.test(optionText) ? 25.4 : 0;
  const widthMm = mmWidth || inchWidth;

  if (handle === "2025-toyota-4runner-wheel-spacers" ||
      handle === "2022-lexus-lx600-wheel-spacers" ||
      handle === "2024-toyota-tacoma-wheel-spacers" ||
      handle === "toyota-tundra-sequoia-lexus-lx600-wheel-spacers") {
    const thicker = widthMm > 30;
    return {
      productKg: thicker ? 5.2 : 4.5,
      optionAdditions: [], packagingKg: 0.85,
      lengthCm: 38, widthCm: 36, heightCm: 24,
      domesticShippingUsd: 25,
    };
  }
  if (handle === "hub-centric-wheel-spacers-for-kia-hyundai-genesis") {
    return {
      productKg: widthMm >= 20 ? 3.25 : 2.9,
      optionAdditions: [], packagingKg: 0.65,
      lengthCm: 35, widthCm: 31, heightCm: 20,
      domesticShippingUsd: 18,
    };
  }
  if ([
    "toyota-supra-mk5-wheel-spacers",
    "f-chassis-burger-motorsports-bmw-wheel-spacer-kit-2-spacers-w-10-extended-lug-bolts",
    "g-chassis-burger-motorsports-bmw-wheel-spacer-kit-w-10-bolts",
    "e-chassis-burger-motorsports-bmw-wheel-spacers-1",
    "lightweight-g90-g91-bmw-m5-wheel-spacers-w-10-bolts",
  ].includes(handle)) {
    const lightweight = /lightweight/.test(optionText);
    return {
      productKg: 2.55 + (widthMm > 12 ? Math.min(widthMm - 12, 12) * 0.025 : 0) + (lightweight ? 0.15 : 0),
      optionAdditions: [], packagingKg: 0.65,
      lengthCm: 36, widthCm: 32, heightCm: 18,
      domesticShippingUsd: 18,
    };
  }
  if (handle === "bmw-xm-wheel-spacers") {
    return {
      productKg: widthMm >= 20 ? 3.2 : 2.9,
      optionAdditions: [], packagingKg: 0.7,
      lengthCm: 37, widthCm: 33, heightCm: 19,
      domesticShippingUsd: 20,
    };
  }
  if (handle === "x5-x6-burger-motorsports-bmw-wheel-spacer-kit-w-10-bolts-e-f-chassis") {
    return {
      productKg: 3.1, optionAdditions: [], packagingKg: 0.7,
      lengthCm: 38, widthCm: 34, heightCm: 20, domesticShippingUsd: 20,
    };
  }
  if ([
    "f-j-u-chassis-mini-cooper-burger-motorsports-wheel-spacers-w-10-bolts",
    "mini-cooper-wheel-spacers-by-bms-pair-2-wheels-w-10-black-extended-wheel-bolts",
  ].includes(handle)) {
    return {
      productKg: 2.65 + (widthMm > 12 ? Math.min(widthMm - 12, 8) * 0.02 : 0),
      optionAdditions: [], packagingKg: 0.65,
      lengthCm: 35, widthCm: 31, heightCm: 18, domesticShippingUsd: 18,
    };
  }
  if (handle === "racing-wheel-stud-conversion-kit-for-mini" ||
      handle === "wheel-stud-conversion-kit-for-toyota-supra-mk5-m14x1-25" ||
      handle === "bmw-wheel-stud-conversion-kit") {
    return {
      productKg: 1.9, optionAdditions: [], packagingKg: 0.4,
      lengthCm: 26, widthCm: 20, heightCm: 10, domesticShippingUsd: 12,
    };
  }
  if (handle === "bms-wheel-pin-tool") {
    const twoPack = /2\s?pack/.test(optionText);
    return {
      productKg: twoPack ? 0.3 : 0.18, optionAdditions: [], packagingKg: 0.18,
      lengthCm: 18, widthCm: 12, heightCm: 4, domesticShippingUsd: 10,
    };
  }
  if (handle === "bmw-floor-jack-pad-adapter" || handle === "jack-pad-adapter-for-2020-toyota-supra") {
    const count = Number(optionText.match(/\b(1|2|4)\s*(?:single\s*unit|pack)/)?.[1] ?? 1);
    return {
      productKg: 0.28 * count, optionAdditions: [], packagingKg: 0.25,
      lengthCm: 22, widthCm: 17, heightCm: 12, domesticShippingUsd: 10,
    };
  }
  if (handle === "bms-titanium-lug-nuts-m14x1-5-cone-seat-set-of-20" ||
      handle === "bms-elite-titanium-lug-nuts-m14x1-25-cone-seat-set-of-20" ||
      handle === "bms-elite-titanium-lug-nuts-for-tesla-21mm-hex-m14x1-5-cone-seat-set-of-20") {
    return {
      productKg: handle === "bms-elite-titanium-lug-nuts-for-tesla-21mm-hex-m14x1-5-cone-seat-set-of-20" ? 0.55 : 0.5,
      optionAdditions: [], packagingKg: 0.28,
      lengthCm: 20, widthCm: 15, heightCm: 8, domesticShippingUsd: 10,
    };
  }
  if (handle === "lug-bolts-only-bmw-mini") {
    return {
      productKg: 0.95, optionAdditions: [], packagingKg: 0.3,
      lengthCm: 23, widthCm: 18, heightCm: 8, domesticShippingUsd: 10,
    };
  }
  if (handle === "extra-copy-of-protective-wheel-saver-socket") {
    const triple = /17mm\s*\/\s*19mm\s*\/\s*21mm/.test(optionText);
    return {
      productKg: triple ? 1.05 : 0.48, optionAdditions: [], packagingKg: 0.28,
      lengthCm: 23, widthCm: 12, heightCm: 8, domesticShippingUsd: 10,
    };
  }
  if (handle === "scratch-dent-bmw-wheel-spacers-w-10-bolts-by-burger-motorsports") {
    return {
      productKg: 2.8 + (widthMm > 12 ? Math.min(widthMm - 12, 8) * 0.03 : 0),
      optionAdditions: [], packagingKg: 0.65,
      lengthCm: 36, widthCm: 32, heightCm: 18, domesticShippingUsd: 18,
    };
  }
  if (["x2-o-rings-gaskets-for-bms-s58-intake", "replacement-n54-n55-chargepipe-gasket-e-and-f-chassis",
    "replacement-n54-n55-chargepipe-clip-e-and-f-chassis", "1-8-npt-bung-plugs-w-thread-sealer-2-pack"].includes(handle)) {
    return {
      productKg: 0.15, optionAdditions: [], packagingKg: 0.12,
      lengthCm: 16, widthCm: 12, heightCm: 5, domesticShippingUsd: 10,
    };
  }
  if (handle === "n54-n55-silicone-chargepipe-elbow-and-2-clamps") {
    return {
      productKg: 0.9, optionAdditions: [], packagingKg: 0.3,
      lengthCm: 30, widthCm: 22, heightCm: 15, domesticShippingUsd: 12,
    };
  }
  if (handle === "350-horsepower-2-3l-ford-bronco-package") {
    const dryFilter = /dry extendable/i.test(values[0] ?? "");
    return {
      productKg: 3.629,
      optionAdditions: dryFilter ? [{ name: "Dry Extendable filter configuration", kg: 0.2 }] : [],
      packagingKg: 0.8, lengthCm: 65, widthCm: 40, heightCm: 25,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "400-horsepower-ford-bronco-package") {
    const dryFilter = /dry extendable/i.test(values[0] ?? "");
    return {
      productKg: 4.082,
      optionAdditions: dryFilter ? [{ name: "Dry Extendable filter configuration", kg: 0.2 }] : [],
      packagingKg: 0.8, lengthCm: 65, widthCm: 40, heightCm: 25,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "450-horsepower-kia-stinger-hyundai-genesis-package") {
    const serviceableCatchCan = /serviceable oil catch can/i.test(values[1] ?? "");
    return {
      productKg: 5.897,
      optionAdditions: serviceableCatchCan ? [{ name: "Serviceable oil catch can", kg: 0.4 }] : [],
      packagingKg: 0.8, lengthCm: 60, widthCm: 40, heightCm: 30,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "jb4-475-horsepower-package-for-gen-2-b58-bmw") {
    const frontMount = /silicone front mount/i.test(values[0] ?? "");
    return {
      productKg: 6.35,
      optionAdditions: frontMount ? [{ name: values[0], kg: 0.8 }] : [],
      packagingKg: 0.8, lengthCm: 50, widthCm: 35, heightCm: 25,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "450-horsepower-infiniti-q50-q60-package") {
    return {
      productKg: 13.608, optionAdditions: [], packagingKg: 0.8,
      lengthCm: 60, widthCm: 45, heightCm: 30, domesticShippingUsd: 0,
    };
  }
  if (handle === "400hp-package-for-b48-bmw-230i-330i-430i") {
    return {
      productKg: 5.443, optionAdditions: [], packagingKg: 0.8,
      lengthCm: 50, widthCm: 35, heightCm: 25, domesticShippingUsd: 0,
    };
  }
  if (handle === "340-horsepower-2024-2026-toyota-tacoma-package") {
    return {
      productKg: 5.443, optionAdditions: [], packagingKg: 0.8,
      lengthCm: 60, widthCm: 40, heightCm: 30, domesticShippingUsd: 0,
    };
  }
  if (handle === "600hp-s55-package") {
    return {
      productKg: 15.876, optionAdditions: [], packagingKg: 0.8,
      lengthCm: 60, widthCm: 45, heightCm: 30, domesticShippingUsd: 0,
    };
  }
  if (handle === "700hp-package-for-s58-bmw-g8x-m2-m3-m4") {
    const frontMount = /front mount/i.test(values[0] ?? "");
    return {
      productKg: 9.979,
      optionAdditions: frontMount ? [{ name: values[0], kg: 0.8 }] : [],
      packagingKg: 0.8, lengthCm: 50, widthCm: 35, heightCm: 25,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "700hp-package-for-s58-bmw-g9x-x3m-x4m") {
    const frontMount = /front mount/i.test(values[0] ?? "");
    return {
      productKg: frontMount ? 9.979 : 7.257,
      optionAdditions: [], packagingKg: 0.8,
      lengthCm: frontMount ? 55 : 50, widthCm: 40, heightCm: frontMount ? 30 : 25,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "500hp-n54-package") {
    const raceIntercooler = /race package/i.test(values[0] ?? "");
    const stage2Pump = /stage 2 fuel pump/i.test(values[0] ?? "");
    return {
      productKg: 20.412,
      optionAdditions: [
        ...(raceIntercooler ? [{ name: "Race intercooler upgrade", kg: 1.8 }] : []),
        ...(stage2Pump ? [{ name: "Stage 2 fuel pump upgrade", kg: 0.8 }] : []),
      ],
      packagingKg: 1.2, lengthCm: 65, widthCm: 45, heightCm: 30,
      domesticShippingUsd: 0,
    };
  }
  if (handle === "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5") {
    return {
      productKg: 5, optionAdditions: [], packagingKg: 0.5,
      lengthCm: 45.72, widthCm: 25.4, heightCm: 25.4, domesticShippingUsd: 24,
    };
  }
  if (handle === "air-filters-for-kia-stinger-genesis-g70") {
    const v6 = /^3\.3L/.test(values[0] ?? "");
    return {
      productKg: 0.907,
      optionAdditions: v6 ? [{ name: "3.3L V6 filter configuration", kg: 0.5 }] : [],
      packagingKg: v6 ? 0.45 : 0.3,
      lengthCm: v6 ? 36 : 30, widthCm: v6 ? 30 : 25, heightCm: v6 ? 12 : 10,
      domesticShippingUsd: 10,
    };
  }
  if (handle === "48-extension-for-fuel-it-flex-fuel-analyzer") {
    const wire = values[1] ?? "";
    const productKg = /#6\s*=/.test(wire) ? 0.6 : /#5\s*=/.test(wire) ? 0.35 :
      /#4\s*=/.test(wire) ? 0.5 : /#3\s*=/.test(wire) ? 0.45 :
      /#2\s*=/.test(wire) ? 0.3 : /#1\s*=/.test(wire) ? 0.25 : 0.2;
    const eca = /add the fuel-it! bluetooth/i.test(values[0] ?? "");
    return {
      productKg,
      optionAdditions: eca ? [{ name: "Fuel-It! Bluetooth ECA", kg: 0.454 }] : [],
      packagingKg: 0.2, lengthCm: 30.48, widthCm: 20.32, heightCm: 7.62,
      domesticShippingUsd: /#6\s*=/.test(wire) ? 7 : 10,
    };
  }
  if (handle === "fuel-it-charge-pipe-injection-cpi-starter-kit" ||
      handle === "quick-install-kia-stinger-genesis-g70-g80-3-3l-charge-pipe-injection-cpi-mount-kit") {
    const hasController = /include fsb/i.test(values[2] ?? "");
    const has950 = /upgrade me to the 950cc/i.test(values[1] ?? "");
    return {
      productKg: 0.907,
      optionAdditions: [
        ...(hasController ? [{ name: "FSB controller", kg: 0.181 }] : []),
        ...(has950 ? [{ name: "950cc injector upgrade", kg: 0.05 }] : []),
      ],
      packagingKg: 0.3, lengthCm: 27.94, widthCm: 22.86, heightCm: 15.24,
      domesticShippingUsd: 10,
    };
  }
  if (handle === "b58-bms-oil-catch-can-oil-filler-cap-connection-kit") {
    return {
      productKg: 0.907, optionAdditions: [], packagingKg: 0.3,
      lengthCm: 27.94, widthCm: 22.86, heightCm: 15.24, domesticShippingUsd: 10,
    };
  }
  return null;
}

const candidate = source.map((product) => {
  const handleConfig = configByHandle.get(product.handle);
  if (!handleConfig || handleConfig.variants.length !== product.variants.length) {
    throw new Error(`Variant audit and supplier source disagree for ${product.handle}`);
  }
  const base = localBySlug.get(`burger-${product.handle}`) as Record<string, any> | undefined;
  const draft = copyDrafts[product.handle] as Record<string, any> | undefined;
  const internalOptionOnly = draft?.internalOptionOnly === true;
  const manualQuoteRequired = draft?.manualQuoteRequired === true;
  const digitalProduct = draft?.digitalProduct === true;
  const type = product.product_type || "PARTS";
  const profile = profiles[type] ?? profiles.DEFAULT;
  const sameSourceMass = new Set(product.variants.map((variant) => Number(variant.grams ?? 0))).size === 1;
  const maximumMassByColorOption = new Map<string, number>();
  for (const variant of product.variants) {
    const key = normalizedColorOptionKey(optionValues(variant));
    if (!key) continue;
    maximumMassByColorOption.set(key, Math.max(
      maximumMassByColorOption.get(key) ?? 0,
      Number(variant.grams ?? 0),
    ));
  }
  const allVariantsAreCompleteKits = product.variants.every((variant) =>
    optionValues(variant).some((value) => /\bcomplete kit\b/i.test(value))
  );
  const sourceFreeShipping = hasFreeUsShipping(
    product.handle,
    product.body_html ?? "",
    allVariantsAreCompleteKits,
    product.product_type ?? "",
  );
  const sourceImages = product.images ?? [];
  const variants = product.variants.map((variant, index) => {
    const audited = handleConfig.variants[index];
    if (audited.sourceVariantId !== variant.id) {
      throw new Error(`Variant order mismatch for ${product.handle} at index ${index}`);
    }
    const sourceOptions = optionValues(variant);
    const manualPackage = reviewedPackageOverride(product.handle, sourceOptions);
    const optionAdditions = manualPackage?.optionAdditions ??
      optionWeightAdditions(sourceOptions, sameSourceMass && product.variants.length > 1);
    const rawSourceGrams = Number(variant.grams ?? 0);
    const colorOptionKey = normalizedColorOptionKey(sourceOptions);
    const effectiveSourceGrams = colorOptionKey
      ? Math.max(rawSourceGrams, maximumMassByColorOption.get(colorOptionKey) ?? 0)
      : rawSourceGrams;
    const sourceKg = effectiveSourceGrams / 1000;
    const productKg = manualPackage?.productKg ?? Math.max(sourceKg >= 0.1 ? sourceKg : 0, profile.minProductKg);
    const packageProfile = {
      productKg,
      optionAdditions,
      packagingKg: manualPackage?.packagingKg ?? profile.packagingKg,
      lengthCm: manualPackage?.lengthCm ?? profile.lengthCm,
      widthCm: manualPackage?.widthCm ?? profile.widthCm,
      heightCm: manualPackage?.heightCm ?? profile.heightCm,
    };
    const domesticShippingUsd = digitalProduct ? 0 : sourceFreeShipping ? 0 :
      manualPackage?.domesticShippingUsd ?? profile.domesticShippingUsd;
    const embeddedOptionPriceUsd = embeddedOptionRegularPriceUsd(sourceOptions);
    const regularSupplierCandidateUsd = Math.max(
      Number(audited.regularSupplierUsd ?? 0),
      Number(embeddedOptionPriceUsd ?? 0),
    );
    const estimate = !internalOptionOnly && !manualQuoteRequired &&
      Number.isFinite(regularSupplierCandidateUsd) && regularSupplierCandidateUsd > 0
      ? calculateBurgerVariantPrice({
          productType: type,
          supplierUsd: regularSupplierCandidateUsd,
          compareAtUsd: audited.compareAtUsd,
          domesticShippingUsd,
          packageEstimate: packageProfile,
          requiresShipping: !digitalProduct,
        })
      : null;
    const sourceImage = sourceImages.find((image) => image.id === variant.image_id)?.src ??
      sourceImages[0]?.src ?? null;
    const hasKnownSourceWeight = Number(variant.grams ?? 0) >= 100;
    const sku = String(variant.sku ?? "").trim();
    return {
      sourceVariantId: variant.id,
      title: cleanOptionValue(variant.title || "Default Title"),
      sku: cleanSku(sku, variant.id),
      supplierSku: sku && cleanSku(sku, variant.id) === sku ? sku : null,
      internalKey: `BURGER-V-${variant.id}`,
      position: index,
      optionValues: displayOptionValues(optionValues(variant)),
      salePriceUsd: Number(variant.price),
      compareAtPriceUsd: variant.compare_at_price == null ? null : Number(variant.compare_at_price),
      regularSupplierUsd: estimate?.regularSupplierUsd ?? null,
      regularSupplierPriceFromOptionTextUsd: embeddedOptionPriceUsd,
      requiresShipping: !digitalProduct && !internalOptionOnly,
      domesticShippingUsd,
      sourceGrams: Number(variant.grams ?? 0),
      effectiveSourceWeightKg: sourceKg,
      packageWeightKg: digitalProduct ? null : estimate?.packedPhysicalKg ?? null,
      billableWeightKg: estimate?.billableKg ?? null,
      packageDimensionsCm: {
        length: packageProfile.lengthCm, width: packageProfile.widthCm, height: packageProfile.heightCm,
      },
      lengthCm: packageProfile.lengthCm,
      widthCm: packageProfile.widthCm,
      heightCm: packageProfile.heightCm,
      optionAddedKg: estimate?.optionAddedKg ?? null,
      dimensionalWeightKg: estimate?.dimensionalKg ?? null,
      priceBeforeRoundingUsd: estimate?.unroundedPriceUsd ?? null,
      priceUsd: estimate?.priceUsd ?? null,
      available: variant.available !== false,
      isDefault: index === 0,
      image: sourceImage,
      estimateReviewFlags: [
        ...(!digitalProduct && !internalOptionOnly && !manualQuoteRequired && !hasKnownSourceWeight
          ? ["SOURCE_WEIGHT_MISSING_OR_IMPLAUSIBLY_LOW"] : []),
        ...(manualQuoteRequired ? ["MANUAL_QUOTE_REQUIRED"] : []),
        ...(internalOptionOnly ? ["INTERNAL_OPTION_ONLY"] : []),
        ...(digitalProduct ? ["DIGITAL_PRODUCT_NO_PHYSICAL_SHIPPING"] : []),
        ...(digitalProduct || internalOptionOnly || manualQuoteRequired ? [] :
          manualPackage ? ["REVIEWED_MANUAL_WEIGHT_PACKAGE_OVERRIDE"] : ["PACKAGE_PROFILE_ESTIMATED"]),
        ...(sourceFreeShipping ? ["SOURCE_FREE_US_SHIPPING"] : []),
        ...(embeddedOptionPriceUsd != null && embeddedOptionPriceUsd > Number(audited.regularSupplierUsd ?? 0)
          ? ["SOURCE_OPTION_PRICE_USED"] : []),
        ...(effectiveSourceGrams !== rawSourceGrams ? ["SOURCE_COLOR_VARIANT_WEIGHT_CEILING_APPLIED"] : []),
        ...(manualPackage?.domesticShippingUsd === 0 && !sourceFreeShipping ? ["REVIEWED_ZERO_US_SHIPPING_OVERRIDE"] : []),
        ...(optionAdditions.length ? ["OPTION_WEIGHT_INFERRED"] : []),
        ...(!estimate && !internalOptionOnly ? ["NO_SUPPLIER_PRICE"] : []),
        ...(!sku || cleanSku(sku, variant.id) !== sku ? ["SUPPLIER_SKU_MISSING_OR_INVALID"] : []),
        ...(variant.available === false ? ["UNAVAILABLE_AT_SOURCE"] : []),
      ],
    };
  });
  const defaultVariant = variants[0];
  const existingTags = Array.isArray(base?.tags) ? base.tags : [];
  const newTitle = {
    ua: draft?.titleUa ?? base?.title?.ua ?? product.title,
    en: draft?.titleEn ?? base?.title?.en ?? product.title,
  };
  const descriptionEn = draft?.descEn ?? base?.longDescription?.en ?? product.body_html ?? "";
  const descriptionUa = draft?.descUa ?? base?.longDescription?.ua ?? "";
  const tags = [...new Set([...brandTags(product, existingTags),
    ...(internalOptionOnly ? ["catalog:hidden"] : []),
    ...(manualQuoteRequired ? ["pricing:manual-quote"] : []),
    ...(digitalProduct ? ["delivery:digital"] : []),
  ])];
  const optionLabelCorrections = [
    ...(product.handle === "jb4-for-a90-toyota-supra" ? [{
      sourceLabel: "Add optional fuel pressure sensor?",
      displayLabel: "System",
      reason: "Current source variants are JB4 and JB4PRO board types.",
    }] : []),
    ...(product.handle === "s58-bmw-water-methanol-port-injection-kit" ? [{
      sourceLabel: "Add Port Injection Controller?",
      displayLabel: "Add CANfuel controller?",
      reason: "The base contents list a BMS JB4 PI controller; this selector adds optional CANfuel.",
    }] : []),
    ...(product.handle === "obdii-can-module-for-f-series" ? [{
      sourceLabel: "Chssis",
      displayLabel: "Chassis",
      reason: "Corrects the supplier option-label typo without changing the F/G Chassis values.",
    }] : []),
    ...([
      ["bms-differential-support-bracket-brace-for-e82-135i-and-e9x-335i", "SIff Size", "Differential size"],
      ["bms-wheel-pin-tool", "Select Chassis", "Thread and vehicle"],
      ["bov-adapter-for-kia-stinger-gt-3-3", "Please Choose", "Package configuration"],
      ["dragy", "Please Choose", "Device model and condition"],
      ["n54-jb-quick-install", "Include FREE N54 drop-in performance filter? ", "Include N54 drop-in filter?"],
      ["bmw-b48-charge-pipe-blow-off-valve-bov-kit", "Choose Engine", "B48 generation"],
      ["bms-bmw-b46-b48-gen1-charge-pipe", "Choose Engine", "B48 generation"],
      ["bms-n55-f30-replacement-aluminum-chargepipe", ".", "Transmission and drivetrain"],
      ["bms-m3-m4-s55-replacement-chargepipes", ".", "Configuration"],
      ["vw-audi-tow-hook-camera-mount-for-gopro-cameras", ".", "Tow-hook thread"],
      ["n54-single-turbo-conversion-oil-coolant-fittings", ".", "Fitting type"],
      ["jack-pad-adapter-for-2020-toyota-supra", "Please Choose", "Pack and finish"],
      ["bmw-floor-jack-pad-adapter", "Please choose", "Pack and finish"],
    ] as Array<[string, string, string]>).filter(([handle]) => handle === product.handle).map(([, sourceLabel, displayLabel]) => ({
      sourceLabel,
      displayLabel,
      reason: "Clarifies the supplier selector label while preserving every source variant value.",
    })),
  ];
  const optionValueCorrections = (product.options ?? []).flatMap((option) =>
    option.values.flatMap((sourceValue) => {
      const displayValue = cleanOptionValue(sourceValue);
      return displayValue !== sourceValue ? [{
        optionName: option.name,
        sourceValue,
        displayValue,
        reason: "Removes supplier sale/price text because storefront prices are recalculated separately.",
      }] : [];
    })
  );
  return {
    sourceProductId: product.id,
    sourceUrl: `https://burgertuning.com/products/${product.handle}`,
    slug: product.handle,
    title: newTitle,
    brand: "Burger Motorsports",
    vendor: product.vendor || "Burger Motorsports Inc",
    productType: type,
    scope: "auto",
    tags,
    descriptionEn,
    descriptionUa,
    seo: draft ? { titleUa: draft.titleUa, titleEn: draft.titleEn, descriptionUa: draft.shortUa, descriptionEn: draft.shortEn } : null,
    options: (product.options ?? []).map((option) => ({
      name: optionLabelCorrections.find((entry) => entry.sourceLabel.trim() === option.name.trim())?.displayLabel ?? option.name,
      position: option.position,
      values: option.values.map(cleanOptionValue),
    })),
    optionLabelCorrections,
    optionValueCorrections,
    variants,
    defaultVariantId: defaultVariant.sourceVariantId,
    priceUsd: defaultVariant.priceUsd,
    supplierPriceUsd: defaultVariant.regularSupplierUsd,
    image: defaultVariant.image,
    gallery: sourceImages.map((image) => image.src),
    available: variants.some((variant) => variant.available),
    requiresShipping: !digitalProduct && !internalOptionOnly,
    manualQuoteRequired,
    internalOptionOnly,
    status: internalOptionOnly ? "internal-option-only" : manualQuoteRequired ? "manual-quote-required" :
      digitalProduct ? "digital-download" : draft ? "copy-reviewed-draft" : "copy-required",
  };
});

const summary = {
  sourceProducts: candidate.length,
  sourceVariants: candidate.reduce((total, product) => total + product.variants.length, 0),
  tunerProductsIncluded: candidate.filter((product) =>
    ["JB4 Tuners", "JB+ Tuners", "Stage 1 Tuners"].includes(product.productType)
  ).length,
  productsWithCuratedCopy: candidate.filter((product) => product.seo).length,
  productsStillNeedingCopy: candidate.filter((product) => !product.seo).length,
  variantsMissingOrInvalidSku: candidate.reduce((total, product) =>
    total + product.variants.filter((variant) =>
      variant.estimateReviewFlags.includes("SUPPLIER_SKU_MISSING_OR_INVALID")
    ).length, 0),
  variantsMissingSupplierPrice: candidate.reduce((total, product) =>
    total + product.variants.filter((variant) =>
      variant.estimateReviewFlags.includes("NO_SUPPLIER_PRICE")
    ).length, 0),
  productsRequiringManualQuote: candidate.filter((product) => product.manualQuoteRequired).length,
  productsInternalOptionOnly: candidate.filter((product) => product.internalOptionOnly).length,
  digitalProductsWithoutPhysicalShipping: candidate.filter((product) => product.requiresShipping === false &&
    !product.internalOptionOnly).length,
  publicCatalogProducts: candidate.filter((product) => !product.internalOptionOnly).length,
  variantsNeedingPackageReview: candidate.reduce((total, product) =>
    total + product.variants.filter((variant) =>
      variant.estimateReviewFlags.includes("PACKAGE_PROFILE_ESTIMATED")
    ).length, 0),
  productsWithSourceFreeUsShipping: candidate.filter((product) =>
    product.variants.some((variant) => variant.estimateReviewFlags.includes("SOURCE_FREE_US_SHIPPING"))
  ).length,
  variantsWithZeroUsShipping: candidate.reduce((total, product) =>
    total + product.variants.filter((variant) => variant.domesticShippingUsd === 0).length, 0),
  priceFormula: "Physical goods: ((regular Burger price + source free US shipping or estimated shipping to Brooklyn) * 1.15 + $10 * billable kg), rounded up to $5. Digital downloads: regular price * 1.15, rounded up to $5.",
  billableWeightRule: "Physical goods: ceil(max((item + selected options) * 1.10 + box, length * width * height / 5000)) + 1 kg.",
  priceHandlingNotes: [
    "Manual-invoice items and internal option/service records are not auto-priced as standalone catalog products.",
    "Manufacturer SKU missing/invalid variants receive an internal variant key; storefront displays 'Артикул виробника не вказано'.",
    "Supplier SKU duplicates are retained as supplied; products are keyed by product slug and variants by source variant ID.",
  ],
  productionImportBlockingReasons: [
    ...(candidate.filter((product) => product.manualQuoteRequired).length
      ? [`${candidate.filter((product) => product.manualQuoteRequired).length} products require an individual supplier quote`] : []),
    ...(candidate.filter((product) => product.internalOptionOnly).length
      ? [`${candidate.filter((product) => product.internalOptionOnly).length} internal option/service records are excluded from the public catalog`] : []),
    ...(candidate.reduce((count, product) => count + product.variants.filter((variant) =>
      variant.estimateReviewFlags.includes("NO_SUPPLIER_PRICE")).length, 0)
      ? [`${candidate.reduce((count, product) => count + product.variants.filter((variant) =>
        variant.estimateReviewFlags.includes("NO_SUPPLIER_PRICE")).length, 0)} supplier variants have no published regular price`] : []),
  ],
  productionImportReady: false,
};
const outputPath = path.join(tmpDir, `burger-import-candidate-${date}.json`);
fs.writeFileSync(outputPath, JSON.stringify({ summary, products: candidate }, null, 2) + "\n");
const reviewRows = candidate.flatMap((product) => product.variants.map((variant) => ({
  handle: product.slug,
  title: product.title.en,
  productType: product.productType,
  sourceUrl: product.sourceUrl,
  variantTitle: variant.title,
  optionValues: variant.optionValues.join(" / "),
  supplierSku: variant.supplierSku ?? "",
  internalVariantKey: variant.internalKey,
  regularSupplierUsd: variant.regularSupplierUsd ?? "",
  regularSupplierPriceFromOptionTextUsd: variant.regularSupplierPriceFromOptionTextUsd ?? "",
  estimatedUsShippingUsd: variant.domesticShippingUsd,
  sourceWeightGrams: variant.sourceGrams,
  packedPhysicalKg: variant.packageWeightKg ?? "",
  packageDimensionsCm: variant.packageDimensionsCm
    ? `${variant.packageDimensionsCm.length}x${variant.packageDimensionsCm.width}x${variant.packageDimensionsCm.height}`
    : "",
  inferredOptionKg: variant.optionAddedKg ?? "",
  billableKg: variant.billableWeightKg ?? "",
  calculatedPriceUsd: variant.priceUsd ?? "",
  estimateReviewFlags: variant.estimateReviewFlags.join("|"),
  copyStatus: product.status,
})));
const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const headers = Object.keys(reviewRows[0] ?? {});
const reviewCsvPath = path.join(tmpDir, `burger-variant-import-review-${date}.csv`);
const reviewCsv = [headers.join(","), ...reviewRows.map((row) =>
  headers.map((key) => quote(row[key as keyof typeof row])).join(",")
)].join("\n");
fs.writeFileSync(reviewCsvPath, `\uFEFF${reviewCsv}\n`, "utf8");
console.log(JSON.stringify({ ...summary, outputPath, reviewCsvPath }, null, 2));
