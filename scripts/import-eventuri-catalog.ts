import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import {
  adminProductImportMergeSelect,
  buildAdminProductCreateData,
  buildAdminProductSnapshotMergeUpdateData,
  type AdminShopProductPayload,
} from "../src/lib/shopAdminCatalog";
import { buildProductsFromShopifyCsv } from "../src/lib/shopAdminCsv";
import {
  SUPPLIER_FITMENT_KEY,
  SUPPLIER_FITMENT_NAMESPACE,
  type SupplierFitmentApplication,
  type SupplierFitmentContract,
} from "../src/lib/shopImportFitment";
import { getExpectedChassisForMakeModel } from "../src/lib/crossShopFitment";
import {
  decideEventuriMediaMigration,
  getExpectedEventuriMediaSources,
} from "../src/lib/eventuriMediaMigration";
import { replaceStorefrontTag } from "../src/lib/shopProductStorefront";
import { sanitizeRichTextHtml } from "../src/lib/sanitizeRichTextHtml";

type Mode = "dry-run" | "preview-one" | "commit-draft" | "publish-approved" | "repair-fitment";
type CategoryKey = "intake" | "turbo-pipes" | "engine-cover" | "brace" | "filter-accessory";

type QualityIssue = {
  slug: string;
  sku: string | null;
  reason: string;
};

type PricingAliasMatch = {
  productSlug: string;
  sourceSku: string;
  targetSku: string;
  status: "confirmed" | "review";
  indUsd: number;
  sourceUrl: string;
  note: string;
};

type ImportReport = {
  mode: Mode;
  source: string;
  generatedAt: string;
  counts: Record<string, number>;
  duplicateSkus: Array<{ sku: string; slugs: string[] }>;
  zeroPrices: QualityIssue[];
  missingImages: QualityIssue[];
  incompleteFitment: QualityIssue[];
  translationIssues: QualityIssue[];
  unavailableMedia: Array<{ url: string; error: string }>;
  missingIndPricing: QualityIssue[];
  pricing: {
    markupPct: number;
    uahPerUsd: number;
    matchedVariants: number;
    missingVariants: number;
    averageDeltaFromCsvPct: number | null;
    aliasMatches: PricingAliasMatch[];
  };
  created: string[];
  updated: string[];
  published: string[];
  skipped: QualityIssue[];
};

type TranslationCacheEntry = {
  titleEn: string;
  bodyHtmlEn: string | null;
  longDescEn: string | null;
  shortDescEn: string | null;
  seoTitleEn: string | null;
  seoDescriptionEn: string | null;
};

const DEFAULT_SOURCE = "D:\\products_export_EVENTURI.csv";
const prisma = new PrismaClient();
const TRANSLATION_PRIMARY_MODEL =
  process.env.OPS_GEMINI_PRIMARY_MODEL?.trim() || "gemini-3.5-flash-lite";
const TRANSLATION_FALLBACK_MODEL =
  process.env.OPS_GEMINI_FALLBACK_MODEL?.trim() || "gemini-3.5-flash";

// Eventuri/IND have changed SKU naming over time. These are explicit, audited
// aliases rather than fuzzy matching: the target SKU must still be present in
// the live IND collection and the alias is recorded on the imported product.
const IND_SKU_ALIASES: Record<string, Omit<PricingAliasMatch, "productSlug" | "indUsd">> = {
  "EVE-A90B48-INT": {
    targetSku: "EVE-G29Z4-B48-INT",
    status: "confirmed",
    sourceUrl:
      "https://ind-distribution.com/products/eventuri-toyota-a90-supra-b48-black-carbon-intake-system",
    note: "Legacy A90 B48 SKU; IND currently lists the shared A90 Supra / G29 Z4 B48 product.",
  },
  "EVE-C63S-CF-INT": {
    targetSku: "EVE-C63SV2-CF-INT",
    status: "confirmed",
    sourceUrl: "https://ind-distribution.com/products/eventuri-w205-c63s-carbon-intake-system",
    note: "Legacy stock-turbo SKU; IND currently lists the V2 product under the C63SV2 SKU.",
  },
  "EVE-C63S-TRB-CF-INT": {
    targetSku: "EVE-C63SV2-CF-INT",
    status: "confirmed",
    sourceUrl: "https://ind-distribution.com/products/eventuri-w205-c63s-carbon-intake-system",
    note: "Upgraded-turbo 3-inch configuration is a second SKU for the same V2 product; the exact SKU is independently listed at USD 2,950 by Evasive, matching the current IND V2 price.",
  },
  "EVE-FK8V3-CHG-UPG": {
    targetSku: "EVE-FK8V3-CF-CHG-UPG",
    status: "confirmed",
    sourceUrl:
      "https://ind-distribution.com/products/eventuri-fk8-civic-type-r-carbon-charge-pipe-v3-upgrade-kit",
    note: "Legacy FK8 V3 upgrade SKU missing the CF segment.",
  },
  "EVE-Z4B58-CF-INT": {
    targetSku: "EVE-A90-CF-INT",
    status: "confirmed",
    sourceUrl: "https://ind-distribution.com/products/eventuri-a90-supra-carbon-intake-system",
    note: "Legacy G29 Z4 B58 SKU; IND lists EVE-A90-CF-INT with EVE-G29Z4-B58-INT as an alternate SKU.",
  },
  "EVE-N55-ENG": {
    targetSku: "EVE-N55-CF-ENG",
    status: "confirmed",
    sourceUrl: "https://ind-distribution.com/products/eventuri-bmw-n55-carbon-fiber-engine-cover",
    note: "Legacy N55 engine-cover SKU missing the CF segment.",
  },
  "EVE-F9XM5M8-CFM-CHG": {
    targetSku: "EVE-F9XM5M8-CHG",
    status: "review",
    sourceUrl:
      "https://ind-distribution.com/products/eventuri-bmw-f90-m5-f9x-m8-carbon-turbo-inlet-set",
    note: "Matte CFM SKU is not public on IND; use the public turbo-inlet price only as a reviewed alias. Do not confuse it with the separate CF-INT intake system.",
  },
  "EVE-TRB8V8S-LHD-NIL": {
    targetSku: "EVE-TRB8V8S-LHD-STK",
    status: "review",
    sourceUrl:
      "https://ind-distribution.com/products/eventuri-audi-8v-rs3-gen-2-lhd-carbon-turbo-inlet",
    note: "NIL is not public on IND; price is shared by the current Stock/TTE/SRM configurations and remains review-blocked until the flange/turbo configuration is selected.",
  },
};

type EventuriMediaOverride = {
  src: string;
  altText: string;
};

