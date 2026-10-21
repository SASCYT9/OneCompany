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
  slugifySupplierText,
  supplierCopyVehicleApplications,
  supplierCopyVehicleTags,
  trimSupplierSlug,
  type SupplierCopy,
} from "@/lib/supplierCatalogCopy";

/**
 * Dinan and APR (Holley brands): dealer price list + official product pages
 * (dinancars.com / goapr.com share one platform) → One Company products.
 *
 * Price (Ігор, 21.10.2026): MAP (the price-list "MAP" column, the brand's
 * advertised price) × 1.15 + $12 per kg of the price-list weight, which is in
 * POUNDS and is already the boxed weight. MSRP ("Retail") is used only when a
 * SKU has no MAP. Never a sale price shown on the brand's website.
 * Owner, 19.10.2026: the final price must not be higher than competitors' and
 * not lower than MAP + $12/kg.
 */
export const HOLLEY_BRAND_MARKUP = 1.15;
export const HOLLEY_BRAND_USD_PER_KG = 12;
export const POUND_KG = 0.45359237;

export type HolleyBrandKey = "dinan" | "apr";

export const HOLLEY_BRANDS: Record<
  HolleyBrandKey,
  { brand: string; site: string; imageHost: string; namespace: string; slugPrefix: string }
> = {
  dinan: {
    brand: "Dinan",
    site: "https://www.dinancars.com",
    imageHost: "https://images.dinancars.com",
    namespace: "dinan_import",
    slugPrefix: "dinan",
  },
  apr: {
    brand: "APR",
    site: "https://www.goapr.com",
    imageHost: "https://images.goapr.com",
    namespace: "apr_import",
    slugPrefix: "apr",
  },
};

export type HolleyPriceListItem = {
  sku: string;
  category: string | null;
  status: string | null;
  mapUsd: number | null;
  retailUsd: number | null;
  description: string | null;
  upc: string | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  weightLb: number | null;
  countryOfOrigin: string | null;
  htsCode: string | null;
  emissionsCode: string | null;
  emissionsDescription: string | null;
};

export type HolleyCompetitorPrice = {
  shop: string;
  url: string;
  priceUah: number;
  priceUsd: number;
  availability: string | null;
};

export type HolleyPriceDecision = {
  formulaUsd: number;
  floorUsd: number | null;
  competitorUsd: number | null;
  priceUsd: number;
  rule: "formula" | "competitor" | "floor";
};

/** Base price × 1.15 + $12/kg (price-list pounds → kg), rounded up to a whole dollar. */
export function calculateHolleyFormulaUsd(baseUsd: number, weightLb: number) {
  if (!Number.isFinite(baseUsd) || baseUsd <= 0) {
    throw new Error("Base price must be a positive number");
  }
  const weight = Number.isFinite(weightLb) && weightLb > 0 ? weightLb : 0;
  const cents = Math.round(
    (baseUsd * HOLLEY_BRAND_MARKUP + HOLLEY_BRAND_USD_PER_KG * weight * POUND_KG) * 100
  );
  return Math.ceil(cents / 100);
}

/**
 * Not more expensive than the cheapest competitor, but never below the floor
 * (the US price plus our shipping), so a stale competitor price cannot push a
 * product under what it costs to bring it in.
 */
export function decideHolleyPriceUsd(input: {
  retailUsd: number;
  mapUsd: number | null;
  weightLb: number;
  competitorUsd: number[];
}): HolleyPriceDecision {
  const hasMap = input.mapUsd !== null && input.mapUsd > 0;
  const formulaUsd = calculateHolleyFormulaUsd(
    hasMap ? input.mapUsd! : input.retailUsd,
    input.weightLb
  );
  const shippingUsd = HOLLEY_BRAND_USD_PER_KG * Math.max(0, input.weightLb || 0) * POUND_KG;
  const floorUsd = hasMap ? Math.ceil(input.mapUsd! + shippingUsd) : null;
  const competitors = input.competitorUsd.filter((value) => Number.isFinite(value) && value > 0);
  const competitorUsd = competitors.length ? Math.min(...competitors) : null;
  if (competitorUsd === null || competitorUsd >= formulaUsd) {
    return { formulaUsd, floorUsd, competitorUsd, priceUsd: formulaUsd, rule: "formula" };
  }
  const matched = Math.floor(competitorUsd);
  if (floorUsd !== null && matched < floorUsd) {
    return { formulaUsd, floorUsd, competitorUsd, priceUsd: floorUsd, rule: "floor" };
  }
  return { formulaUsd, floorUsd, competitorUsd, priceUsd: matched, rule: "competitor" };
}

