import type { AdminShopProductPayload } from "@/lib/shopAdminCatalog";
import {
  SUPPLIER_FITMENT_KEY,
  SUPPLIER_FITMENT_NAMESPACE,
  upgradeSupplierFitmentContractToV2,
  type SupplierFitmentImportContract,
  type SupplierFitmentV1Contract,
} from "@/lib/shopImportFitment";
import {
  buildSupplierDescriptionHtml,
  supplierCopyVehicleApplications,
  supplierCopyVehicleTags,
  trimSupplierSlug,
  type SupplierCopy,
} from "@/lib/supplierCatalogCopy";

export const CT_CARBON_BRAND = "CT Carbon";
export const CT_CARBON_STORE = "https://www.ctcarbon.co";
export const CT_CARBON_SOURCE_FEED = `${CT_CARBON_STORE}/products.json`;
/** CT Carbon's site shows prices with 20% UK VAT; products.json carries them without it. */
export const CT_CARBON_UK_VAT = 1.2;
/** @OneCompany1_bot, retail mode (20.10.2026): site price with VAT × 1.15. */
export const CT_CARBON_MARKUP = 1.15;
/** GBP → USD the bot used on 20.10.2026. */
export const CT_CARBON_GBP_USD = 1.345;

export type CtCarbonSourceVariant = {
  id: number;
  sku: string | null;
  title: string;
  options: string[];
  /** Regular price without VAT (the higher of price and compare_at_price). */
  priceExVatGbp: number;
  salePriceExVatGbp: number | null;
  grams: number;
  image: string | null;
};

export type CtCarbonSourceProduct = {
  id: number;
  handle: string;
  url: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  optionNames: string[];
  fitmentNote: string | null;
  bodyParagraphs: string[];
  images: string[];
  variants: CtCarbonSourceVariant[];
  updatedAt: string | null;
};

/**
 * Delivery the bot adds per part (retail, 20.10.2026): UK → Medyka in GBP before the
 * exchange, then Medyka → Ukraine by volume in USD. Observed in the bot for spoilers,
 * splitters, diffusers, side skirts, grilles, mirrors and a bootlid; the other part
 * types use the closest observed size class.
 */
export const CT_CARBON_DELIVERY = {
  small: { medykaGbp: 20, ukraineUsd: 20 },
  medium: { medykaGbp: 37.5, ukraineUsd: 55 },
  spoiler: { medykaGbp: 60, ukraineUsd: 100 },
  splitter: { medykaGbp: 65, ukraineUsd: 110 },
  diffuser: { medykaGbp: 75, ukraineUsd: 130 },
  sideSkirts: { medykaGbp: 85, ukraineUsd: 150 },
  panel: { medykaGbp: 175, ukraineUsd: 330 },
} as const;

export type CtCarbonDeliveryClass = keyof typeof CT_CARBON_DELIVERY;

export type CtCarbonDelivery = {
  parts: CtCarbonDeliveryClass[];
  medykaGbp: number;
  ukraineUsd: number;
  /** Where the kit contents came from: the product itself, the kit list, tags or the title. */
  basis: "part" | "kit-list" | "kit-tags" | "kit-title";
};

const PART_TYPE_CLASS: Record<string, CtCarbonDeliveryClass> = {
  spoiler: "spoiler",
  "roof scoop": "panel",
  splitter: "splitter",
  diffuser: "diffuser",
  "side skirts": "sideSkirts",
  grille: "medium",
  mirrors: "small",
  bonnet: "panel",
  bootlid: "panel",
  arches: "panel",
  fenders: "panel",
  bumper: "panel",
  "custom steering wheels": "medium",
  "exhaust tips": "medium",
  "bumper corners": "medium",
  "door panels": "medium",
  "bumper trim": "small",
  drl: "small",
};

const KIT_TYPES = new Set(["kit", "black pack", "front end pack"]);

/**
 * Keyword → part, checked in order on one line of a kit list or a title. Trims, vents
 * and inserts come before the panels they sit on ("Wing/Fender Trims" is a small part).
 */