// Three Shopify rows have no Image Src at all.  These overrides are a
// deliberately small, curated repair set: each URL was downloaded and
// visually checked before being added.  We do not crop, erase or retouch
// supplier watermarks.  Sources with an IND mark (the original EVE-FLC
// gallery and two Audi C8 gallery frames) are intentionally excluded.
const EVENTURI_MEDIA_OVERRIDES: Record<string, EventuriMediaOverride[]> = {
  "air-filter-cleaning-kit": [
    {
      src: "https://www.evasivemotorsports.com/mm5/graphics/00000001/53/EVE-FLC_2.jpg",
      altText:
        "Eventuri air filter cleaning kit with cleaner, service oil and instruction card on a white background.",
    },
  ],
  "eventuri-carbon-intake-system-replacement-filter-type-b": [
    {
      src: "https://bulletproofautomotive.com/wp-content/uploads/2025/09/eventuri_replacement_air_filter_g2_5.jpg",
      altText:
        "Eventuri Type B replacement air filter with red filter media and black Eventuri cap on a white background.",
    },
    {
      src: "https://cdn.shopify.com/s/files/1/0067/6236/4997/products/eventuri-replacement-air-filter-type-b-white-background.jpg?v=1772066920",
      altText: "Eventuri Type B replacement air filter shown from the front on a white background.",
    },
    {
      src: "https://cdn.shopify.com/s/files/1/0067/6236/4997/files/eventuri-replacement-air-filter-type-b-white-background-2.jpg?v=1772066921",
      altText: "Eventuri Type B replacement air filter shown from the side on a white background.",
    },
    {
      src: "https://cdn.shopify.com/s/files/1/0067/6236/4997/products/eventuri-replacement-air-filter-type-b-white-background-3.jpg?v=1772066921",
      altText: "Eventuri Type B replacement air filter detail on a white background.",
    },
  ],
  "audi-c8-rs6-rs7-black-carbon-intake-system": [
    {
      src: "https://www.eventuri.net/wp-content/uploads/2025/10/51382439177_e3082503c4_b.webp",
      altText: "Eventuri Audi C8 RS6 and RS7 carbon intake airbox on a white background.",
    },
    {
      src: "https://www.eventuri.net/wp-content/uploads/2025/10/51311293871_4155af8cc3_b.webp",
      altText: "Exploded view of the Eventuri Audi C8 RS6 and RS7 carbon intake system components.",
    },
    {
      src: "https://www.eventuri.net/wp-content/uploads/2025/10/51383943959_8fe816591e_b.webp",
      altText: "Eventuri Audi C8 RS6 and RS7 turbo inlet components on a white background.",
    },
    {
      src: "https://www.eventuri.net/wp-content/uploads/2025/10/51373191557_0493ce45d8_b.webp",
      altText: "Eventuri Audi C8 RS6 flow-bench comparison for the carbon intake system.",
    },
    {
      src: "https://www.eventuri.net/wp-content/uploads/2025/10/51373951741_9125e90ed0_b.webp",
      altText: "Eventuri Audi C8 RS6 flow-bench test with the carbon airbox and turbo inlets.",
    },
  ],
};

