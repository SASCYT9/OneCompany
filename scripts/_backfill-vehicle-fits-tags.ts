/**
 * Back-fill `fits-make:`, `fits-model:`, `fits-trim:`, `fits-year:` tags
 * on ShopProduct rows so the /shop/stock B2B-portal vehicle filter
 * returns results for every brand, not only REMUS.
 *
 * Usage:
 *   npx tsx scripts/_backfill-vehicle-fits-tags.ts --dry-run                  # all brands, no writes
 *   npx tsx scripts/_backfill-vehicle-fits-tags.ts --dry-run --brand=RaceChip # one brand
 *   npx tsx scripts/_backfill-vehicle-fits-tags.ts --brand=RaceChip           # apply
 *   npx tsx scripts/_backfill-vehicle-fits-tags.ts --brand=RaceChip --limit=20
 *
 * Each brand has its own extractor (function ShopProduct → VehicleFitment[]).
 * Extractors reuse the catalog libs the public brand-store filters already
 * use (akrapovicFilterUtils, ohlinsCatalog, csfCatalog, etc.).
 *
 * Safety:
 *   - Non-fits tags preserved (car_make:, chassis:, store:, audience: stay).
 *   - Idempotent — re-run skips rows whose fits-* already match.
 *   - Batches of 50 (pgbouncer-friendly).
 *   - Per-brand `--brand=` gate so user can apply one at a time.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  buildFitsTagSet,
  mergeFitsTagsIntoExisting,
  slugify,
  type VehicleFitment,
} from "./_lib/backfillFitsTags";

// ─── Args ────────────────────────────────────────────────────────────────

type Args = {
  dryRun: boolean;
  brandFilter: string | null;
  limit: number;
};

function parseArgs(): Args {
  const out: Args = { dryRun: false, brandFilter: null, limit: 0 };
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--brand=")) out.brandFilter = a.slice("--brand=".length);
    else if (a.startsWith("--limit=")) out.limit = parseInt(a.slice("--limit=".length), 10) || 0;
  }
  return out;
}

// ─── Product shape (minimal — just what extractors need) ────────────────

type Product = {
  id: string;
  brand: string | null;
  vendor: string | null;
  sku: string | null;
  titleEn: string | null;
  titleUa: string | null;
  categoryEn: string | null;
  categoryUa: string | null;
  tags: string[];
};

type Extractor = (p: Product) => VehicleFitment[];

// ─── Per-brand extractors ────────────────────────────────────────────────
//
// Each extractor returns one or more VehicleFitment objects for a single
// product. Multiple fitments are normal — a tail pipe might fit BMW M3,
// M4, AND M5; emit one entry per (make, model, trim) tuple.

/** RaceChip: parse existing `car_make:` + `car_model:` tags. */
function extractRacechip(p: Product): VehicleFitment[] {
  const out: VehicleFitment[] = [];
  const carMakeTag = p.tags.find((t) => t.startsWith("car_make:"));
  if (!carMakeTag) return out;
  const make = carMakeTag.slice("car_make:".length).trim().toLowerCase();
  if (!make) return out;

  const carModelTag = p.tags.find((t) => t.startsWith("car_model:"));
  if (!carModelTag) {
    out.push({ make });
    return out;
  }
  const rawModel = carModelTag.slice("car_model:".length).trim();
  if (!rawModel) {
    out.push({ make });
    return out;
  }

  // parseRacechipModelSlug splits "1-series-f20-21-2010-to-2019" into
  // modelKey "1-series" + chassisKey "f20-21-2010-to-2019". We want the
  // chassis without years.
  // Lazy import to avoid loading heavy code unless this brand runs.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseRacechipModelSlug } = require("../src/lib/racechipFormat");
  const parts = parseRacechipModelSlug(rawModel, make);
  const modelKey = parts.modelKey || rawModel;
  // Strip year tokens from chassisKey for the trim tag.
  const chassisRaw: string = parts.chassisKey || "";
  const chassisNoYear = chassisRaw
    .replace(/-?from-\d{4}/g, "")
    .replace(/-?\d{4}-to-\d{4}/g, "")
    .replace(/^-|-$/g, "");

  out.push({
    make,
    model: modelKey,
    trim: chassisNoYear || null,
  });
  return out;
}