export type HolleyCollectedPage = {
  sku: string;
  url: string;
  name: string;
  short: string | null;
  desc: string;
  features: string[];
  install: string;
  notes: string;
  attrs: Record<string, string>;
  images: string[];
  defaultImage: string | null;
  videos: string[];
  docs: Array<{ type: string; name: string; link: string }>;
  category: string | null;
  lifecycle: string | null;
  universal: boolean | string | null;
  variations: Array<{
    title: string | null;
    options: Array<{ label: string; sku: string | null; disabled: boolean }>;
  }>;
  apps?: {
    years: string[];
    makes: string[];
    models: string[];
    engines: string[];
    submodels: string[];
    bodies: string[];
    error?: string;
  };
  appsFrom?: string;
};

export type HolleyVariant = {
  sku: string;
  optionValues: string[];
  priceList: HolleyPriceListItem;
  page: HolleyCollectedPage | null;
  competitor: HolleyCompetitorPrice | null;
  price: HolleyPriceDecision;
};

export type HolleyProductGroup = {
  id: string;
  brand: HolleyBrandKey;
  primarySku: string;
  optionNames: string[];
  variants: HolleyVariant[];
};

/** Full-size photo on the brand's image CDN (pages use sized copies such as /583x/). */
export function holleyImageUrl(brand: HolleyBrandKey, filename: string, width = 1120) {
  const clean = filename.replace(/^\/+/, "").replace(/^\d+x\//, "");
  return `${HOLLEY_BRANDS[brand].imageHost}/${width}x/${clean}`;
}

export function holleyDocumentUrl(brand: HolleyBrandKey, link: string) {
  return `${HOLLEY_BRANDS[brand].imageHost}/${link.replace(/^\/+/, "")}`;
}

/**
 * Selectors that change an attribute of the same part. Brand selectors such as
 * "Version" also link different parts (front lip / side skirts / diffuser,
 * front / rear sway bar), so those stay separate products.
 */
const VARIANT_ATTRIBUTE_TITLES = new Set(
  [
    "Color",
    "Colour",
    "Finish",
    "Tip Finish",
    "Material",
    "Length",
    "Diameter",
    "Width",
    "Offset",
    "Thickness",
    "Size",
    "Pad Type",
    "Caliper Color",
    "Rotor Type",
    "Hardware Finish",
  ].map((title) => title.toLowerCase())
);

function selectorKey(title: string | null | undefined) {
  return String(title ?? "")
    .trim()
    .toLowerCase();
}

function isVariantAttribute(title: string | null | undefined) {
  return VARIANT_ATTRIBUTE_TITLES.has(selectorKey(title));
}

/** Product options are stored in three columns (option1..option3). */
const MAX_VARIANT_OPTIONS = 3;

/**
 * Products whose brand page offers attribute choices (tip finish, colour,
 * length…) become one product with variants; every other SKU stays a product
 * of its own. Brand pages also cross-link parts through those selectors (an A01
 * wheel's colour list points at A02 wheels), so SKUs only join when their other
 * choices ("Version") agree, and a family whose choices cannot tell every SKU
 * apart stays split into single products.
 */
export function groupHolleyVariants(
  brand: HolleyBrandKey,
  skus: string[],
  pages: Map<string, HolleyCollectedPage>,
  /** Dealer price-list description per SKU ("IGNITION SRVC KIT; B SERIES, 4-CYL, BLK"). */
  priceListText: Map<string, string> = new Map()
) {
  const inScope = new Set(skus);

  // Each SKU's choice per selector: from its own page, else from a page that links to it.
  const choices = new Map<string, Map<string, string>>();
  const remember = (sku: string, title: string | null, label: string, own: boolean) => {
    const key = selectorKey(title);
    const value = label.trim();
    if (!key || !value) return;
    const known = choices.get(sku) ?? new Map<string, string>();
    if (own || !known.has(key)) known.set(key, value);
    choices.set(sku, known);
  };
  for (const [sku, page] of pages) {
    for (const variation of page.variations ?? []) {
      const own = variation.options.find((option) => option.sku === sku);
      if (own) remember(sku, variation.title, own.label, true);
    }
  }
  for (const [sku, page] of pages) {
    for (const variation of page.variations ?? []) {
      for (const option of variation.options) {
        if (option.sku && option.sku !== sku) {
          remember(option.sku, variation.title, option.label, false);
        }
      }
    }
  }
  const choice = (sku: string, title: string | null) => choices.get(sku)?.get(selectorKey(title));

  const parent = new Map(skus.map((sku) => [sku, sku]));
  const find = (sku: string): string => {
    const next = parent.get(sku) ?? sku;
    if (next === sku) return sku;
    const root = find(next);
    parent.set(sku, root);
    return root;
  };
  for (const sku of skus) {
    const variations = pages.get(sku)?.variations ?? [];
    const otherSelectors = variations.filter((variation) => !isVariantAttribute(variation.title));
    const sameOtherChoices = (other: string) =>
      otherSelectors.every((variation) => {
        const mine = choice(sku, variation.title);
        const theirs = choice(other, variation.title);
        return !mine || !theirs || mine === theirs;
      });
    for (const variation of variations.filter((item) => isVariantAttribute(item.title))) {
      for (const option of variation.options) {
        if (option.sku && option.sku !== sku && inScope.has(option.sku)) {
          if (sameOtherChoices(option.sku)) parent.set(find(option.sku), find(sku));
        }
      }
    }
  }
  const families = new Map<string, string[]>();
  for (const sku of skus) {
    const root = find(sku);
    families.set(root, [...(families.get(root) ?? []), sku]);
  }

  const single = (sku: string) => ({
    id: `${brand}:${sku}`,
    primarySku: sku,
    optionNames: [] as string[],
    members: [{ sku, optionValues: [] as string[] }],
  });
  const grouped = Array.from(families.values()).flatMap((family) => {
    if (family.length === 1) return [single(family[0])];
    const titles: string[] = [];
    for (const sku of family) {
      for (const variation of pages.get(sku)?.variations ?? []) {
        const title = variation.title?.trim() ?? "";
        if (!isVariantAttribute(title)) continue;
        if (!titles.some((known) => selectorKey(known) === selectorKey(title))) titles.push(title);
      }
    }
    // Only selectors whose value actually differs inside the family become options.
    const optionNames = titles.filter(
      (title) => new Set(family.map((sku) => choice(sku, title) ?? "")).size > 1
    );
    const rows = family.map((sku) => optionNames.map((title) => choice(sku, title) ?? ""));
    const distinct = new Set(rows.map((row) => JSON.stringify(row))).size === rows.length;
    const complete = rows.every((row) => row.every(Boolean));
    if (!optionNames.length || optionNames.length > MAX_VARIANT_OPTIONS || !distinct || !complete) {
      return family.map(single);
    }
    return [
      {
        id: `${brand}:${family[0]}`,
        primarySku: family[0],
        optionNames,
        members: family.map((sku, index) => ({ sku, optionValues: rows[index] })),
      },
    ];
  });

  // Some families have one page per version and no selector: Dinan by Brembo kits
  // D290-0011-B / -BD / -R / -RD share a name and differ only in the short text; APR
  // ignition kits KT100025..27 share a name and differ only in the colour ("- RED");
  // Dinan ignition kits name the colour last ("... - 4-Cylinder - Black"), and only the
  // price list tells B- from N-series engines, so it is part of their family key.
  const merged = new Map<string, (typeof grouped)[number]>();
  const absorbed = new Set<string>();
  const normalizedName = (sku: string) => pages.get(sku)!.name.replace(/\s+/g, " ").trim();
  const passes: Array<{
    key: (sku: string) => string;
    options: (family: string[]) => ReturnType<typeof shortTextOptions>;
  }> = [
    {
      key: (sku) => `${sku.replace(/-[A-Z]{1,3}$/, "")}|${normalizedName(sku)}`,
      options: (family) => {
        const familyPages = family.map((sku) => pages.get(sku)!);
        return (
          skuSuffixOptions(family, familyPages) ??
          shortTextOptions(familyPages) ??
          finishSuffixOptions(family)
        );
      },
    },
    {
      key: (sku) => normalizedName(sku),
      options: (family) => shortTextOptions(family.map((sku) => pages.get(sku)!)),
    },
    {
      key: (sku) => {
        const name = normalizedName(sku);
        if (!TRAILING_COLOR.test(name)) return `own:${sku}`;
        const listed = (priceListText.get(sku) ?? "").replace(PRICE_LIST_COLOR, "").trim();
        return `${name.replace(TRAILING_COLOR, "")}|${listed}`;
      },
      options: (family) => {
        const rows = family.map((sku) => [
          capitalize(normalizedName(sku).match(TRAILING_COLOR)![1]),
        ]);
        if (new Set(rows.map((row) => row[0])).size !== rows.length) return null;
        return { names: ["Color"], rows };
      },
    },
  ];
  for (const pass of passes) {
    const candidates = new Map<string, string[]>();
    for (const group of grouped) {
      const sku = group.primarySku;
      if (group.members.length !== 1 || !pages.get(sku) || merged.has(sku) || absorbed.has(sku)) {
        continue;
      }
      const key = pass.key(sku);
      candidates.set(key, [...(candidates.get(key) ?? []), sku]);
    }
    for (const family of candidates.values()) {
      if (family.length < 2) continue;
      const options = pass.options(family);
      if (!options) continue;
      merged.set(family[0], {
        id: `${brand}:${family[0]}`,
        primarySku: family[0],
        optionNames: options.names,
        members: family.map((sku, index) => ({ sku, optionValues: options.rows[index] })),
      });
      for (const sku of family.slice(1)) absorbed.add(sku);
    }
  }
  return grouped
    .filter((group) => !absorbed.has(group.primarySku))
    .map((group) => merged.get(group.primarySku) ?? group);
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const COLOR_WORDS = "black|red|blue|gr[ae]y|silver|gunmetal|bronze|white|yellow|orange|green|gold";
/** "Dinan Ignition Service Kit - 4-Cylinder - Black" */
const TRAILING_COLOR = new RegExp(`\\s+-\\s+(${COLOR_WORDS})$`, "i");
/** "IGNITION SRVC KIT; B SERIES, 4-CYL, BLK" */
const PRICE_LIST_COLOR = /[;,\s]+(?:blk|black|red|blu|blue|gry|grey|gray|sil|silver|wht|white)$/i;

/** Versions a brand names only in the short text: "Front - Red Calipers - Drilled - F01/F02". */
const SHORT_TEXT_OPTIONS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "Caliper Color",
    pattern: /^(black|red|silver|gr[ae]y|yellow|blue|gold|orange)\s+calipers?$/i,
  },
  { name: "Rotor Type", pattern: /^(slotted|drilled|cross[- ]drilled|plain)(?:\s+rotors?)?$/i },
  {
    name: "Color",
    pattern: /^(black|red|blue|gr[ae]y|silver|gunmetal|bronze|white|yellow|orange|green|gold)$/i,
  },
];