// Accessories without an explicit vehicle make/model are not left as an
// accidental needs_review fitment.  These two records are universal
// component-level fitment, with the compatibility caveat preserved in the
// provenance note instead of inventing vehicle applications.
const EVENTURI_FITMENT_OVERRIDES: Record<string, SupplierFitmentContract> = {
  "air-filter-cleaning-kit": {
    version: 1,
    mode: "universal",
    scope: "auto",
    applications: [],
    parentSku: null,
    source: {
      supplier: "Eventuri authorized product documentation",
      sourceRef:
        "https://www.evasivemotorsports.com/store/product/eventuri-air-filter-cleaning-kit/",
      sourceUpdatedAt: null,
    },
    note: "Universal maintenance kit for Eventuri performance filters; no vehicle-specific application is claimed.",
  },
  "eventuri-carbon-intake-system-replacement-filter-type-b": {
    version: 1,
    mode: "universal",
    scope: "auto",
    applications: [],
    parentSku: null,
    source: {
      supplier: "Eventuri authorized product documentation",
      sourceRef: "https://www.emscarparts.com/eventuri-replacement-filter-type-b",
      sourceUpdatedAt: null,
    },
    note: "Universal Eventuri carbon-housing replacement component; verify the intake housing before ordering. Documented exceptions include BMW E9x, Audi RS6 and FK8 Type R applications.",
  },
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function parseMode(): Mode {
  const value = process.argv[2] ?? "dry-run";
  if (
    value === "dry-run" ||
    value === "preview-one" ||
    value === "commit-draft" ||
    value === "publish-approved" ||
    value === "repair-fitment"
  )
    return value;
  throw new Error(
    `Unknown mode ${value}. Use dry-run, preview-one, commit-draft, publish-approved, or repair-fitment.`
  );
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function replaceLegacyStorefrontReference(value: string | null | undefined) {
  return value ? value.replace(/eventuri\.shop/gi, "OneCompany") : value;
}

function metafield(product: AdminShopProductPayload, namespace: string, key: string) {
  return (
    product.metafields.find((item) => item.namespace === namespace && item.key === key)?.value ?? ""
  );
}

function canonicalMake(value: string) {
  const normalized = text(value)
    .replace(/\.{3,}$/, "")
    .trim()
    .toLowerCase();
  const aliases: Record<string, string> = {
    bmw: "BMW",
    audi: "Audi",
    toyota: "Toyota",
    mini: "MINI",
    mercedes: "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    volkswagen: "Volkswagen",
    porsche: "Porsche",
    chevrolet: "Chevrolet",
    honda: "Honda",
    lamborghini: "Lamborghini",
    bentley: "Bentley",
    lotus: "Lotus",
    seat: "SEAT",
  };
  return aliases[normalized] ?? text(value);
}

function inferMake(product: AdminShopProductPayload) {
  const explicit = metafield(product, "custom", "mark");
  if (explicit) return canonicalMake(explicit);
  const corpus = `${product.titleUa} ${product.titleEn} ${product.slug}`.toLowerCase();
  if (/\b(?:countryman|cooper)\b|\bf5[46]\b|\bf60\b/.test(corpus)) return "MINI";
  for (const make of [
    "BMW",
    "Audi",
    "Toyota",
    "MINI",
    "Mercedes-Benz",
    "Volkswagen",
    "Porsche",
    "Chevrolet",
    "Honda",
    "Lamborghini",
    "Bentley",
    "Lotus",
    "SEAT",
  ]) {
    const needle =
      make === "Mercedes-Benz" ? /mercedes|amg/ : new RegExp(`\\b${make.toLowerCase()}\\b`, "i");
    if (needle.test(corpus)) return make;
  }
  return null;
}

function normalizeModels(value: string) {
  return Array.from(
    new Set(
      text(value)
        // Shopify stores multi-value metafields as newline-delimited strings.
        // Treat that delimiter as first-class; otherwise the whole bundle (for
        // example "M5\\nM8") becomes one impossible model facet.
        .split(/[\n\r,;|/]+/)
        .map((item) => item.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );
}

const NON_CHASSIS_CODES = new Set([
  "B48",
  "B58",
  "EA825",
  "EA888",
  "LT6",
  "LT7",
  "N55",
  "N54",
  "N63",
  "S54",
  "S55",
  "S58",
  "S62",
  "S63",
  "S65",
  "S68",
  "S85",
  "A35",
  "A45",
  "A250",
  "C43",
  "C63",
  "C63S",
  "GLC63",
  "GLC63S",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M8",
  "X3",
  "X4",
  "X5",
  "X6",
  "X7",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
]);

function extractChassis(value: string) {
  const normalized = value.replace(/[–—−]/g, "-").toUpperCase();
  const matches =
    normalized.match(
      /\b(?:[A-Z]{1,2}\d{1,3}(?:\.\d)?[A-Z]?|(?:911|930|964|991|992|993|996|997)(?:\.\d)?|8[SVYE]|C8|MK\d(?:\.\d)?|GR4)\b/g
    ) ?? [];
  return Array.from(new Set(matches))
    .filter((code) => !NON_CHASSIS_CODES.has(code))
    .filter((code) => !/^[EFG]\dX$/.test(code));
}

function extractYears(value: string) {
  const range = value.match(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})?\+?/);
  if (range) return { yearFrom: Number(range[1]), yearTo: range[2] ? Number(range[2]) : null };
  const plus = value.match(/\b((?:19|20)\d{2})\s*\+/);
  return plus ? { yearFrom: Number(plus[1]), yearTo: null } : { yearFrom: null, yearTo: null };
}

function extractEngine(value: string) {
  return (
    value
      .match(/\b(?:B48|B58|S55|S58|S62|S63|S65|S68|LT6|LT7|EA825|EA888(?:\.4)?)\b/i)?.[0]
      ?.toUpperCase() ?? null
  );
}

const EVENTURI_MODEL_PATTERNS: Record<string, Array<[string, RegExp]>> = {
  BMW: [
    ["M135i/M140i", /\bM(?:135I|140I)\b/i],
    ["M235i/M240i", /\bM(?:235I|240I)\b/i],
    ["M340i/M340d", /\bM340[DI]?\b/i],
    ["M440i/M440d", /\bM440[DI]?\b/i],
    ["M2", /\bM2(?:C|CS)?\b/i],
    ["M3", /\bM3(?:CS|GTS)?\b/i],
    ["M4", /\bM4(?:CSL|GTS)?\b/i],
    ["M5", /\bM5\b/i],
    ["M6", /\bM6\b/i],
    ["M8", /\bM8\b/i],
    ["X3 M", /\bX3\s*M\b|\bX3M\b/i],
    ["X4 M", /\bX4\s*M\b|\bX4M\b/i],
    ["X5 M", /\bX5\s*M\b|\bX5M\b/i],
    ["X6 M", /\bX6\s*M\b|\bX6M\b/i],
    ["Xm", /\bXM\b/i],
    ["X1", /\bX1\b/i],
    ["X2", /\bX2\b/i],
    ["X3", /\bX3\b/i],
    ["X4", /\bX4\b/i],
    ["X5", /\bX5\b/i],
    ["X6", /\bX6\b/i],
    ["X7", /\bX7\b/i],
    ["Z4", /\bZ4\b/i],
    ["1 Series", /\b(?:1\s*Series|1-Series)\b/i],
    ["2 Series", /\b(?:2\s*Series|2-Series)\b/i],
    ["3 Series", /\b(?:3\s*Series|3-Series)\b/i],
    ["4 Series", /\b(?:4\s*Series|4-Series)\b/i],
    ["5 Series", /\b(?:5\s*Series|5-Series)\b/i],
    ["6 Series", /\b(?:6\s*Series|6-Series)\b/i],
    ["7 Series", /\b(?:7\s*Series|7-Series)\b/i],
    ["8 Series", /\b(?:8\s*Series|8-Series)\b/i],
  ],
  Audi: [
    ["RSQ8", /\bRS\s*Q8\b|\bRSQ8\b/i],
    ["SQ8", /\bSQ8\b/i],
    ["SQ7", /\bSQ7\b/i],
    ["RSQ3", /\bRS\s*Q3\b|\bRSQ3\b/i],
    ["RS6", /\bRS6\b/i],
    ["RS7", /\bRS7\b/i],
    ["RS5", /\bRS5\b/i],
    ["RS4", /\bRS4\b/i],
    ["RS3", /\bRS3\b/i],
    ["TTRS", /\bTT\s*RS\b|\bTTRS\b/i],
    ["Q8", /\bQ8\b/i],
    ["Q7", /\bQ7\b/i],
    ["Q3", /\bQ3\b/i],
    ["A5", /\bA5\b/i],
    ["A4", /\bA4\b/i],
  ],
  "Mercedes-Benz": [
    ["C63", /\bC63(?:S)?\b/i],
    ["GLC63", /\bGLC63(?:S)?\b/i],
    ["A45", /\bA45S?\b/i],
    ["CLA45", /\bCLA45S?\b/i],
    ["GLA45", /\bGLA45S?\b/i],
    ["A35", /\bA35\b/i],
    ["CLA35", /\bCLA35\b/i],
    ["A250", /\bA250\b/i],
    ["G63", /\bG63\b/i],
    ["AMG GT", /\bAMG\s+GT(?:R|S)?\b/i],
  ],
  Toyota: [
    ["Supra", /\bSupra\b/i],
    ["GR Corolla", /\bGR\s+Corolla\b/i],
    ["GR Yaris", /\bGR\s+Yaris\b/i],
  ],
  Porsche: [
    ["911", /\b911\b|\bGT3(?:\s*RS)?\b|\bTurbo\b/i],
    ["Cayenne", /\bCayenne\b/i],
  ],
  Honda: [["Civic", /\bCivic\b/i]],
  MINI: [
    ["Countryman", /\bCountryman\b/i],
    ["Cooper", /\bCooper\b/i],
  ],
  Chevrolet: [["Corvette", /\bCorvette\b/i]],
  Lamborghini: [
    ["Huracan", /\bHurac[aá]n\b/i],
    ["Urus", /\bUrus\b/i],
  ],
  Bentley: [["Bentayga", /\bBentayga\b/i]],
  Lotus: [["Emira", /\bEmira\b/i]],
  SEAT: [["Cupra", /\bCupra\b/i]],
  Volkswagen: [["Golf", /\bGolf\b/i]],
};

function inferModels(make: string | null, corpus: string, slug: string) {
  if (!make) return [];
  const patterns = EVENTURI_MODEL_PATTERNS[make] ?? [];
  const source = `${corpus} ${slug}`;
  return patterns.filter(([, pattern]) => pattern.test(source)).map(([model]) => model);
}

function expectedChassisForEventuriModel(make: string, model: string) {
  const aliases: Record<string, string> = {
    "3-series": "3 Series",
    "4-series": "4 Series",
    "2-series": "2 Series",
    "1-series": "1 Series",
    "5-series": "5 Series",
    "6-series": "6 Series",
    "7-series": "7 Series",
    "8-series": "8 Series",
    X3M: "X3 M",
    X4M: "X4 M",
    X5M: "X5 M",
    X6M: "X6 M",
    C63S: "C63",
    GLC63: "GLC-Class",
    GLC63S: "GLC-Class",
    A35: "A-Class",
    A250: "A-Class",
    CLA35: "CLA-Class",
    GLA45: "A45",
    "AMG GTR": "AMG GT",
    "AMG GTS": "AMG GT",
    "Corvette C8 ZR1": "Corvette",
    "GR COROLLA": "GR Corolla",
  };
  return getExpectedChassisForMakeModel(make, aliases[model] ?? model);
}

function chassisForModel(make: string, model: string, chassisCodes: string[], corpus: string) {
  const expected = expectedChassisForEventuriModel(make, model);
  if (expected) {
    const matching = chassisCodes.filter((code) =>
      expected.some((candidate) => candidate.toUpperCase() === code.toUpperCase())
    );
    if (matching.length) return matching;
  }
  const escapedModel = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nearby = chassisCodes.filter((code) =>
    new RegExp(
      `(?:${escapedModel}[^\\n]{0,28}${code}|${code}[^\\n]{0,28}${escapedModel})`,
      "i"
    ).test(corpus)
  );
  if (nearby.length) return nearby;
  return chassisCodes.length === 1 ? chassisCodes : [];
}

function buildFitment(product: AdminShopProductPayload): SupplierFitmentContract {
  const make = inferMake(product);
  const modelText = metafield(product, "custom", "carmodels");
  const corpus = `${product.titleUa} ${product.titleEn} ${modelText} ${product.slug} ${(product.tags ?? []).join(" ")} ${product.bodyHtmlUa ?? ""}`;
  const models = normalizeModels(modelText).filter((model) => !/^F\d{2}(?:\s+PRE)?$/i.test(model));
  const inferredModels = models.length ? models : inferModels(make, corpus, product.slug);
  const chassisCodes = extractChassis(corpus);
  const years = extractYears(corpus);
  const engine = extractEngine(corpus);
  const applications: SupplierFitmentApplication[] = [];
  if (make && (inferredModels.length || chassisCodes.length)) {
    const rows = inferredModels.length ? inferredModels : [null];
    for (const model of rows) {
      const relatedChassis = model
        ? chassisForModel(make, model, chassisCodes, corpus)
        : chassisCodes;
      const chassisRows = relatedChassis.length ? relatedChassis : [null];
      for (const chassisCode of chassisRows) {
        applications.push({
          vehicleType: "car",
          make,
          model,
          chassisCode,
          yearFrom: years.yearFrom,
          yearTo: years.yearTo,
          engine,
          bodyStyle: null,
          drivetrain: null,
          transmission: null,
          market: null,
          opfGpf: "unknown",
        });
      }
    }
  }
  return {
    version: 1,
    mode: applications.length ? "vehicle_specific" : "needs_review",
    scope: "auto",
    applications,
    parentSku: null,
    source: { supplier: "Eventuri Shopify export", sourceRef: product.slug, sourceUpdatedAt: null },
    note: applications.length
      ? "Imported from explicit Shopify Make/Carmodel and product copy; multi-value fields are normalized into separate applications."
      : "Missing explicit make/model fitment.",
  };
}

function categoryFor(product: AdminShopProductPayload): {
  key: CategoryKey;
  en: string;
  ua: string;
} {
  const corpus =
    `${product.titleUa} ${product.titleEn} ${product.productType ?? ""} ${product.slug}`.toLowerCase();
  if (/engine cover|кришк|крышк|plenum cover/.test(corpus))
    return { key: "engine-cover", en: "Engine Covers", ua: "Кришки двигуна" };
  if (/strut|brace|розпір|распорк/.test(corpus))
    return { key: "brace", en: "Strut Braces", ua: "Розпірки" };
  if (/charge|turbo inlet|inlet pipe|патруб|duct/.test(corpus))
    return { key: "turbo-pipes", en: "Turbo Inlets & Pipes", ua: "Турбоінлети та патрубки" };
  if (/filter|cleaning|accessor|фільтр|фильтр|scoop|seat back/.test(corpus))
    return { key: "filter-accessory", en: "Filters & Accessories", ua: "Фільтри та аксесуари" };
  return { key: "intake", en: "Intake Systems", ua: "Впускні системи" };
}

function optionName(value: string | null | undefined) {
  const normalized = text(value).toLowerCase();
  if (/оздоб|finish|отдел/.test(normalized)) return "Finish";
  if (/флан|flange/.test(normalized)) return "Flange";
  if (/turbo|турб/.test(normalized)) return "Turbo configuration";
  if (/верс|version|варіант|вариант/.test(normalized)) return "Version";
  return text(value);
}

function cleanTags(
  product: AdminShopProductPayload,
  category: ReturnType<typeof categoryFor>,
  fitment: SupplierFitmentContract
) {
  const applications = fitment.applications;
  return replaceStorefrontTag(
    Array.from(
      new Set(
        [
          "Eventuri",
          `category:${category.key}`,
          ...applications.flatMap((item) => [item.make, item.model, item.chassisCode, item.engine]),
        ].filter((item): item is string => Boolean(item))
      )
    ),
    "main"
  );
}

function adaptProduct(product: AdminShopProductPayload): AdminShopProductPayload {
  const category = categoryFor(product);
  const fitmentOverride = EVENTURI_FITMENT_OVERRIDES[product.slug];
  const fitment = fitmentOverride ?? buildFitment(product);
  const override = product.media.length === 0 ? EVENTURI_MEDIA_OVERRIDES[product.slug] : undefined;
  const media =
    override?.map((item, index) => ({
      src: item.src,
      altText: item.altText,
      position: index + 1,
      mediaType: "IMAGE" as const,
    })) ?? product.media;
  const sourceStatus = product.status;
  const sourcePublished = product.isPublished;
  const fitmentMetafield = {
    namespace: SUPPLIER_FITMENT_NAMESPACE,
    key: SUPPLIER_FITMENT_KEY,
    value: JSON.stringify(fitment),
    valueType: "json",
  };
  return {
    ...product,
    brand: "Eventuri",
    vendor: "Eventuri",
    storefront: "main",
    status: "DRAFT",
    isPublished: false,
    publishedAt: null,
    stock: "preOrder",
    productType: category.en,
    productCategory: category.en,
    categoryUa: category.ua,
    categoryEn: category.en,
    tags: cleanTags(product, category, fitment),
    options: product.options.map((option) => ({ ...option, name: optionName(option.name) })),
    titleUa: replaceLegacyStorefrontReference(product.titleUa) ?? product.titleUa,
    bodyHtmlUa: replaceLegacyStorefrontReference(product.bodyHtmlUa),
    longDescUa: replaceLegacyStorefrontReference(product.longDescUa),
    shortDescUa: replaceLegacyStorefrontReference(product.shortDescUa),
    seoTitleUa: replaceLegacyStorefrontReference(product.seoTitleUa),
    seoDescriptionUa: replaceLegacyStorefrontReference(product.seoDescriptionUa),
    image: product.image ?? media[0]?.src ?? null,
    gallery: media.map((item) => item.src),
    media,
    metafields: [
      ...product.metafields.filter(
        (item) =>
          !(item.namespace === SUPPLIER_FITMENT_NAMESPACE && item.key === SUPPLIER_FITMENT_KEY)
      ),
      fitmentMetafield,
      {
        namespace: "eventuri_import",
        key: "source_status",
        value: sourceStatus,
        valueType: "single_line_text_field",
      },
      {
        namespace: "eventuri_import",
        key: "source_published",
        value: String(sourcePublished),
        valueType: "boolean",
      },
    ],
  };
}

function fitmentOf(product: AdminShopProductPayload) {
  const value = product.metafields.find(
    (item) => item.namespace === SUPPLIER_FITMENT_NAMESPACE && item.key === SUPPLIER_FITMENT_KEY
  )?.value;
  return value ? (JSON.parse(value) as SupplierFitmentContract) : null;
}

function hasGoodTranslation(product: AdminShopProductPayload) {
  const cyrillic = /[А-Яа-яІіЇїЄє]/;
  return Boolean(
    product.titleEn &&
      product.bodyHtmlEn &&
      product.seoDescriptionEn &&
      // Some Shopify titles are already natural English. Equality is only a
      // translation failure when the source title actually contains Cyrillic.
      (!cyrillic.test(product.titleUa) || product.titleEn !== product.titleUa) &&
      !cyrillic.test(product.titleEn) &&
      !cyrillic.test(product.seoDescriptionEn)
  );
}

function approvalFailure(product: AdminShopProductPayload) {
  const sourceStatus = metafield(product, "eventuri_import", "source_status");
  const sourcePublished = metafield(product, "eventuri_import", "source_published") === "true";
  const fitment = fitmentOf(product);
  if (sourceStatus !== "ACTIVE" || !sourcePublished)
    return "source product is not active+published";
  const pricingStatus = metafield(product, "eventuri_import", "ind_pricing_status");
  if (pricingStatus === "matched_alias_review") return "IND pricing alias requires manual review";
  if (pricingStatus !== "matched") return "IND pricing is missing";
  if (!(product.priceUah && product.priceUah > 0)) return "price is missing or zero";
  if (!product.image) return "main image is missing";
  if (/^https:\/\/cdn\.shopify\.com\//i.test(product.image))
    return "media migration to Vercel Blob is pending";
  if (!hasGoodTranslation(product)) return "English translation is incomplete";
  if (!fitment || fitment.mode === "needs_review") return "fitment requires review";
  return null;
}

async function applyIndPricing(products: AdminShopProductPayload[], report: ImportReport) {
  const response = await fetch(
    "https://ind-distribution.com/collections/eventuri/products.json?limit=250"
  );
  if (!response.ok) throw new Error(`IND Distribution HTTP ${response.status}`);
  const payload = (await response.json()) as {
    products?: Array<{ variants?: Array<{ sku?: string; price?: string }> }>;
  };
  const indBySku = new Map<string, number>();
  for (const product of payload.products ?? []) {
    for (const variant of product.variants ?? []) {
      const sku = text(variant.sku).toUpperCase();
      const usd = Number(variant.price);
      if (sku && Number.isFinite(usd) && usd > 0) indBySku.set(sku, usd);
    }
  }
  const settings = await prisma.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  const rates = (settings?.currencyRates ?? {}) as Record<string, unknown>;
  const eurRate = Number(rates.EUR ?? 1) || 1;
  const usdRate = Number(rates.USD ?? 1.152174) || 1.152174;
  const uahRate = Number(rates.UAH ?? 53) || 53;
  const uahPerUsd = uahRate / usdRate;
  const markup = 1.1;
  let matchedVariants = 0;
  let missingVariants = 0;
  const csvDeltas: number[] = [];
  const aliasMatches: PricingAliasMatch[] = [];
  for (const product of products) {
    let productMissing = false;
    const productAliases: PricingAliasMatch[] = [];
    for (const variant of product.variants) {
      const sourceSku = text(variant.sku).toUpperCase();
      const alias = IND_SKU_ALIASES[sourceSku];
      const directIndUsd = indBySku.get(sourceSku);
      const indUsd = directIndUsd ?? (alias ? indBySku.get(alias.targetSku) : undefined);
      if (!indUsd) {
        productMissing = true;
        missingVariants += 1;
        // Never leave the Shopify CSV price on a variant that has no current
        // IND Distribution price. A stale variant price could still surface
        // on a PDP even when the product-level price is correctly hidden.
        variant.priceUsd = null;
        variant.priceUah = null;
        variant.priceEur = null;
        continue;
      }
      if (alias && !directIndUsd) {
        const aliasMatch: PricingAliasMatch = {
          productSlug: product.slug,
          sourceSku,
          indUsd,
          ...alias,
        };
        productAliases.push(aliasMatch);
        aliasMatches.push(aliasMatch);
      }
      const priceUsd = Number((indUsd * markup).toFixed(2));
      const priceUah = Number((priceUsd * uahPerUsd).toFixed(2));
      const priceEur = Number(((priceUsd / usdRate) * eurRate).toFixed(2));
      if (variant.priceUah && priceUah) csvDeltas.push((variant.priceUah / priceUah - 1) * 100);
      variant.priceUsd = priceUsd;
      variant.priceUah = priceUah;
      variant.priceEur = priceEur;
    }
    const primary = product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
    if (primary?.priceUsd && primary.priceUah && primary.priceEur) {
      product.priceUsd = primary.priceUsd;
      product.priceUah = primary.priceUah;
      product.priceEur = primary.priceEur;
    } else {
      product.priceUsd = null;
      product.priceUah = null;
      product.priceEur = null;
    }
    report.missingIndPricing.push(
      ...(productMissing
        ? [
            {
              slug: product.slug,
              sku: product.sku ?? null,
              reason: "One or more variants are absent from IND Distribution.",
            },
          ]
        : [])
    );
    const aliasNeedsReview = productAliases.some((item) => item.status === "review");
    const pricingStatus = productMissing
      ? "missing"
      : aliasNeedsReview
        ? "matched_alias_review"
        : "matched";
    product.metafields = [
      ...product.metafields.filter(
        (item) => !(item.namespace === "eventuri_import" && item.key.startsWith("ind_"))
      ),
      ...(productAliases.length
        ? [
            {
              namespace: "eventuri_import",
              key: "ind_pricing_alias",
              value: JSON.stringify(productAliases),
              valueType: "json",
            },
          ]
        : []),
      {
        namespace: "eventuri_import",
        key: "ind_pricing_status",
        value: pricingStatus,
        valueType: "single_line_text_field",
      },
      {
        namespace: "eventuri_import",
        key: "ind_price_markup_pct",
        value: "10",
        valueType: "number_integer",
      },
      {
        namespace: "eventuri_import",
        key: "ind_uah_per_usd",
        value: uahPerUsd.toFixed(6),
        valueType: "number_decimal",
      },
    ];
  }
  matchedVariants = products.reduce(
    (sum, product) => sum + product.variants.filter((variant) => Boolean(variant.priceUsd)).length,
    0
  );
  report.pricing = {
    markupPct: 10,
    uahPerUsd,
    matchedVariants,
    missingVariants,
    averageDeltaFromCsvPct: csvDeltas.length
      ? Number((csvDeltas.reduce((sum, value) => sum + value, 0) / csvDeltas.length).toFixed(2))
      : null,
    aliasMatches,
  };
}

async function translateProduct(product: AdminShopProductPayload) {
  const apiKey = text(
    process.env.OPS_GEMINI_API_KEY || process.env.SHOP_AI_API_KEY || process.env.GEMINI_API_KEY
  );
  if (!apiKey)
    throw new Error(
      "OPS_GEMINI_API_KEY, SHOP_AI_API_KEY, or GEMINI_API_KEY is required for commit-draft translation"
    );
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const input = JSON.stringify({
    title: product.titleUa,
    bodyHtml: product.bodyHtmlUa,
    seoTitle: product.seoTitleUa,
    seoDescription: product.seoDescriptionUa,
  });
  let translated: {
    title?: string;
    bodyHtml?: string;
    seoTitle?: string;
    seoDescription?: string;
  } | null = null;
  let lastError: unknown = null;
  for (const model of Array.from(
    new Set([TRANSLATION_PRIMARY_MODEL, TRANSLATION_FALLBACK_MODEL])
  )) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: `You are the catalog localization component for OneCompany, a premium automotive retailer.
Translate the supplied Eventuri product from Ukrainian or Russian into accurate, natural automotive English.
Preserve all HTML structure, brand and vehicle names, chassis/engine codes, SKU, measurements, power figures,
compatibility restrictions, and factual claims. Do not add marketing claims or compatibility facts.
Remove references that instruct customers to purchase on eventuri.shop; refer to OneCompany only when the
source already contains a retailer reference. Return all four fields. bodyHtml must remain valid HTML.

SOURCE:
${input}`,
          config: {
            // Keep individual requests bounded so one transient provider deadline
            // cannot stall the whole resumable import for many minutes.
            httpOptions: { timeout: 45_000 },
            temperature: 0.1,
            maxOutputTokens: 8_000,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              required: ["title", "bodyHtml", "seoTitle", "seoDescription"],
              properties: {
                title: { type: Type.STRING },
                bodyHtml: { type: Type.STRING },
                seoTitle: { type: Type.STRING },
                seoDescription: { type: Type.STRING },
              },
            },
          },
        });
        translated = JSON.parse(response.text ?? "") as typeof translated;
        if (translated?.title && translated.bodyHtml && translated.seoDescription) break;
        throw new Error("Gemini returned incomplete translation fields");
      } catch (error) {
        lastError = error;
        translated = null;
        if (attempt < 1) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
    if (translated) break;
  }
  if (!translated)
    throw new Error(
      `Eventuri translation failed on primary and fallback models: ${(lastError as Error)?.message ?? String(lastError)}`
    );
  product.titleEn = text(translated.title);
  product.bodyHtmlEn = text(translated.bodyHtml)
    ? sanitizeRichTextHtml(text(translated.bodyHtml))
    : null;
  product.longDescEn = product.bodyHtmlEn;
  product.shortDescEn = text(translated.seoDescription) || null;
  product.seoTitleEn = text(translated.seoTitle) || product.titleEn;
  product.seoDescriptionEn = text(translated.seoDescription) || null;
}