const PART_PATTERNS: Array<[RegExp, CtCarbonDeliveryClass]> = [
  [/\b(?:engine (?:cover|bay|dress[- ]up)|slam panel)\b/i, "medium"],
  [/\b(?:grilles?|kidneys?)\b/i, "medium"],
  [/\b(?:bonnet|hood) scoops?\b/i, "small"],
  [
    /\b(?:trims?|inserts?|vents?|ducts?|canards?|flics|winglets?|risers?|badges?|emblems?|reflectors?|delete)\b/i,
    "small",
  ],
  // Long and heavy: packed like a pair of side skirts.
  [/\b(?:side steps?|running boards?|roof rails?)\b/i, "sideSkirts"],
  [/\b(?:wide ?arch|arches|fenders?|wide ?body)\b/i, "panel"],
  [/\b(?:bonnet|hood|boot ?lid|trunk ?lid|roof scoop)\b/i, "panel"],
  [/\bside ?skirts?\b/i, "sideSkirts"],
  [/\bdiffuser\b/i, "diffuser"],
  [/\b(?:splitter|front lip|lip splitter|front spoiler)\b/i, "splitter"],
  [/\b(?:spoiler|wing|ducktail|lip spoiler|boot lip)\b/i, "spoiler"],
  // About a metre long but light: packed like a spoiler.
  [/\b(?:cross ?bars?|strut brace|roof light|light bar|snorkel)\b/i, "spoiler"],
  [/\bsteering wheel\b/i, "medium"],
  [
    /\b(?:bumper (?:lower )?corners?|rear corners?|door panels?|seats? backs?|storage box(?:es)?|intakes?|exhaust tips?)\b/i,
    "medium",
  ],
  [/\b(?:mirrors?|covers?)\b/i, "small"],
];

function partClassOfLine(line: string): CtCarbonDeliveryClass | null {
  for (const [pattern, part] of PART_PATTERNS) {
    if (pattern.test(line)) return part;
  }
  return null;
}

/** A kit-list line that is a whole bumper ("Front Bumper", "Rear Bumpers"), not a trim on one. */
const BUMPER_LINE = /^(?:(?:front|rear)\s+)?bumpers?(?:\s+replacements?)?(?:\s+v\d+)?$/i;

function partClassOfListLine(line: string): CtCarbonDeliveryClass | null {
  return partClassOfLine(line) ?? (BUMPER_LINE.test(line.trim()) ? "panel" : null);
}

function isKit(product: Pick<CtCarbonSourceProduct, "productType" | "title">) {
  return (
    KIT_TYPES.has(product.productType.trim().toLowerCase()) ||
    /\b(?:full kit|carbon fibre kit|gloss black kit|black kit|full .*kit|rear end kit|front end (?:kit|pack)|package)\b/i.test(
      product.title
    )
  );
}