/**
 * Dinan by Brembo kits spell the version in the SKU: -B black, -R red, -G grey
 * calipers, a trailing D for drilled rotors. The SKU wins over the short text,
 * which is sometimes wrong (D290-0611-RD says "Black Calipers - Slotted", its
 * photo shows red calipers and drilled rotors).
 */
const CALIPER_SUFFIX = /-([BRG])(D?)$/;
const CALIPER_COLORS: Record<string, string> = { B: "Black", R: "Red", G: "Grey" };

function skuSuffixOptions(skus: string[], pages: HolleyCollectedPage[]) {
  if (!pages.every((page) => /\bcalipers?\b/i.test(String(page.short ?? "")))) return null;
  const parsed = skus.map((sku) => sku.match(CALIPER_SUFFIX));
  if (parsed.some((match) => !match)) return null;
  const color = parsed.map((match) => CALIPER_COLORS[match![1]]);
  const rotor = parsed.map((match) => (match![2] ? "Drilled" : "Slotted"));
  const names: string[] = [];
  const columns: string[][] = [];
  if (new Set(color).size > 1) {
    names.push("Caliper Color");
    columns.push(color);
  }
  if (new Set(rotor).size > 1) {
    names.push("Rotor Type");
    columns.push(rotor);
  }
  if (!names.length) return null;
  const rows = skus.map((_, row) => columns.map((column) => column[row]));
  if (new Set(rows.map((row) => JSON.stringify(row))).size !== rows.length) return null;
  return { names, rows };
}