async function migrateMedia(
  products: AdminShopProductPayload[],
  report: ImportReport
): Promise<AdminShopProductPayload[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("BLOB_READ_WRITE_TOKEN is required for commit-draft media migration");
  const resolved = new Map<string, string>();
  const expectedSources = Array.from(
    new Set(
      products.flatMap((product) =>
        getExpectedEventuriMediaSources({
          primaryImage: product.image,
          mediaSources: product.media.map((item) => item.src),
          variantImages: product.variants.map((variant) => variant.image),
        })
      )
    )
  );

  for (const source of expectedSources) {
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType =
        response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
      const extension =
        path.extname(new URL(source).pathname) || (contentType === "image/webp" ? ".webp" : ".jpg");
      const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
      const blob = await put(`catalog/eventuri/${hash}${extension}`, buffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
      resolved.set(source, blob.url);
    } catch (error) {
      report.unavailableMedia.push({ url: source, error: (error as Error).message });
    }
  }

  const safeProducts: AdminShopProductPayload[] = [];
  for (const product of products) {
    const decision = decideEventuriMediaMigration(
      {
        primaryImage: product.image,
        mediaSources: product.media.map((item) => item.src),
        variantImages: product.variants.map((variant) => variant.image),
      },
      resolved
    );
    if (!decision.canPersist) {
      report.skipped.push({
        slug: product.slug,
        sku: product.sku ?? null,
        reason: decision.reason,
      });
      continue;
    }

    product.media = product.media.map((item) => ({ ...item, src: resolved.get(item.src)! }));
    product.gallery = product.media.map((item) => item.src);
    product.image = product.image ? resolved.get(product.image)! : null;
    product.variants = product.variants.map((variant) => ({
      ...variant,
      image: variant.image ? resolved.get(variant.image)! : product.image,
    }));
    safeProducts.push(product);
  }

  return safeProducts;
}