const KIT_LIST_HEADER =
  /\b(?:included in (?:the|this) (?:kit|package|pack)|comprised of|consists of|kit includes|package includes|includes the following|the kit includes|this kit includes|kit features|what'?s included|in the box)\b/i;
const KIT_LIST_END = /\b(?:designed in[- ]house|please note|note:|fitment|fits\b|made from)\b/i;
/** "This kit does not include the Middle Spoiler": the part it names is not in the kit. */
const KIT_LIST_EXCLUSION =
  /\b(?:does not include|doesn'?t include|not included|not part of|excluded|sold separately)\b/i;
/** A title that names a set of parts rather than one part. */
const KIT_TITLE = /\b(?:kits?|packs?|package|set)\b/i;

/** Short list-like lines that name a part, for kits that list their parts without a heading. */
function partsFromShortLines(paragraphs: string[]): CtCarbonDeliveryClass[] {
  const parts: CtCarbonDeliveryClass[] = [];
  for (const line of paragraphs) {
    if (line.length > 70 || KIT_LIST_END.test(line) || KIT_LIST_EXCLUSION.test(line)) continue;
    const part = partClassOfListLine(line);
    if (part) parts.push(part);
  }
  return parts;
}

/**
 * The parts listed under "Included in the kit" (or a similar heading), never more than
 * the item count the heading states ("INCLUDED IN THE KIT (4 ITEMS)").
 */
export function parseCtCarbonKitList(paragraphs: string[]): CtCarbonDeliveryClass[] {
  const start = paragraphs.findIndex((line) => KIT_LIST_HEADER.test(line));
  if (start < 0) return partsFromShortLines(paragraphs);
  const parts: CtCarbonDeliveryClass[] = [];
  // The header line can carry the list itself ("comprised of the following: - Splitter - Side Skirts").
  const headerTail = paragraphs[start].split(KIT_LIST_HEADER).pop() ?? "";
  const lines = [
    ...headerTail.split(/\s[-•–]\s|;\s*/).filter((line) => line.trim().length > 3),
    ...paragraphs.slice(start + 1),
  ];
  for (const line of lines) {
    if (KIT_LIST_EXCLUSION.test(line)) break;
    if (KIT_LIST_END.test(line) && !partClassOfListLine(line)) break;
    const part = partClassOfListLine(line);
    if (part) parts.push(part);
  }
  const stated = Number(paragraphs[start].match(/\((\d+)\s*(?:items?|pieces?|parts?)\)/i)?.[1]);
  return stated >= 2 && parts.length > stated ? parts.slice(0, stated) : parts;
}

function partsFromTags(tags: string[]): CtCarbonDeliveryClass[] {
  const upper = new Set(tags.map((tag) => tag.toUpperCase()));
  const parts: CtCarbonDeliveryClass[] = [];
  if (upper.has("SPLITTER")) parts.push("splitter");
  if (upper.has("SIDE SKIRTS")) parts.push("sideSkirts");
  if (upper.has("DIFFUSER")) parts.push("diffuser");
  if (upper.has("SPOILER")) parts.push("spoiler");
  return parts;
}

function partsFromKitTitle(title: string): CtCarbonDeliveryClass[] {
  if (/\bbumper replacements\b|\bfront and rear bumpers\b/i.test(title)) return ["panel", "panel"];
  // A trim pack is a box of small trims; moulding trims are long door claddings.
  if (/\bmoulding trim (?:pack|set)\b/i.test(title)) return ["sideSkirts"];
  if (/\btrim (?:pack|set)\b/i.test(title)) return ["medium"];
  if (/\brear end\b/i.test(title)) return ["diffuser", "spoiler"];
  if (/\bfront end\b/i.test(title)) return ["splitter", "medium"];
  if (/\bwide ?arch\b/i.test(title)) return ["panel", "splitter", "sideSkirts", "diffuser"];
  return ["splitter", "sideSkirts", "diffuser", "spoiler"];
}

/** Bot delivery for one product: its part class, or the sum of the parts in a kit. */
export function ctCarbonDelivery(
  product: Pick<CtCarbonSourceProduct, "productType" | "title" | "tags" | "bodyParagraphs">
): CtCarbonDelivery {
  const total = (parts: CtCarbonDeliveryClass[], basis: CtCarbonDelivery["basis"]) => ({
    parts,
    medykaGbp: parts.reduce((sum, part) => sum + CT_CARBON_DELIVERY[part].medykaGbp, 0),
    ukraineUsd: parts.reduce((sum, part) => sum + CT_CARBON_DELIVERY[part].ukraineUsd, 0),
    basis,
  });
  if (isKit(product)) {
    const listed = parseCtCarbonKitList(product.bodyParagraphs);
    if (listed.length >= 2) return total(listed, "kit-list");
    // A "Front End Pack" titled "… FRONT BUMPER TRIM" is one part, not a kit.
    const titlePart = partClassOfLine(product.title);
    if (titlePart && !KIT_TITLE.test(product.title)) return total([titlePart], "part");
    const tagged = partsFromTags(product.tags);
    if (tagged.length >= 2) return total(tagged, "kit-tags");
    return total(partsFromKitTitle(product.title), "kit-title");
  }
  const byType = PART_TYPE_CLASS[product.productType.trim().toLowerCase()];
  const byTitle = partClassOfLine(product.title);
  // Vents or trims listed under a panel's product type ("FENDER VENTS") are small parts.
  if (byType === "panel" && byTitle === "small") return total(["small"], "part");
  // A title without a part name: the description often names it ("CT Carbon diffuser made …").
  const byDescription = partClassOfLine(product.bodyParagraphs[0] ?? "");
  return total([byType ?? byTitle ?? byDescription ?? "small"], "part");
}

/**
 * Estimated packed size per part class (kg, cm). CT's Shopify weights are placeholders
 * (19 or 42 kg on most kits), so the shop's weight and size fields use these instead and
 * the product is marked as having estimated dimensions.
 */
export const CT_CARBON_PACKAGE: Record<
  CtCarbonDeliveryClass,
  { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }
> = {
  small: { weightKg: 1.5, lengthCm: 45, widthCm: 35, heightCm: 15 },
  medium: { weightKg: 5, lengthCm: 80, widthCm: 45, heightCm: 25 },
  spoiler: { weightKg: 4, lengthCm: 150, widthCm: 45, heightCm: 20 },
  splitter: { weightKg: 7, lengthCm: 190, widthCm: 60, heightCm: 20 },
  diffuser: { weightKg: 7, lengthCm: 160, widthCm: 60, heightCm: 30 },
  sideSkirts: { weightKg: 8, lengthCm: 220, widthCm: 35, heightCm: 20 },
  panel: { weightKg: 15, lengthCm: 170, widthCm: 130, heightCm: 30 },
};

/** Package for a product: one part's box, or for a kit the parts stacked (height capped at 90 cm). */
export function ctCarbonPackage(delivery: Pick<CtCarbonDelivery, "parts">) {
  const boxes = delivery.parts.map((part) => CT_CARBON_PACKAGE[part]);
  const largest = boxes.reduce((best, box) =>
    box.lengthCm * box.widthCm > best.lengthCm * best.widthCm ? box : best
  );
  return {
    weightKg: Math.round(boxes.reduce((sum, box) => sum + box.weightKg, 0) * 10) / 10,
    lengthCm: largest.lengthCm,
    widthCm: largest.widthCm,
    heightCm: Math.min(
      90,
      boxes.reduce((sum, box) => sum + box.heightCm, 0)
    ),
  };
}

/** CT Carbon's site price with UK VAT, to the penny (what the bot reads from the page). */
export function ctCarbonSitePriceGbp(priceExVatGbp: number) {
  if (!Number.isFinite(priceExVatGbp) || priceExVatGbp <= 0) {
    throw new Error("CT Carbon price must be a positive number");
  }
  return Math.round(priceExVatGbp * CT_CARBON_UK_VAT * 100) / 100;
}

/**
 * The bot's retail price: (site £ with VAT × 1.15 + delivery to Medyka £) × GBP/USD
 * + delivery Medyka → Ukraine $, rounded up to $5.
 */
export function calculateCtCarbonPriceUsd(
  sitePriceGbp: number,
  delivery: Pick<CtCarbonDelivery, "medykaGbp" | "ukraineUsd">,
  gbpUsd = CT_CARBON_GBP_USD
) {
  const cents = Math.round(
    ((sitePriceGbp * CT_CARBON_MARKUP + delivery.medykaGbp) * gbpUsd + delivery.ukraineUsd) * 100
  );
  return Math.ceil(cents / 500) * 5;
}

type LocalizedPair = { ua: string; en: string };

const PART_COPY: Record<string, { productType: string; ua: string }> = {
  spoiler: { productType: "Spoiler", ua: "Спойлер" },
  splitter: { productType: "Front Splitter", ua: "Спліттер" },
  diffuser: { productType: "Rear Diffuser", ua: "Дифузор" },
  "side skirts": { productType: "Side Skirts", ua: "Пороги" },
  kit: { productType: "Body Kit", ua: "Обвіс" },
  "black pack": { productType: "Body Kit", ua: "Обвіс" },
  "front end pack": { productType: "Front End Pack", ua: "Передній обвіс" },
  grille: { productType: "Grille", ua: "Решітка радіатора" },
  mirrors: { productType: "Mirror Covers", ua: "Накладки на дзеркала" },
  bonnet: { productType: "Bonnet", ua: "Капот" },
  bootlid: { productType: "Bootlid", ua: "Кришка багажника" },
  arches: { productType: "Fender Arches", ua: "Розширювачі арок" },
  fenders: { productType: "Fenders", ua: "Крила" },
  bumper: { productType: "Bumper", ua: "Бампер" },
  "roof scoop": { productType: "Roof Scoop", ua: "Повітрозабірник на дах" },
  "custom steering wheels": { productType: "Steering Wheel", ua: "Кермо" },
  "exhaust tips": { productType: "Exhaust Tips", ua: "Насадки вихлопу" },
  "bumper corners": { productType: "Bumper Corners", ua: "Накладки кутів бампера" },
  "bumper trim": { productType: "Bumper Trim", ua: "Накладки бампера" },
  "door panels": { productType: "Door Panels", ua: "Накладки дверей" },
  drl: { productType: "DRL", ua: "Ходові вогні (DRL)" },
  accessories: { productType: "Accessories", ua: "Аксесуари" },
};

export function isCtCarbonGlossBlack(product: Pick<CtCarbonSourceProduct, "vendor" | "title">) {
  return /blak/i.test(product.vendor) || /\bgloss black\b/i.test(product.title);
}

export function ctCarbonProductType(product: Pick<CtCarbonSourceProduct, "productType" | "title">) {
  const key = product.productType.trim().toLowerCase();
  if (PART_COPY[key]) return PART_COPY[key];
  if (/\bdrl\b/i.test(product.title)) return PART_COPY.drl;
  if (isKit(product)) return PART_COPY.kit;
  return PART_COPY.accessories;
}

export function ctCarbonCategory(
  product: Pick<CtCarbonSourceProduct, "productType" | "title" | "vendor">
): LocalizedPair {
  const key = product.productType.trim().toLowerCase();
  if (key === "custom steering wheels") return { ua: "Керма", en: "Steering wheels" };
  if (key === "drl" || /\bdrl\b/i.test(product.title)) {
    return { ua: "Ходові вогні (DRL)", en: "DRL lighting" };
  }
  if (key === "exhaust tips") return { ua: "Насадки вихлопу", en: "Exhaust tips" };
  return isCtCarbonGlossBlack(product)
    ? { ua: "Глянцево-чорний обвіс", en: "Gloss black styling" }
    : { ua: "Карбонова аеродинаміка", en: "Carbon aero" };
}

export function ctCarbonCollection(product: Pick<CtCarbonSourceProduct, "vendor" | "title">) {
  return isCtCarbonGlossBlack(product)
    ? { ua: "BLAK by CT", en: "BLAK by CT" }
    : { ua: CT_CARBON_BRAND, en: CT_CARBON_BRAND };
}

/** Our SKU: CT's own SKUs are often blank, repeated or a list of kit parts. */
export function ctCarbonSku(product: Pick<CtCarbonSourceProduct, "id">) {
  return `CTC-${product.id}`;
}

export function ctCarbonVariantSku(
  product: Pick<CtCarbonSourceProduct, "id" | "variants">,
  variant: Pick<CtCarbonSourceVariant, "id">
) {
  return product.variants.length > 1 ? `CTC-${product.id}-${variant.id}` : ctCarbonSku(product);
}

/** Readable, stable slug from CT's title (without the "CT DESIGN" suffix) plus our SKU tail. */
export function buildCtCarbonSlug(product: Pick<CtCarbonSourceProduct, "id" | "title">) {
  const name = product.title.replace(/\b(?:ct design|ct carbon)\b/gi, " ").replace(/\+/g, " plus ");
  return `ct-carbon-${trimSupplierSlug(name, 80)}-${String(product.id).slice(-5)}`;
}

const OPTION_NAMES: Array<[RegExp, string]> = [
  [/finish|matte/i, "Finish"],
  [/aero pack/i, "Factory Aero Pack"],
  [/engine/i, "Engine Type"],
  [/size/i, "Size"],
  [/fitting/i, "Fitting"],
];

export function normalizeCtCarbonOptionName(name: string) {
  for (const [pattern, normalized] of OPTION_NAMES) {
    if (pattern.test(name)) return normalized;
  }
  return name.trim();
}

/** Supplier fitment: the cars named by CT Carbon; needs review when none could be read. */
export function buildCtCarbonSupplierFitment(
  product: Pick<CtCarbonSourceProduct, "url" | "updatedAt">,
  copy: Pick<SupplierCopy, "vehicles">
): SupplierFitmentImportContract {
  const source = {
    supplier: CT_CARBON_BRAND,
    sourceRef: product.url,
    sourceUpdatedAt: product.updatedAt,
  };
  const applications = supplierCopyVehicleApplications(copy.vehicles);
  if (!applications.length) {
    return {
      version: 1,
      mode: "needs_review",
      scope: "auto",
      applications: [],
      parentSku: null,
      source,
      note: "No vehicle could be read from CT Carbon's title or fitment note.",
    };
  }
  const v1: SupplierFitmentV1Contract = {
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications,
    parentSku: null,
    source,
    note: "Vehicles from CT Carbon's product title and fitment note.",
  };
  return upgradeSupplierFitmentContractToV2(v1);
}

function moneyFields(priceUsd: number) {
  return {
    priceSourceCurrency: "USD",
    priceEur: null,
    priceEurEurope: null,
    priceUsd,
    priceUah: null,
    priceEurB2b: null,
    priceUsdB2b: null,
    priceUahB2b: null,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    compareAtEurB2b: null,
    compareAtUsdB2b: null,
    compareAtUahB2b: null,
  } as const;
}

export type CtCarbonPricedVariant = {
  variant: CtCarbonSourceVariant;
  sitePriceGbp: number;
  priceUsd: number;
};

export function priceCtCarbonProduct(product: CtCarbonSourceProduct, gbpUsd = CT_CARBON_GBP_USD) {
  const delivery = ctCarbonDelivery(product);
  const variants: CtCarbonPricedVariant[] = product.variants.map((variant) => {
    const sitePriceGbp = ctCarbonSitePriceGbp(variant.priceExVatGbp);
    return {
      variant,
      sitePriceGbp,
      priceUsd: calculateCtCarbonPriceUsd(sitePriceGbp, delivery, gbpUsd),
    };
  });
  return { delivery, variants };
}

/** Admin import payload for one CT Carbon product (always a DRAFT; publication is a separate step). */
export function buildCtCarbonProductPayload(
  product: CtCarbonSourceProduct,
  copy: SupplierCopy,
  sourceGeneratedAt: string,
  gbpUsd = CT_CARBON_GBP_USD
): AdminShopProductPayload {
  if (!product.variants.length) throw new Error(`${product.handle}: no variant to sell`);
  const { delivery, variants } = priceCtCarbonProduct(product, gbpUsd);
  const pack = ctCarbonPackage(delivery);
  const primary = variants[0];
  const partType = ctCarbonProductType(product);
  const category = ctCarbonCategory(product);
  const collection = ctCarbonCollection(product);
  const bodyHtmlUa = buildSupplierDescriptionHtml(copy, "ua");
  const bodyHtmlEn = buildSupplierDescriptionHtml(copy, "en");
  const fitment = buildCtCarbonSupplierFitment(product, copy);
  const optionNames = product.optionNames.map(normalizeCtCarbonOptionName);
  const images = product.images;
  const image = images[0] ?? null;
  const tags = new Set<string>([CT_CARBON_BRAND, "store:main", partType.productType]);
  if (isCtCarbonGlossBlack(product)) tags.add("BLAK by CT");
  for (const tag of supplierCopyVehicleTags(copy.vehicles)) tags.add(tag);
  return {
    slug: buildCtCarbonSlug(product),
    sku: ctCarbonSku(product),
    scope: "auto",
    storefront: "main",
    brand: CT_CARBON_BRAND,
    vendor: CT_CARBON_BRAND,
    productType: partType.productType,
    productCategory: category.en,
    categoryId: null,
    tags: Array.from(tags),
    collectionIds: [],
    status: "DRAFT",
    titleUa: copy.titleUa,
    titleEn: copy.titleEn,
    categoryUa: category.ua,
    categoryEn: category.en,
    shortDescUa: copy.shortDescUa,
    shortDescEn: copy.shortDescEn,
    longDescUa: bodyHtmlUa,
    longDescEn: bodyHtmlEn,
    bodyHtmlUa,
    bodyHtmlEn,
    leadTimeUa: null,
    leadTimeEn: null,
    // Made to order by CT Carbon in the UK: sell to order.
    stock: "preOrder",
    collectionUa: collection.ua,
    collectionEn: collection.en,
    ...moneyFields(primary.priceUsd),
    // Estimated packed size from the part classes (CT's own weights are placeholders).
    weight: pack.weightKg,
    length: pack.lengthCm,
    width: pack.widthCm,
    height: pack.heightCm,
    isDimensionsEstimated: true,
    image,
    seoTitleUa: copy.seoTitleUa,
    seoTitleEn: copy.seoTitleEn,
    seoDescriptionUa: copy.seoDescriptionUa,
    seoDescriptionEn: copy.seoDescriptionEn,
    isPublished: false,
    publishedAt: null,
    gallery: images,
    highlights: { ua: copy.keyPointsUa, en: copy.keyPointsEn },
    media: images.map((src, index) => ({
      src,
      altText: index === 0 ? copy.imageAltEn : copy.titleEn,
      position: index + 1,
      mediaType: "IMAGE" as const,
    })),
    options: optionNames.map((name, index) => ({
      name,
      position: index + 1,
      values: Array.from(
        new Set(product.variants.map((variant) => variant.options[index]).filter(Boolean))
      ),
    })),
    variants: variants.map(({ variant, priceUsd }, index) => ({
      title: variant.options.join(" / ") || "Default",
      sku: ctCarbonVariantSku(product, variant),
      position: index + 1,
      option1Value: optionNames[0] ? (variant.options[0] ?? null) : null,
      option2Value: optionNames[1] ? (variant.options[1] ?? null) : null,
      option3Value: optionNames[2] ? (variant.options[2] ?? null) : null,
      inventoryQty: 0,
      inventoryPolicy: "CONTINUE" as const,
      fulfillmentService: "manual",
      ...moneyFields(priceUsd),
      grams: Math.round(pack.weightKg * 1000),
      weight: pack.weightKg,
      weightUnit: "kg",
      requiresShipping: true,
      taxable: true,
      image: variant.image ?? image,
      isDefault: index === 0,
    })),
    metafields: [
      {
        namespace: SUPPLIER_FITMENT_NAMESPACE,
        key: SUPPLIER_FITMENT_KEY,
        value: JSON.stringify(fitment),
        valueType: "json",
      },
      { namespace: "ct_carbon_import", key: "official_url", value: product.url, valueType: "url" },
      {
        namespace: "ct_carbon_import",
        key: "pricing",
        value: JSON.stringify({
          gbpUsd,
          markup: CT_CARBON_MARKUP,
          delivery,
          variants: variants.map(({ variant, sitePriceGbp, priceUsd }) => ({
            supplierSku: variant.sku,
            priceExVatGbp: variant.priceExVatGbp,
            salePriceExVatGbp: variant.salePriceExVatGbp,
            sitePriceGbp,
            priceUsd,
          })),
        }),
        valueType: "json",
      },
      {
        namespace: "ct_carbon_import",
        key: "price_formula",
        value:
          "(site £ with VAT × 1.15 + delivery to Medyka £) × GBP/USD + delivery Medyka → Ukraine $, rounded up to $5; kits add up the delivery of their parts",
        valueType: "single_line_text_field",
      },
      {
        namespace: "ct_carbon_import",
        key: "source_feed",
        value: CT_CARBON_SOURCE_FEED,
        valueType: "url",
      },
      {
        namespace: "ct_carbon_import",
        key: "source_generated_at",
        value: sourceGeneratedAt,
        valueType: "date_time",
      },
    ],
  };
}