/**
 * Dinan wheel sets end in their finish: D750-0080-GA1R-BLK / -SIL. Used when the
 * pages cannot tell them apart (the -SIL page also says "Black").
 */
const FINISH_SUFFIXES: Record<string, string> = {
  BLK: "Black",
  SIL: "Silver",
  HYP: "Hyper Silver",
  GRY: "Grey",
  BRZ: "Bronze",
};

function finishSuffixOptions(skus: string[]) {
  const rows = skus.map((sku) => [FINISH_SUFFIXES[sku.match(/-([A-Z]{3})$/)?.[1] ?? ""]]);
  if (rows.some((row) => !row[0])) return null;
  if (new Set(rows.map((row) => row[0])).size !== rows.length) return null;
  return { names: ["Color"], rows };
}

function shortTextOptions(pages: HolleyCollectedPage[]) {
  const tokens = pages.map((page) =>
    String(page.short ?? "")
      .split(/\s+-\s+/)
      .map((token) => token.trim())
  );
  const width = tokens[0].length;
  if (width < 2 || tokens.some((row) => row.length !== width)) return null;
  const names: string[] = [];
  const columns: string[][] = [];
  for (let index = 0; index < width; index += 1) {
    const column = tokens.map((row) => row[index]);
    if (new Set(column.map((value) => value.toLowerCase())).size === 1) continue;
    const rule = SHORT_TEXT_OPTIONS.find((candidate) =>
      column.every((value) => candidate.pattern.test(value))
    );
    if (!rule) return null;
    names.push(rule.name);
    columns.push(column.map((value) => capitalize(value.match(rule.pattern)![1])));
  }
  if (!names.length || names.length > MAX_VARIANT_OPTIONS) return null;
  const rows = pages.map((_, row) => columns.map((column) => column[row]));
  if (new Set(rows.map((row) => JSON.stringify(row))).size !== rows.length) return null;
  return { names, rows };
}