async function validateRemoteMedia(products: AdminShopProductPayload[], report: ImportReport) {
  const urls = Array.from(
    new Set(products.flatMap((product) => product.media.map((item) => item.src)))
  );
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(16, urls.length) }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await fetch(url, {
              method: "HEAD",
              signal: AbortSignal.timeout(15_000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2)
              await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          }
        }
        if (lastError) {
          report.unavailableMedia.push({ url, error: (lastError as Error).message });
        }
      }
    })
  );
}

function buildReport(
  mode: Mode,
  source: string,
  products: AdminShopProductPayload[],
  totalRows: number,
  variantsCount: number
): ImportReport {
  const report: ImportReport = {
    mode,
    source,
    generatedAt: new Date().toISOString(),
    counts: {
      rows: totalRows,
      products: products.length,
      variants: variantsCount,
      media: new Set(products.flatMap((item) => item.media.map((media) => media.src))).size,
    },
    duplicateSkus: [],
    zeroPrices: [],
    missingImages: [],
    incompleteFitment: [],
    translationIssues: [],
    unavailableMedia: [],
    missingIndPricing: [],
    pricing: {
      markupPct: 10,
      uahPerUsd: 0,
      matchedVariants: 0,
      missingVariants: 0,
      averageDeltaFromCsvPct: null,
      aliasMatches: [],
    },
    created: [],
    updated: [],
    published: [],
    skipped: [],
  };
  const skuMap = new Map<string, string[]>();
  for (const product of products) {
    for (const sku of new Set(product.variants.map((item) => text(item.sku)).filter(Boolean)))
      skuMap.set(sku, [...(skuMap.get(sku) ?? []), product.slug]);
    if (!(product.priceUah && product.priceUah > 0))
      report.zeroPrices.push({
        slug: product.slug,
        sku: product.sku ?? null,
        reason: "price is missing or zero",
      });
    if (!product.image)
      report.missingImages.push({
        slug: product.slug,
        sku: product.sku ?? null,
        reason: "main image is missing",
      });
    if (fitmentOf(product)?.mode === "needs_review")
      report.incompleteFitment.push({
        slug: product.slug,
        sku: product.sku ?? null,
        reason: "explicit make/model could not be resolved",
      });
    if (!hasGoodTranslation(product))
      report.translationIssues.push({
        slug: product.slug,
        sku: product.sku ?? null,
        reason: "English translation pending",
      });
  }
  report.duplicateSkus = [...skuMap]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([sku, slugs]) => ({ sku, slugs }));
  return report;
}