/** GiroDisc: `car_make:` only — no usable model tags. */
function extractGiroDisc(p: Product): VehicleFitment[] {
  const carMakeTag = p.tags.find((t) => t.startsWith("car_make:"));
  if (!carMakeTag) return [];
  const make = carMakeTag.slice("car_make:".length).trim().toLowerCase();
  if (!make) return [];
  return [{ make }];
}

/** Akrapovic: regex on title via akrapovicFilterUtils. */
function extractAkrapovic(p: Product): VehicleFitment[] {
  const title = p.titleEn || p.titleUa || "";
  if (!title.trim()) return [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const utils = require("../src/lib/akrapovicFilterUtils");
  const extractBrand: (t: string) => string | null = utils.extractVehicleBrand;
  const extractModels: (t: string, b: string) => string[] = utils.extractVehicleModelsForBrand;
  const extractChassis: (t: string) => string = utils.extractVehicleModel;
  if (typeof extractBrand !== "function" || typeof extractModels !== "function") return [];
  const brand = extractBrand(title);
  if (!brand) return [];
  const models = extractModels(title, brand);
  const chassis = typeof extractChassis === "function" ? extractChassis(title) : "";
  const out: VehicleFitment[] = [];
  if (models.length === 0) {
    out.push({ make: brand });
    return out;
  }
  for (const model of models) {
    out.push({
      make: brand,
      model,
      // Skip "Other" chassis (akrapovicFilterUtils returns "Other" when no match).
      trim: chassis && chassis !== "Other" ? chassis : null,
    });
  }
  return out;
}

/** CSF: extractCsfCatalogFitment. */
function extractCsf(p: Product): VehicleFitment[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require("../src/lib/csfCatalog");
  const fn = lib.extractCsfCatalogFitment;
  if (typeof fn !== "function") return [];
  // CSF helper expects a ShopProduct-shaped object. Wrap minimal shape.
  const shopShaped = {
    title: { en: p.titleEn ?? "", ua: p.titleUa ?? "" },
    category: { en: p.categoryEn ?? "", ua: p.categoryUa ?? "" },
    sku: p.sku,
    tags: p.tags,
  };
  const result = fn(shopShaped) as
    | {
        make?: string | null;
        models?: string[];
        chassisCodes?: string[];
        yearStart?: number | null;
      }
    | null
    | undefined;
  if (!result || !result.make) return [];
  const make = String(result.make).toLowerCase();
  const out: VehicleFitment[] = [];
  const models = result.models?.length ? result.models : [null];
  const chassis = result.chassisCodes?.length ? result.chassisCodes : [null];
  for (const model of models) {
    for (const c of chassis) {
      out.push({
        make,
        model: model ?? null,
        trim: c ?? null,
        year: result.yearStart ?? null,
      });
    }
  }
  return out;
}

/** ADRO: enrichAdroCatalogProduct returns enriched + makes + models. */
function extractAdro(p: Product): VehicleFitment[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require("../src/lib/adroCatalog");
  const fn = lib.enrichAdroCatalogProduct;
  if (typeof fn !== "function") return [];
  const shopShaped = {
    title: { en: p.titleEn ?? "", ua: p.titleUa ?? "" },
    category: { en: p.categoryEn ?? "", ua: p.categoryUa ?? "" },
    sku: p.sku,
    tags: p.tags,
  };
  const enriched = fn(shopShaped) as { makes?: string[]; models?: string[] } | null | undefined;
  if (!enriched) return [];
  const makes = (enriched.makes ?? []).filter(Boolean);
  const models = (enriched.models ?? []).filter(Boolean);
  if (makes.length === 0) return [];
  const out: VehicleFitment[] = [];
  for (const make of makes) {
    if (models.length === 0) {
      out.push({ make });
    } else {
      for (const model of models) {
        out.push({ make, model });
      }
    }
  }
  return out;
}

/** iPE: resolveIpeVehicleBrand + resolveIpeVehicleModel. */
function extractIpe(p: Product): VehicleFitment[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require("../src/lib/ipeCatalog");
  const resolveBrand = lib.resolveIpeVehicleBrand;
  const resolveModel = lib.resolveIpeVehicleModel;
  if (typeof resolveBrand !== "function") return [];
  // iPE helpers expect {tags, title, collection} ShopProduct shape.
  const shaped = {
    tags: p.tags,
    title: { en: p.titleEn ?? "", ua: p.titleUa ?? "" },
    collection: { en: p.categoryEn ?? "", ua: p.categoryUa ?? "" },
  };
  const brand = resolveBrand(shaped);
  if (!brand) return [];
  // resolveIpeVehicleBrand may return either a string or {label,...}.
  const brandStr =
    typeof brand === "string" ? brand : brand.label || brand.name || brand.value || "";
  if (!brandStr) return [];
  const model = typeof resolveModel === "function" ? resolveModel(shaped) : null;
  const modelStr = model
    ? typeof model === "string"
      ? model
      : model.label || model.name || model.value || ""
    : "";
  return [{ make: brandStr, model: modelStr || null }];
}

/** Burger: predominantly BMW — only emit fits-* when we have a CONFIRMED
 *  BMW chassis. Burger occasionally sells products for Dodge / VW / etc.;
 *  those rows return [] so we don't pollute BMW filter with non-BMW items.
 *
 *  Known BMW-model names (without chassis suffix) are also allow-listed.
 */
function extractBurger(p: Product): VehicleFitment[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const map = require("../src/lib/burgerChassisMap");
  const lookup: (raw: string) => string | null = map.burgerChassisToBmwModel;
  if (typeof lookup !== "function") return [];

  const BMW_MODEL_ALLOWLIST = new Set([
    "1-series",
    "2-series",
    "3-series",
    "4-series",
    "5-series",
    "6-series",
    "7-series",
    "8-series",
    "m2",
    "m3",
    "m4",
    "m5",
    "m6",
    "m8",
    "x1",
    "x2",
    "x3",
    "x4",
    "x5",
    "x6",
    "x7",
    "x5-m",
    "x6-m",
    "z4",
  ]);

  const chassisTags = p.tags
    .filter((t) => t.startsWith("chassis:"))
    .map((t) => t.slice("chassis:".length).trim());

  const out: VehicleFitment[] = [];
  const seen = new Set<string>();
  for (const c of chassisTags) {
    const model = lookup(c);
    if (model) {
      const key = `${model}:${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ make: "BMW", model, trim: c });
    }
  }
  // Fallback when chassis tags missing but model tag is a known BMW series.
  if (out.length === 0) {
    const modelTags = p.tags
      .filter((t) => t.startsWith("model:"))
      .map((t) => t.slice("model:".length).trim())
      .filter((m) => BMW_MODEL_ALLOWLIST.has(m.toLowerCase()));
    for (const m of modelTags) {
      const key = `model:${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ make: "BMW", model: m });
    }
  }
  // Title check: if no confirmed BMW signal AND title mentions a non-BMW
  // brand (Dodge, VW, Mercedes), skip — that row isn't a BMW fitment.
  return out;
}