/** Site taxonomy for the brand's own category path. */
export function holleyCategory(path: string | null | undefined) {
  const value = String(path ?? "").toLowerCase();
  const rules: Array<[RegExp, { ua: string; en: string }]> = [
    [/brake/, { ua: "Гальмівні системи", en: "Brake Systems" }],
    [/exhaust|muffler|downpipe|tip/, { ua: "Вихлопні системи", en: "Exhaust Systems" }],
    [/intake|filter|turbo inlet|inlet/, { ua: "Впускні системи", en: "Intake Systems" }],
    [/wheel|lug|valve stem/, { ua: "Диски та аксесуари", en: "Wheels & Accessories" }],
    [
      /sway|suspension|spring|coilover|shock|strut|camber|link|mount|bushing|brace|chassis/,
      { ua: "Підвіска", en: "Suspension" },
    ],
    [/ignition|coil|spark/, { ua: "Запалювання", en: "Ignition" }],
    [/cool|heat exchanger|intercooler|charge air|radiator/, { ua: "Охолодження", en: "Cooling" }],
    [/fuel|pump|injector/, { ua: "Паливна система", en: "Fuel System" }],
    [
      /turbo|supercharger|pulley|boost|throttle|engine/,
      { ua: "Двигун і наддув", en: "Engine & Forced Induction" },
    ],
    [
      /drivetrain|shift|clutch|flywheel|differential|haldex|transmission/,
      { ua: "Трансмісія", en: "Drivetrain" },
    ],
    [/interior|steering|pedal|floor|mat/, { ua: "Інтер'єр", en: "Interior" }],
    [
      /body|aero|carbon|cosmetic|exterior|cover/,
      { ua: "Екстер'єр і карбон", en: "Exterior & Carbon" },
    ],
  ];
  for (const [pattern, category] of rules) if (pattern.test(value)) return category;
  return { ua: "Тюнінг-деталі", en: "Performance Parts" };
}