async function repairPersistedFitment(
  products: AdminShopProductPayload[],
  source: string,
  outputDir: string
) {
  const slugs = products.map((product) => product.slug);
  const existing = await prisma.shopProduct.findMany({
    where: { brand: "Eventuri", slug: { in: slugs } },
    select: { id: true, slug: true, status: true, isPublished: true },
  });
  const bySlug = new Map(existing.map((product) => [product.slug, product]));
  const updated: Array<{
    slug: string;
    applications: number;
    status: string;
    isPublished: boolean;
  }> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];
  await prisma.$transaction(
    async (tx) => {
      for (const product of products) {
        const persisted = bySlug.get(product.slug);
        if (!persisted) {
          skipped.push({ slug: product.slug, reason: "Eventuri product is not persisted" });
          continue;
        }
        const supplierValue = product.metafields.find(
          (item) =>
            item.namespace === SUPPLIER_FITMENT_NAMESPACE && item.key === SUPPLIER_FITMENT_KEY
        );
        if (!supplierValue) {
          skipped.push({ slug: product.slug, reason: "normalized supplier fitment is empty" });
          continue;
        }
        await tx.shopProductMetafield.upsert({
          where: {
            productId_namespace_key: {
              productId: persisted.id,
              namespace: SUPPLIER_FITMENT_NAMESPACE,
              key: SUPPLIER_FITMENT_KEY,
            },
          },
          create: {
            productId: persisted.id,
            namespace: SUPPLIER_FITMENT_NAMESPACE,
            key: SUPPLIER_FITMENT_KEY,
            value: supplierValue.value,
            valueType: "json",
          },
          update: { value: supplierValue.value, valueType: "json" },
        });
        // Keep vehicle tags aligned with the same canonical applications. This
        // improves lexical search without touching publication, pricing, media,
        // translations or manually reviewed fitment fields.
        await tx.shopProduct.update({ where: { id: persisted.id }, data: { tags: product.tags } });
        const fitment = fitmentOf(product);
        updated.push({
          slug: product.slug,
          applications: fitment?.applications.length ?? 0,
          status: persisted.status,
          isPublished: persisted.isPublished,
        });
      }
    },
    { timeout: 120_000 }
  );
  const report = {
    mode: "repair-fitment",
    generatedAt: new Date().toISOString(),
    source,
    productsScanned: products.length,
    persistedEventuriProducts: existing.length,
    updated: updated.length,
    skipped,
    applications: updated.reduce((sum, item) => sum + item.applications, 0),
    publicationPreserved: updated.every(
      (item) => item.status === "ACTIVE" || item.status === "DRAFT"
    ),
    updatedProducts: updated,
  };
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(
    outputDir,
    `repair-fitment-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        reportPath,
        updated: updated.length,
        skipped: skipped.length,
        applications: report.applications,
      },
      null,
      2
    )
  );
}

async function main() {
  const mode = parseMode();
  const skipMedia = process.argv.includes("--skip-media");
  const source = path.resolve(argValue("--source") ?? DEFAULT_SOURCE);
  const outputDir = path.resolve(argValue("--output") ?? "artifacts/eventuri-import");
  const translationCachePath = path.join(outputDir, "eventuri-translations-cache.json");
  const parsed = buildProductsFromShopifyCsv(await readFile(source, "utf8"));
  if (parsed.errors.length)
    throw new Error(`CSV parse failed: ${JSON.stringify(parsed.errors.slice(0, 10))}`);
  const products = parsed.products.map(adaptProduct);
  const uniqueSlugs = new Set(products.map((product) => product.slug));
  if (uniqueSlugs.size !== products.length || uniqueSlugs.has("")) {
    throw new Error(
      `Eventuri slugs must be non-empty and unique (${uniqueSlugs.size}/${products.length})`
    );
  }
  if (mode === "repair-fitment") {
    await repairPersistedFitment(products, source, outputDir);
    return;
  }
  let report = buildReport(mode, source, products, parsed.totalRows, parsed.variantsCount);
  await applyIndPricing(products, report);
  const pricing = report.pricing;
  const missingIndPricing = report.missingIndPricing;
  report = buildReport(mode, source, products, parsed.totalRows, parsed.variantsCount);
  report.pricing = pricing;
  report.missingIndPricing = missingIndPricing;

  if (mode === "dry-run") await validateRemoteMedia(products, report);

  if (mode === "preview-one") {
    const requestedHandle = text(argValue("--handle"));
    const product = requestedHandle
      ? products.find((item) => item.slug === requestedHandle)
      : products.find(
          (item) =>
            item.priceUah &&
            item.priceUah > 0 &&
            item.image &&
            fitmentOf(item)?.mode === "vehicle_specific"
        );
    if (!product)
      throw new Error(
        `Preview product ${requestedHandle || "(automatic selection)"} was not found`
      );
    const before = {
      slug: product.slug,
      titleUa: product.titleUa,
      bodyHtmlUa: product.bodyHtmlUa,
      seoTitleUa: product.seoTitleUa,
      seoDescriptionUa: product.seoDescriptionUa,
      sourceType: metafield(product, "eventuri_import", "source_status"),
    };
    await translateProduct(product);
    await validateRemoteMedia([product], report);
    const preview = {
      generatedAt: new Date().toISOString(),
      models: { primary: TRANSLATION_PRIMARY_MODEL, fallback: TRANSLATION_FALLBACK_MODEL },
      before,
      after: {
        slug: product.slug,
        brand: product.brand,
        storefront: product.storefront,
        status: product.status,
        stock: product.stock,
        categoryUa: product.categoryUa,
        categoryEn: product.categoryEn,
        titleEn: product.titleEn,
        bodyHtmlEn: product.bodyHtmlEn,
        seoTitleEn: product.seoTitleEn,
        seoDescriptionEn: product.seoDescriptionEn,
        priceUah: product.priceUah,
        tags: product.tags,
        options: product.options,
        variants: product.variants,
        fitment: fitmentOf(product),
        media: product.media,
        publicationGate: approvalFailure(product),
        pricingSource:
          "IND Distribution USD + 10% markup, converted with current OneCompany UAH/USD rate",
      },
      unavailableMedia: report.unavailableMedia,
    };
    await mkdir(outputDir, { recursive: true });
    const previewPath = path.join(outputDir, `preview-${product.slug}.json`);
    await writeFile(previewPath, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify(
        {
          previewPath,
          slug: product.slug,
          titleUa: product.titleUa,
          titleEn: product.titleEn,
          category: product.categoryEn,
          priceUah: product.priceUah,
          fitment: fitmentOf(product),
          mediaCount: product.media.length,
          unavailableMedia: report.unavailableMedia.length,
          publicationGate: approvalFailure(product),
        },
        null,
        2
      )
    );
    return;
  }

  if (mode === "commit-draft") {
    await mkdir(outputDir, { recursive: true });
    let translationCache: Record<string, TranslationCacheEntry> = {};
    try {
      translationCache = JSON.parse(await readFile(translationCachePath, "utf8")) as Record<
        string,
        TranslationCacheEntry
      >;
    } catch {
      translationCache = {};
    }
    for (const [index, product] of products.entries()) {
      const cached = translationCache[product.slug];
      if (cached?.titleEn && cached.bodyHtmlEn && cached.seoDescriptionEn) {
        product.titleEn = cached.titleEn;
        product.bodyHtmlEn = cached.bodyHtmlEn;
        product.longDescEn = cached.longDescEn;
        product.shortDescEn = cached.shortDescEn;
        product.seoTitleEn = cached.seoTitleEn;
        product.seoDescriptionEn = cached.seoDescriptionEn;
        console.log(`translation ${index + 1}/${products.length} ${product.slug} (cache)`);
      } else {
        await translateProduct(product);
        translationCache[product.slug] = {
          titleEn: product.titleEn,
          bodyHtmlEn: product.bodyHtmlEn,
          longDescEn: product.longDescEn,
          shortDescEn: product.shortDescEn,
          seoTitleEn: product.seoTitleEn,
          seoDescriptionEn: product.seoDescriptionEn,
        };
        await writeFile(
          translationCachePath,
          `${JSON.stringify(translationCache, null, 2)}\n`,
          "utf8"
        );
        console.log(`translation ${index + 1}/${products.length} ${product.slug}`);
      }
    }
    let productsToPersist = products;
    if (!skipMedia) {
      productsToPersist = await migrateMedia(products, report);
    } else {
      // A resumable pricing-only rerun can retain the Blob URLs already
      // attached to draft records instead of re-downloading/re-uploading the
      // full gallery. This is intentionally opt-in for repair runs.
      for (const product of products) {
        const existing = await prisma.shopProduct.findUnique({
          where: { slug: product.slug },
          select: {
            image: true,
            media: {
              orderBy: { position: "asc" },
              select: { src: true, altText: true, position: true, mediaType: true },
            },
            variants: { select: { sku: true, position: true, image: true } },
          },
        });
        if (!existing)
          throw new Error(`Cannot skip media for missing draft product ${product.slug}`);
        product.image = existing.image;
        product.media = existing.media.map((item) => ({ ...item }));
        product.gallery = existing.media.map((item) => item.src);
        product.variants = product.variants.map((variant) => {
          const persisted = existing.variants.find(
            (item) => item.sku === variant.sku && item.position === variant.position
          );
          return { ...variant, image: persisted?.image ?? product.image };
        });
      }
    }
    for (const product of productsToPersist) {
      const existing = await prisma.shopProduct.findUnique({
        where: { slug: product.slug },
        select: adminProductImportMergeSelect,
      });
      if (existing) {
        await prisma.shopProduct.update({
          where: { slug: product.slug },
          data: buildAdminProductSnapshotMergeUpdateData(product, existing),
        });
        report.updated.push(product.slug);
      } else {
        await prisma.shopProduct.create({ data: buildAdminProductCreateData(product) });
        report.created.push(product.slug);
      }
    }
  }

  if (mode === "publish-approved") {
    for (const sourceProduct of products) {
      const existing = await prisma.shopProduct.findUnique({
        where: { slug: sourceProduct.slug },
        include: { media: true, metafields: true },
      });
      if (!existing) {
        report.skipped.push({
          slug: sourceProduct.slug,
          sku: sourceProduct.sku ?? null,
          reason: "draft import not found",
        });
        continue;
      }
      const candidate = {
        ...sourceProduct,
        titleEn: existing.titleEn,
        bodyHtmlEn: existing.bodyHtmlEn,
        seoDescriptionEn: existing.seoDescriptionEn,
        image: existing.image,
        priceUah: existing.priceUah ? Number(existing.priceUah) : null,
        metafields: existing.metafields,
      } as AdminShopProductPayload;
      const failure = approvalFailure(candidate);
      if (failure) {
        report.skipped.push({
          slug: sourceProduct.slug,
          sku: sourceProduct.sku ?? null,
          reason: failure,
        });
        continue;
      }
      await prisma.shopProduct.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", isPublished: true, publishedAt: new Date(), stock: "preOrder" },
      });
      report.published.push(sourceProduct.slug);
    }
  }

  if (mode === "commit-draft") {
    // Recompute quality findings after the translation and media passes. The
    // initial report is useful for dry-run planning, but a commit report must
    // describe the persisted draft payload.
    const persistedReport = buildReport(
      mode,
      source,
      products,
      parsed.totalRows,
      parsed.variantsCount
    );
    persistedReport.pricing = report.pricing;
    persistedReport.missingIndPricing = report.missingIndPricing;
    persistedReport.unavailableMedia = report.unavailableMedia;
    persistedReport.created = report.created;
    persistedReport.updated = report.updated;
    persistedReport.published = report.published;
    persistedReport.skipped = report.skipped;
    report = persistedReport;
  }

  report.counts.created = report.created.length;
  report.counts.updated = report.updated.length;
  report.counts.published = report.published.length;
  report.counts.skipped = report.skipped.length;
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(
    outputDir,
    `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        reportPath,
        counts: report.counts,
        pricing: report.pricing,
        quality: {
          duplicateSkus: report.duplicateSkus.length,
          zeroPrices: report.zeroPrices.length,
          missingImages: report.missingImages.length,
          incompleteFitment: report.incompleteFitment.length,
          translationIssues: report.translationIssues.length,
          missingIndPricing: report.missingIndPricing.length,
          unavailableMedia: report.unavailableMedia.length,
        },
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