/** DO88: parse `categoryEn` like "Vehicle Specific > Volvo > 240, (1975-1993)". */
function extractDo88(p: Product): VehicleFitment[] {
  const cat = p.categoryEn ?? "";
  // Top-level signal: categoryEn must start with "Vehicle Specific" — otherwise
  // it's a generic part (hoses, couplers) that fits anything.
  if (!/^vehicle specific\b/i.test(cat)) return [];
  const segments = cat
    .split(/\s*>\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Expect: ["Vehicle Specific", "<Make>", "<Model>, (years)"]
  if (segments.length < 2) return [];
  const makeRaw = segments[1];
  if (!makeRaw || /^(general|universal)$/i.test(makeRaw)) return [];
  const out: VehicleFitment[] = [];
  if (segments[2]) {
    // Strip ", (years)" tail.
    const modelRaw = segments[2].replace(/,?\s*\([^)]*\)\s*$/, "").trim();
    if (modelRaw) out.push({ make: makeRaw, model: modelRaw });
    else out.push({ make: makeRaw });
  } else {
    out.push({ make: makeRaw });
  }
  return out;
}

/** Ilmberger: motorbike titles like "BMW S 1000 RR from MY 2019". */
function extractIlmberger(p: Product): VehicleFitment[] {
  const title = `${p.titleEn ?? ""} ${p.categoryEn ?? ""}`;
  // Recognised motorbike-brand prefixes (Ilmberger is bike-only).
  const BIKE_PATTERNS: Array<{ re: RegExp; make: string }> = [
    { re: /\bBMW\b/i, make: "BMW" },
    { re: /\bDucati\b/i, make: "Ducati" },
    { re: /\bAprilia\b/i, make: "Aprilia" },
    { re: /\bYamaha\b/i, make: "Yamaha" },
    { re: /\bHonda\b/i, make: "Honda" },
    { re: /\bKawasaki\b/i, make: "Kawasaki" },
    { re: /\bMV Agusta\b/i, make: "MV Agusta" },
    { re: /\bKTM\b/i, make: "KTM" },
  ];
  let make: string | null = null;
  for (const { re, make: m } of BIKE_PATTERNS) {
    if (re.test(title)) {
      make = m;
      break;
    }
  }
  if (!make) return [];

  // Try to pull model up to the year token ("S 1000 RR (MY 2019)" → "S 1000 RR").
  // Strip the make prefix first, then grab everything until "(", "from", or "MY".
  const afterMake = title
    .replace(new RegExp(`.*?${make}\\s+`, "i"), "")
    .split(/\s*\(|\s+from\s+MY|\s+MY\s+/i)[0]
    ?.trim();
  if (!afterMake) return [{ make }];
  // Model bounded — first 3 tokens at most (e.g. "S 1000 RR", "Panigale V4", "M 1000 RR").
  const tokens = afterMake.split(/\s+/).slice(0, 4).filter(Boolean);
  const model = tokens.join(" ");
  if (!model) return [{ make }];

  // Year hint
  const yearM = title.match(/\bMY\s+(20\d{2})\b/i);
  return [
    {
      make,
      model,
      year: yearM ? parseInt(yearM[1], 10) : null,
    },
  ];
}

/** Urban Automotive: products stored with brand=<car make> (Range Rover, etc.). */
function extractUrbanMisbranded(p: Product): VehicleFitment[] {
  const brand = p.brand?.trim();
  if (!brand) return [];
  // Only handle when slug looks like Urban (urb-*).
  if (!p.sku?.startsWith("urb-") && !p.sku?.startsWith("URB-")) {
    // Fall back: rely on slug field from caller — but we don't have it.
    // Skip strict.
    return [];
  }
  const make = brand; // brand IS the car make in this mis-stored shape
  const title = p.titleEn ?? "";
  // Try to pull model from title — e.g. "Defender L663", "Cullinan Series 2".
  // Heuristic: word after "for <Make>" or after the make name.
  const afterMake = title
    .replace(new RegExp(`.*${make}\\s+`, "i"), "")
    .split(/\s+with\s+|\s+\(|,\s+/i)[0]
    ?.trim();
  if (!afterMake) return [{ make }];
  const tokens = afterMake.split(/\s+/).slice(0, 3).filter(Boolean);
  const model = tokens.join(" ");
  return [{ make, model: model || null }];
}

/** Brabus: Mercedes-only — chassis codes in tags + title (W 177, X 247 etc.). */
function extractBrabus(p: Product): VehicleFitment[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const map = require("../src/lib/brabusChassisMap");
  const toModel: (raw: string | null | undefined) => string | null = map.brabusChassisToModel;
  const normalize: (raw: string) => string = map.normalizeChassis;

  // Scan tags for chassis-looking codes (W 177, X247, etc.).
  const candidates = new Set<string>();
  for (const t of p.tags) {
    if (/^[A-Z]\s?\d{3}[A-Z]?$/.test(t)) candidates.add(normalize(t));
  }
  // Also scan title for dashed chassis: "for Mercedes – W 177 – AMG A 45".
  const title = `${p.titleEn ?? ""} ${p.titleUa ?? ""}`;
  for (const m of title.matchAll(/[–—\-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—\-]/g)) {
    candidates.add(normalize(m[1]));
  }

  const models = new Set<string>();
  for (const c of candidates) {
    const model = toModel(c);
    if (model) models.add(model);
  }
  if (models.size === 0) {
    // Brabus is Mercedes-only — emit at least the make so it shows in
    // brand+make filter (better than nothing).
    return /\bsmart\b/i.test(title) ? [{ make: "Smart" }] : [{ make: "Mercedes-Benz" }];
  }
  return [...models].map((model) => {
    // Pick the matched chassis code as trim (use first that maps to this model).
    const trim = [...candidates].find((c) => toModel(c) === model) ?? null;
    return { make: "Mercedes-Benz", model, trim };
  });
}

/** Ohlins: use detectOhlinsMake + chassis-paren regex + chassis->model map. */
function extractOhlins(p: Product): VehicleFitment[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require("../src/lib/ohlinsCatalog");
  const detect: (prod: { slug: string; title: { en: string; ua: string } }) => string | null =
    lib.detectOhlinsMake;
  const chassisMap: Record<string, Record<string, string>> = lib.OHLINS_CHASSIS_TO_MODEL ?? {};
  if (typeof detect !== "function") return [];
  // Wrap minimal shape — ohlins detector reads .slug and .title.
  const shaped = {
    slug: p.sku ? `ohlins-${p.sku.toLowerCase()}` : "ohlins-",
    title: { en: p.titleEn ?? "", ua: p.titleUa ?? "" },
  };
  const make = detect(shaped);
  if (!make || make === "Universal" || make === "Volkswagen/Audi") {
    return make ? [{ make }] : [];
  }
  // Extract chassis from parens in title.
  const title = `${p.titleEn ?? ""} ${p.titleUa ?? ""}`;
  const chassisCodes: string[] = [];
  for (const m of title.matchAll(/\(([^)]+)\)/g)) {
    const inner = m[1].trim();
    if (/^\d{4}[-–]\d{4}$/.test(inner)) continue;
    if (/^\d{4}$/.test(inner)) continue;
    if (/^(Titanium|Stainless|Carbon|Gloss|Matte|ECE|OPF|GPF|without)/i.test(inner)) continue;
    // Split on / for "F30/F32"-style multi.
    for (const part of inner.split(/[\/,]/)) {
      const code = part.trim();
      if (/^[A-Z]?\d{2,4}[A-Z]?$/i.test(code)) chassisCodes.push(code.toUpperCase());
    }
  }
  const models = new Set<string>();
  const trimsPerModel = new Map<string, Set<string>>();
  const makeMap = chassisMap[make] ?? {};
  for (const c of chassisCodes) {
    const model = makeMap[c];
    if (model) {
      models.add(model);
      if (!trimsPerModel.has(model)) trimsPerModel.set(model, new Set());
      trimsPerModel.get(model)!.add(c);
    }
  }
  if (models.size === 0) return [{ make }];
  const out: VehicleFitment[] = [];
  for (const model of models) {
    const trims = trimsPerModel.get(model) ?? new Set<string>();
    if (trims.size === 0) out.push({ make, model });
    else for (const t of trims) out.push({ make, model, trim: t });
  }
  return out;
}

// Placeholder for brands implemented in later phases.
function notImplemented(_p: Product): VehicleFitment[] {
  return [];
}

// ─── Dispatch table ──────────────────────────────────────────────────────

const EXTRACTORS: Record<string, Extractor> = {
  racechip: extractRacechip,
  girodisc: extractGiroDisc,
  akrapovic: extractAkrapovic,
  csf: extractCsf,
  adro: extractAdro,
  ohlins: extractOhlins,
  brabus: extractBrabus,
  "burger motorsports": extractBurger,
  "ipe exhaust": extractIpe,
  do88: extractDo88,
  "ilmberger carbon": extractIlmberger,
  "urban automotive": extractUrbanMisbranded,
  // Mis-stored Urban-style sub-brands (importer set brand to car make).
  "range rover": extractUrbanMisbranded,
  "land rover": extractUrbanMisbranded,
  "mercedes-benz": extractUrbanMisbranded,
  audi: extractUrbanMisbranded,
  lamborghini: extractUrbanMisbranded,
  volkswagen: extractUrbanMisbranded,
  bentley: extractUrbanMisbranded,
  "rolls-royce": extractUrbanMisbranded,
};

// Normalize brand string from DB to dispatch key.
function brandKey(brand: string | null | undefined): string {
  return String(brand ?? "")
    .trim()
    .toLowerCase();
}

// ─── Runner ──────────────────────────────────────────────────────────────

(async () => {
  const args = parseArgs();
  const { prisma } = await import("../src/lib/prisma");

  // Brands to process.
  const allBrands = await prisma.shopProduct.findMany({
    where: { isPublished: true, status: "ACTIVE", brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  });
  const distinctBrands = [...new Set(allBrands.map((r) => r.brand!))];
  const brandsToProcess = args.brandFilter
    ? distinctBrands.filter((b) => b.toLowerCase() === args.brandFilter!.toLowerCase())
    : distinctBrands;

  if (brandsToProcess.length === 0) {
    console.log(`No brand matched "${args.brandFilter}". Available:`, distinctBrands.join(", "));
    await prisma.$disconnect();
    return;
  }

  console.log(
    `Mode: ${args.dryRun ? "DRY-RUN" : "APPLY"}  Brands: ${brandsToProcess.length}  Limit/brand: ${args.limit || "all"}`
  );

  const grand = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    noExtract: 0,
    skipBrand: 0,
  };

  for (const brand of brandsToProcess) {
    const extractor = EXTRACTORS[brandKey(brand)];
    if (!extractor || extractor === notImplemented) {
      console.log(`\n─── ${brand} — SKIPPED (no extractor yet) ───`);
      grand.skipBrand += 1;
      continue;
    }

    const products = await prisma.shopProduct.findMany({
      where: { isPublished: true, status: "ACTIVE", brand },
      select: {
        id: true,
        brand: true,
        vendor: true,
        sku: true,
        titleEn: true,
        titleUa: true,
        categoryEn: true,
        categoryUa: true,
        tags: true,
      },
      take: args.limit > 0 ? args.limit : undefined,
    });

    console.log(`\n─── ${brand} — ${products.length} products ───`);

    // Build update plan.
    type Job = {
      id: string;
      sku: string | null;
      title: string;
      newTags: string[];
      addedFits: string[];
    };
    const jobs: Job[] = [];
    let noExtractCount = 0;
    for (const p of products) {
      const fitments = extractor(p);
      if (fitments.length === 0) {
        noExtractCount += 1;
        continue;
      }
      const fitSet = buildFitsTagSet(fitments);
      const merged = mergeFitsTagsIntoExisting(p.tags ?? [], fitSet);
      if (merged === (p.tags ?? [])) continue; // identity → nothing new
      const added = [...fitSet].filter((t) => !(p.tags ?? []).includes(t));
      jobs.push({
        id: p.id,
        sku: p.sku,
        title: p.titleEn ?? p.titleUa ?? "",
        newTags: merged,
        addedFits: added,
      });
    }
    grand.scanned += products.length;
    grand.noExtract += noExtractCount;
    grand.skipped += products.length - jobs.length - noExtractCount;

    console.log(
      `  Scanned   : ${products.length}\n  Will update: ${jobs.length}\n  Already OK : ${products.length - jobs.length - noExtractCount}\n  No extract : ${noExtractCount}`
    );

    // Sample diff.
    console.log("\n  === Sample (first 5) ===");
    for (const j of jobs.slice(0, 5)) {
      console.log(`  [${j.sku ?? "(no sku)"}] ${j.title.slice(0, 70)}`);
      console.log(`    + ${j.addedFits.join(", ")}`);
    }

    if (args.dryRun || jobs.length === 0) {
      grand.updated += 0;
      continue;
    }

    // Apply in batches.
    const startedAt = Date.now();
    let done = 0;
    const BATCH = 50;
    for (let i = 0; i < jobs.length; i += BATCH) {
      const slice = jobs.slice(i, i + BATCH);
      await Promise.all(
        slice.map((j) =>
          prisma.shopProduct.update({
            where: { id: j.id },
            data: { tags: j.newTags },
            select: { id: true },
          })
        )
      );
      done += slice.length;
      if (done % 500 === 0 || done === jobs.length) {
        console.log(
          `  Applied ${done}/${jobs.length} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`
        );
      }
    }
    grand.updated += done;
    console.log(`  ✓ ${brand} done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  }

  console.log("\n=== Grand total ===");
  console.log(`  Scanned       : ${grand.scanned}`);
  console.log(`  Updated       : ${grand.updated}`);
  console.log(`  Already OK    : ${grand.skipped}`);
  console.log(`  No extract    : ${grand.noExtract}`);
  console.log(`  Brand skipped : ${grand.skipBrand}`);

  // Re-export type so caller code can build VehicleFitment values inline.
  void slugify;

  await prisma.$disconnect();
})();