/** Sizes ("18 IN", "2 MM") read best in ascending order; other choices keep the brand's order. */
function sortOptionValues(values: string[]) {
  const size = (value: string) => value.match(/^(\d+(?:[.,]\d+)?)\s*(?:mm|in)?$/i);
  if (!values.every((value) => size(value))) return values;
  return [...values].sort(
    (a, b) => Number(size(a)![1].replace(",", ".")) - Number(size(b)![1].replace(",", "."))
  );
}

/**
 * The slug comes from the brand's own product name, which is stable. A product
 * with variants uses the words its versions' names share ("APR A02 Flow Formed
 * Wheel"), so the slug does not name one colour or size.
 */
function holleySlugName(group: HolleyProductGroup) {
  const primary =
    group.variants.find((variant) => variant.sku === group.primarySku) ?? group.variants[0];
  const primaryName = (primary.page?.name ?? primary.priceList.description ?? primary.sku).split(
    "\n"
  )[0];
  const names = group.variants
    .map((variant) => variant.page?.name.split("\n")[0])
    .filter((name): name is string => Boolean(name));
  if (group.variants.length < 2 || names.length < 2) return primaryName;
  const words = names.map((name) => name.replace(/\s+/g, " ").trim().split(" "));
  const shared: string[] = [];
  for (
    let index = 0;
    words.every((list) => list[index] && list[index] === words[0][index]);
    index++
  ) {
    shared.push(words[0][index]);
  }
  const prefix = shared.join(" ").replace(/[\s|(\-–:,]+$/, "");
  if (prefix.split(" ").length >= 4) return prefix;
  // Too little in common: drop the primary version's own choices from its name.
  return primary.optionValues.reduce(
    (name, value) =>
      name.replace(new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), ""),
    primaryName
  );
}

export function buildHolleySlug(brand: HolleyBrandKey, name: string, sku: string) {
  const firstName = name.split("\n")[0] ?? name;
  const base = firstName.replace(new RegExp(`^${HOLLEY_BRANDS[brand].brand}\\s+`, "i"), "");
  return `${HOLLEY_BRANDS[brand].slugPrefix}-${trimSupplierSlug(base, 60)}-${slugifySupplierText(sku)}`;
}

export function buildHolleySupplierFitment(
  brand: HolleyBrandKey,
  page: Pick<HolleyCollectedPage, "url" | "universal"> | null,
  copy: Pick<SupplierCopy, "vehicles">
): SupplierFitmentImportContract {
  const source = {
    supplier: HOLLEY_BRANDS[brand].brand,
    sourceRef: page?.url ?? HOLLEY_BRANDS[brand].site,
    sourceUpdatedAt: null,
  };
  const applications = supplierCopyVehicleApplications(copy.vehicles);
  if (!applications.length) {
    const universal = String(page?.universal) === "true";
    return {
      version: 1,
      mode: universal ? "universal" : "needs_review",
      scope: "auto",
      applications: [],
      parentSku: null,
      source,
      note: universal
        ? "The brand lists this part as universal."
        : "No vehicle application on the brand's page; review before showing in the vehicle filter.",
    };
  }
  const v1: SupplierFitmentV1Contract = {
    version: 1,
    mode: "vehicle_specific",
    scope: "auto",
    applications,
    parentSku: null,
    source,
    note: "Applications from the brand's own product page.",
  };
  return upgradeSupplierFitmentContractToV2(v1);
}

const ROUND_KG = (lb: number | null) =>
  lb && lb > 0 ? Math.round(lb * POUND_KG * 100) / 100 : null;
const ROUND_CM = (inches: number | null) =>
  inches && inches > 0 ? Math.round(inches * 2.54 * 10) / 10 : null;

/** Admin import payload for one product group (always a DRAFT). */
/**
 * Brand wheels are priced per wheel ("Sold Individually", "(1 Wheel)"); buyers
 * expect a set, so the card and the specs say it plainly.
 */
function withSaleUnit(copy: SupplierCopy, page: HolleyCollectedPage | null): SupplierCopy {
  const text = `${page?.name ?? ""} ${page?.short ?? ""}`;
  if (!/wheel/i.test(text) || !/sold individually|\(1 wheel\)/i.test(text)) return copy;
  const hasQuantityRow = [...copy.specsUa, ...copy.specsEn].some((spec) =>
    /кількість|quantity/i.test(spec.label)
  );
  return {
    ...copy,
    shortDescUa: /за 1 диск/i.test(copy.shortDescUa)
      ? copy.shortDescUa
      : `${copy.shortDescUa} Ціна вказана за 1 диск.`,
    shortDescEn: /per wheel/i.test(copy.shortDescEn)
      ? copy.shortDescEn
      : `${copy.shortDescEn} Price is per wheel.`,
    specsUa: hasQuantityRow
      ? copy.specsUa
      : [{ label: "Кількість", value: "1 диск" }, ...copy.specsUa],
    specsEn: hasQuantityRow
      ? copy.specsEn
      : [{ label: "Quantity", value: "1 wheel" }, ...copy.specsEn],
  };
}

export function buildHolleyProductPayload(
  group: HolleyProductGroup,
  reviewedCopy: SupplierCopy,
  sourceGeneratedAt: string
): AdminShopProductPayload {
  const meta = HOLLEY_BRANDS[group.brand];
  const primary =
    group.variants.find((variant) => variant.sku === group.primarySku) ?? group.variants[0];
  const page = primary.page;
  const copy = withSaleUnit(reviewedCopy, page);
  const category = holleyCategory(page?.category ?? primary.priceList.category);
  const gallery = Array.from(
    new Set(
      [
        ...(page?.images ?? []),
        ...group.variants.map((variant) => variant.page?.defaultImage ?? null),
      ].filter((file): file is string => Boolean(file))
    )
  ).map((file) => holleyImageUrl(group.brand, file));
  const image = page?.defaultImage
    ? holleyImageUrl(group.brand, page.defaultImage)
    : (gallery[0] ?? null);
  const bodyHtmlUa = buildSupplierDescriptionHtml(copy, "ua");
  const bodyHtmlEn = buildSupplierDescriptionHtml(copy, "en");
  const fitment = buildHolleySupplierFitment(group.brand, page, copy);
  const tags = new Set<string>([meta.brand, "store:main"]);
  for (const tag of supplierCopyVehicleTags(copy.vehicles)) tags.add(tag);
  const optionNames = group.optionNames;
  const variants = group.variants.map((variant, index) => {
    const variantImage = variant.page?.defaultImage
      ? holleyImageUrl(group.brand, variant.page.defaultImage)
      : image;
    const weightKg = ROUND_KG(variant.priceList.weightLb);
    return {
      title: variant.optionValues.filter(Boolean).join(" / ") || "Default",
      sku: variant.sku,
      position: index + 1,
      option1Value: optionNames[0] ? (variant.optionValues[0] ?? null) : null,
      option2Value: optionNames[1] ? (variant.optionValues[1] ?? null) : null,
      option3Value: optionNames[2] ? (variant.optionValues[2] ?? null) : null,
      inventoryQty: 0,
      inventoryPolicy: "CONTINUE" as const,
      fulfillmentService: "manual",
      priceSourceCurrency: "USD",
      priceEur: null,
      priceEurEurope: null,
      priceUsd: variant.price.priceUsd,
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
      barcode: variant.priceList.upc,
      weight: weightKg,
      weightUnit: weightKg ? "kg" : null,
      length: ROUND_CM(variant.priceList.lengthIn),
      width: ROUND_CM(variant.priceList.widthIn),
      height: ROUND_CM(variant.priceList.heightIn),
      requiresShipping: true,
      taxable: true,
      image: variantImage,
      isDefault: variant.sku === primary.sku,
    };
  });
  const primaryVariant = variants.find((variant) => variant.isDefault) ?? variants[0];
  const docs = (page?.docs ?? []).filter((doc) => doc.link);
  return {
    slug: buildHolleySlug(group.brand, holleySlugName(group), primary.sku),
    sku: primary.sku,
    scope: "auto",
    storefront: "main",
    brand: meta.brand,
    vendor: meta.brand,
    productType: category.en,
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
    // Brand stock is not OneCompany warehouse stock: sell to order.
    stock: "preOrder",
    // The product page already shows the category as the product type chip.
    collectionUa: null,
    collectionEn: null,
    priceSourceCurrency: "USD",
    priceEur: null,
    priceEurEurope: null,
    priceUsd: primaryVariant.priceUsd,
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
    // Price-list weight and box size are the packed item, as the shipping fields require.
    weight: primaryVariant.weight,
    length: primaryVariant.length,
    width: primaryVariant.width,
    height: primaryVariant.height,
    isDimensionsEstimated: false,
    image,
    seoTitleUa: copy.seoTitleUa,
    seoTitleEn: copy.seoTitleEn,
    seoDescriptionUa: copy.seoDescriptionUa,
    seoDescriptionEn: copy.seoDescriptionEn,
    isPublished: false,
    publishedAt: null,
    gallery,
    highlights: { ua: copy.keyPointsUa, en: copy.keyPointsEn },
    media: [
      ...gallery.map((src, index) => ({
        src,
        altText: index === 0 ? copy.imageAltEn : copy.titleEn,
        position: index + 1,
        mediaType: "IMAGE" as const,
      })),
      ...(page?.videos ?? []).map((id, index) => ({
        src: `https://www.youtube.com/embed/${id}`,
        altText: copy.titleEn,
        position: gallery.length + index + 1,
        mediaType: "EXTERNAL_VIDEO" as const,
      })),
    ],
    options: optionNames.map((name, index) => ({
      name,
      position: index + 1,
      values: sortOptionValues(
        Array.from(
          new Set(group.variants.map((variant) => variant.optionValues[index]).filter(Boolean))
        )
      ),
    })),
    variants,
    metafields: [
      {
        namespace: SUPPLIER_FITMENT_NAMESPACE,
        key: SUPPLIER_FITMENT_KEY,
        value: JSON.stringify(fitment),
        valueType: "json",
      },
      {
        namespace: meta.namespace,
        key: "official_url",
        value: page?.url ?? meta.site,
        valueType: "url",
      },
      {
        namespace: meta.namespace,
        key: "pricing",
        value: JSON.stringify(
          group.variants.map((variant) => ({
            sku: variant.sku,
            msrpUsd: variant.priceList.retailUsd,
            mapUsd: variant.priceList.mapUsd,
            weightLb: variant.priceList.weightLb,
            ...variant.price,
            competitor: variant.competitor,
          }))
        ),
        valueType: "json",
      },
      {
        namespace: meta.namespace,
        key: "price_formula",
        value:
          "MAP × 1.15 + $12/kg (price-list pounds; MSRP when there is no MAP), rounded up to $1; not above the cheapest competitor, not below MAP + $12/kg",
        valueType: "single_line_text_field",
      },
      ...(docs.length
        ? [
            {
              namespace: meta.namespace,
              key: "documents",
              value: JSON.stringify(
                docs.map((doc) => ({
                  name: doc.name,
                  url: holleyDocumentUrl(group.brand, doc.link),
                }))
              ),
              valueType: "json",
            },
          ]
        : []),
      ...(primary.priceList.countryOfOrigin
        ? [
            {
              namespace: meta.namespace,
              key: "country_of_origin",
              value: primary.priceList.countryOfOrigin,
              valueType: "single_line_text_field",
            },
          ]
        : []),
      {
        namespace: meta.namespace,
        key: "source_generated_at",
        value: sourceGeneratedAt,
        valueType: "date_time",
      },
    ],
  };
}
