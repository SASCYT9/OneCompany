/**
 * Ilmberger Carbon → ShopProduct importer.
 *
 * Reads tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json (output of
 * scrape→download→translate pipeline) and upserts ShopProduct rows.
 *
 * Run:
 *   tsx scripts/ilmberger/import.ts --dry-run
 *     → writes tmp/ilmberger-import-preview.json (no DB write)
 *
 *   tsx --env-file=.env.local scripts/ilmberger/import.ts --limit 1 --only TAO.011
 *     → writes 1 ShopProduct row matching SKU substring "TAO.011"
 *
 *   tsx --env-file=.env.local scripts/ilmberger/import.ts
 *     → upserts all 38 products
 *
 *   tsx --env-file=.env.local scripts/ilmberger/import.ts --setup-category
 *     → creates "ilmberger-carbon" ShopCategory (idempotent), then exits
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const SETUP_CATEGORY_ONLY = argv.includes("--setup-category");
// --skip-existing: do not overwrite rows that already exist in DB (by slug).
// Useful when scraping a new collection whose products mostly re-use SKUs
// from a previous collection (cross-fit parts). Keeps existing tags +
// categoryEn intact instead of replacing them with the new context's values.
const SKIP_EXISTING = argv.includes("--skip-existing");
const limitFlag = argv.indexOf("--limit");
const LIMIT = limitFlag >= 0 ? parseInt(argv[limitFlag + 1], 10) : null;
const onlyFlag = argv.indexOf("--only");
const ONLY = onlyFlag >= 0 ? argv[onlyFlag + 1] : null;

// --in accepts one or more comma-separated JSON paths. All products are
// merged before upsert (so we can do BMW+Ducati in a single run).
const inFlag = argv.indexOf("--in");
const JSON_PATHS =
  inFlag >= 0
    ? argv[inFlag + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json"];
const PREVIEW_PATH = "tmp/ilmberger-import-preview.json";

type ScrapedProduct = {
  sku: string;
  url: string;
  titleEn: string;
  titleUa?: string;
  priceEur: number;
  descriptionHtmlEn: string;
  descriptionHtmlUa?: string;
  imageUrls: string[];
  category: string;
  fitment: string;
};

function skuToSlug(sku: string) {
  return "ilmberger-" + sku.toLowerCase().replace(/[.\s]+/g, "-");
}

/**
 * Detect marque (BMW / Ducati / Other) from SKU chassis suffix.
 * BMW   chassis codes: S119S, S121N/S, M121S, M123S, S125S, ...
 * Ducati chassis codes: DPV4G/M.K, DV4RG/M.K, V422G/M.K, DLA*G/M.K, V4P24
 */
function detectMarque(sku: string, titleEn: string): "BMW" | "Ducati" | "Other" {
  if (
    /\.(DPV4[GM]|DV4R[GM]|V422[GM]|DLA[RSG][GM]|V4P\d{2}|DI\d{2}[GM]?|SF\d?V4)\b/.test(sku) ||
    /\b(ducati|panigale|streetfighter|diavel|xdiavel)\b/i.test(titleEn)
  ) {
    return "Ducati";
  }
  // BMW XR chassis: S10XR (all-years), 1XR15 (2015-2019), 1XR20 (2020-2023), 1XR24 (2024+), MXR24 (M XR 2024)
  if (
    /\.[SM]\d{3}[A-Z]?$/.test(sku) ||
    /\.(S10XR|1XR\d{2}|MXR\d{2})\b/.test(sku) ||
    /\bbmw\b|s\s*1000|m\s*1000/i.test(titleEn)
  ) {
    return "BMW";
  }
  return "Other";
}

/**
 * Build category labels (EN + UA) from the product's real title + SKU.
 *
 * Strategy:
 *  - Primary model = FIRST model mention in titleEn.
 *  - Year = first 20XX in title; fall back to SKU chassis-code mapping
 *    (e.g. V422 → MY 2022, V4P24 → MY 2024-25, DPV4 → MY 2018+).
 *  - "Street" suffix only for BMW S125S chassis (true Street trim).
 */
function categoryFromTitle(titleEn: string, sku: string): { en: string; ua: string } {
  const t = titleEn;
  const marque = detectMarque(sku, t);

  // ── Year detection ─────────────────────────────────────────────────
  let year = t.match(/\b(20\d{2})\b/)?.[1] ?? null;
  if (!year) {
    if (/\.V4P\d{2}\b/.test(sku))
      year = "2025"; // V4P24 = Carbon 2024-25 line
    else if (/\.SF\d?V4\b/.test(sku))
      year = "2025"; // SF*V4 = Streetfighter 2025
    else if (/\.V422[GM]\.K$/.test(sku)) year = "2022";
    else if (/\.DV4R[GM]\.K$/.test(sku)) year = "2019";
    else if (/\.DPV4[GM]\.K$/.test(sku)) year = "2018";
    else if (/\.DI19[GM]?\.K$/.test(sku))
      year = "2019"; // Diavel 1260
    else if (/\.DI23[GM]?\.K$/.test(sku)) year = "2023"; // Diavel V4
  }

  if (marque === "Ducati") {
    // Find earliest Ducati model in title; chassis-code fallback if title is silent.
    const modelPatterns: Array<{ re: RegExp; name: string }> = [
      { re: /xdiavel\b/i, name: "XDiavel" },
      { re: /diavel\s*v4\s*rs\b/i, name: "Diavel V4 RS" },
      { re: /diavel\s*v4\s*bentley/i, name: "Diavel V4 Bentley" },
      { re: /diavel\s*v4\b/i, name: "Diavel V4" },
      { re: /diavel\s*1260\b/i, name: "Diavel 1260" },
      { re: /\bdiavel\b/i, name: "Diavel" },
      { re: /streetfighter\s*v4\s*\/\s*v4\s*s/i, name: "Streetfighter V4 / V4 S" },
      { re: /streetfighter\s*v4\s*s\b/i, name: "Streetfighter V4 S" },
      { re: /streetfighter\s*v4\b/i, name: "Streetfighter V4" },
      { re: /panigale\s*v4\s*r\b/i, name: "Panigale V4 R" },
      { re: /panigale\s*v4\s*\/\s*v4\s*s\b/i, name: "Panigale V4 / V4 S" },
      { re: /panigale\s*v4\s*s\b/i, name: "Panigale V4 S" },
      { re: /panigale\s*v4\b/i, name: "Panigale V4" },
    ];
    let firstIdx = Infinity;
    let model = "Ducati";
    for (const { re, name } of modelPatterns) {
      const m = t.match(re);
      if (m && m.index !== undefined && m.index < firstIdx) {
        firstIdx = m.index;
        model = name;
      }
    }
    // SKU chassis fallback when title doesn't mention bike name
    if (model === "Ducati") {
      if (/\.DI19[GM]?\.K$/.test(sku)) model = "Diavel 1260";
      else if (/\.DI23[GM]?\.K$/.test(sku)) model = "Diavel V4";
      else if (/\.SF\d?V4\b/.test(sku)) model = "Streetfighter V4";
      else if (/\.(DPV4[GM]|V422[GM]|V4P\d{2})\b/.test(sku)) model = "Panigale V4";
      else if (/\.DV4R[GM]\.K$/.test(sku)) model = "Panigale V4 R";
    }
    return year
      ? { en: `Ducati ${model} (MY ${year})`, ua: `Ducati ${model} (MY ${year})` }
      : { en: `Ducati ${model}`, ua: `Ducati ${model}` };
  }

  // ── BMW (default) ──────────────────────────────────────────────────
  // SKU-chassis year fallback for BMW XR + 2025 R/M models.
  if (!year) {
    if (/\.MXR24\b/.test(sku))
      year = "2024"; // M 1000 XR 2024
    else if (/\.1XR24\b/.test(sku))
      year = "2024"; // S 1000 XR 2024
    else if (/\.1XR20\b/.test(sku))
      year = "2020"; // S 1000 XR 2020-2023
    else if (/\.1XR15\b/.test(sku))
      year = "2015"; // S 1000 XR 2015-2019
    else if (/\.S10XR\b/.test(sku)) year = "2024"; // generic XR all-years → tag as latest
  }

  const modelPatterns: Array<{ re: RegExp; name: string }> = [
    { re: /m\s*\/\s*s\s*1000\s*rr/i, name: "M/S 1000 RR" },
    { re: /\bm\s*1000\s*xr\b|m1000xr/i, name: "M 1000 XR" },
    { re: /\bs\s*1000\s*xr\b|s1000xr/i, name: "S 1000 XR" },
    { re: /\bm\s*1000\s*rr\b|m1000rr/i, name: "M 1000 RR" },
    { re: /\bs\s*1000\s*rr\b|s1000rr/i, name: "S 1000 RR" },
    { re: /\bm\s*1000\s*r\b(?!r)/i, name: "M 1000 R" },
    { re: /\bs\s*1000\s*r\b(?!r)/i, name: "S 1000 R" },
  ];
  let firstIdx = Infinity;
  let model = "1000 RR";
  for (const { re, name } of modelPatterns) {
    const m = t.match(re);
    if (m && m.index !== undefined && m.index < firstIdx) {
      firstIdx = m.index;
      model = name;
    }
  }
  // SKU-chassis model fallback when title is silent (some XR parts list "all years")
  if (model === "1000 RR" && /\.MXR\d{2}\b/.test(sku)) model = "M 1000 XR";
  if (model === "1000 RR" && /\.(1XR\d{2}|S10XR)\b/.test(sku)) model = "S 1000 XR";

  const isStreetModel = /\.S125[SN]?$/.test(sku);
  const streetSuffix = isStreetModel ? " Street" : "";
  return year
    ? {
        en: `BMW ${model}${streetSuffix} (MY ${year})`,
        ua: `BMW ${model}${streetSuffix} (MY ${year})`,
      }
    : { en: `BMW ${model}${streetSuffix}`, ua: `BMW ${model}${streetSuffix}` };
}

function buildRow(p: ScrapedProduct, categoryId: string | null) {
  // Build fitment-specific tags from the actual title — NOT hardcoded.
  // Otherwise every product matches every model filter (e.g. tag "M 1000 RR"
  // on a Rear Hugger that only fits S 1000 RR would falsely match the
  // M 1000 RR filter).
  const marque = detectMarque(p.sku, p.titleEn);
  const title = p.titleEn.toLowerCase();
  const titleNoSpace = title.replace(/\s+/g, "");
  const modelTags: string[] = [];

  if (marque === "Ducati") {
    // Order matters: most-specific first.
    if (/xdiavel/i.test(p.titleEn)) modelTags.push("XDiavel");
    if (/diavel\s*v4\s*rs\b/i.test(p.titleEn)) modelTags.push("Diavel V4 RS");
    if (/diavel\s*v4\s*bentley/i.test(p.titleEn)) modelTags.push("Diavel V4 Bentley");
    if (/diavel\s*v4\b/i.test(p.titleEn)) modelTags.push("Diavel V4");
    if (/diavel\s*1260\b/i.test(p.titleEn)) modelTags.push("Diavel 1260");
    if (/\bdiavel\b/i.test(p.titleEn) && !modelTags.some((t) => /diavel/i.test(t))) {
      modelTags.push("Diavel");
    }
    if (/streetfighter\s*v4\s*\/\s*v4\s*s/i.test(p.titleEn)) {
      modelTags.push("Streetfighter V4", "Streetfighter V4 S");
    } else if (/streetfighter\s*v4/i.test(p.titleEn)) {
      modelTags.push("Streetfighter V4");
    }
    if (/panigale\s*v4\s*r\b/i.test(p.titleEn)) modelTags.push("Panigale V4 R");
    if (/panigale\s*v4\s*\/\s*v4\s*s/i.test(p.titleEn)) {
      modelTags.push("Panigale V4", "Panigale V4 S");
    } else if (/panigale\s*v4\s*s\b/i.test(p.titleEn)) {
      modelTags.push("Panigale V4 S");
    } else if (/panigale\s*v4\b/i.test(p.titleEn)) {
      modelTags.push("Panigale V4");
    }
    // SKU-based fallback for products whose titles don't name the bike
    if (modelTags.length === 0) {
      if (/\.DI19[GM]?\.K$/.test(p.sku)) modelTags.push("Diavel 1260", "XDiavel");
      else if (/\.DI23[GM]?\.K$/.test(p.sku)) modelTags.push("Diavel V4");
      else if (/\.SF\d?V4\b/.test(p.sku)) modelTags.push("Streetfighter V4");
      else if (/\.DV4R[GM]\.K$/.test(p.sku)) modelTags.push("Panigale V4 R");
      else if (/\.(DPV4[GM]|V422[GM]|V4P\d{2})\b/.test(p.sku))
        modelTags.push("Panigale V4", "Panigale V4 S");
      else if (/\.DLA[RSG][GM]\.K$/.test(p.sku)) modelTags.push("Panigale V4", "Streetfighter V4");
    }
  } else {
    // BMW (default)
    if (titleNoSpace.includes("m1000xr")) modelTags.push("M 1000 XR");
    if (titleNoSpace.includes("s1000xr")) modelTags.push("S 1000 XR");
    if (titleNoSpace.includes("m1000rr")) modelTags.push("M 1000 RR");
    if (
      titleNoSpace.includes("m1000r") &&
      !titleNoSpace.includes("m1000rr") &&
      !titleNoSpace.includes("m1000xr")
    )
      modelTags.push("M 1000 R");
    if (titleNoSpace.includes("s1000rr")) modelTags.push("S 1000 RR");
    if (
      titleNoSpace.includes("s1000r") &&
      !titleNoSpace.includes("s1000rr") &&
      !titleNoSpace.includes("s1000xr")
    )
      modelTags.push("S 1000 R");
    if (title.includes("m/s 1000 rr") || title.includes("m / s 1000 rr")) {
      if (!modelTags.includes("M 1000 RR")) modelTags.push("M 1000 RR");
      if (!modelTags.includes("S 1000 RR")) modelTags.push("S 1000 RR");
    }
    // SKU-chassis fallback when title doesn't name the bike
    if (modelTags.length === 0) {
      if (/\.MXR\d{2}\b/.test(p.sku)) modelTags.push("M 1000 XR");
      else if (/\.(1XR\d{2}|S10XR)\b/.test(p.sku)) modelTags.push("S 1000 XR");
      else {
        const m = p.sku.match(/\.([SM])\d{3}[A-Z]?$/);
        if (m?.[1] === "M") modelTags.push("M 1000 RR");
        if (m?.[1] === "S") modelTags.push("S 1000 RR");
      }
    }
  }

  // Marque-level tags (used by VehicleFilter "Марка" dropdown).
  const marqueTags =
    marque === "Ducati" ? ["Ducati"] : marque === "BMW" ? ["BMW Motorrad", "BMW"] : [];

  const tags = ["Ilmberger", "Ilmberger Carbon", ...marqueTags, ...modelTags, p.category].filter(
    Boolean
  );

  // Short desc: strip HTML, first 200 chars
  const shortEn = p.descriptionHtmlEn
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 220);
  const shortUa = (p.descriptionHtmlUa ?? p.descriptionHtmlEn)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 220);

  return {
    slug: skuToSlug(p.sku),
    sku: p.sku,
    scope: "moto" as const,
    brand: "Ilmberger Carbon",
    vendor: "Ilmberger Carbon",
    productType: "Carbon Part",
    productCategory: p.category,
    categoryId,
    titleEn: p.titleEn,
    titleUa: p.titleUa ?? p.titleEn,
    ...(() => {
      const cat = categoryFromTitle(p.titleEn, p.sku);
      return { categoryEn: cat.en, categoryUa: cat.ua };
    })(),
    bodyHtmlEn: p.descriptionHtmlEn,
    bodyHtmlUa: p.descriptionHtmlUa ?? p.descriptionHtmlEn,
    shortDescEn: shortEn,
    shortDescUa: shortUa,
    priceEur: p.priceEur,
    stock: "inStock" as const,
    image: p.imageUrls[0] ?? null,
    gallery: p.imageUrls,
    tags,
    isPublished: true,
  };
}

async function setupCategory() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const cat = await prisma.shopCategory.upsert({
      where: { slug: "ilmberger-carbon" },
      update: {},
      create: {
        slug: "ilmberger-carbon",
        titleEn: "Ilmberger Carbon",
        titleUa: "Ilmberger Carbon",
        descriptionEn:
          "Autoclaved prepreg carbon parts for sportbikes. Hand-laid in Lindberg, Germany since 1995.",
        descriptionUa:
          "Препрег-карбон в автоклаві для спортбайків. Ручна укладка в Ліндберзі, Німеччина з 1995 року.",
        isPublished: true,
      },
    });
    console.log(`✅ Category ready: ${cat.id} (${cat.slug})`);
  } finally {
    await prisma.$disconnect();
  }
}

async function findCategoryId(): Promise<string | null> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const cat = await prisma.shopCategory.findUnique({
      where: { slug: "ilmberger-carbon" },
    });
    return cat?.id ?? null;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (SETUP_CATEGORY_ONLY) {
    await setupCategory();
    return;
  }

  // Read + concat all input JSONs in --in order.
  let products: ScrapedProduct[] = JSON_PATHS.flatMap((p) => JSON.parse(readFileSync(p, "utf-8")));
  console.log(`📂 Loaded ${products.length} products from ${JSON_PATHS.length} file(s)`);

  if (ONLY) {
    products = products.filter((p) => p.sku.includes(ONLY));
    console.log(`🎯 Filtered by --only "${ONLY}": ${products.length} products`);
  }
  if (LIMIT) {
    products = products.slice(0, LIMIT);
    console.log(`🎯 Limited to ${LIMIT}`);
  }

  console.log(`📋 Processing ${products.length} products. DRY_RUN=${DRY_RUN}\n`);

  let categoryId: string | null = null;
  if (!DRY_RUN) {
    categoryId = await findCategoryId();
    if (!categoryId) {
      console.error(`❌ Category "ilmberger-carbon" not found. Run --setup-category first.`);
      process.exit(1);
    }
  } else {
    categoryId = "<<dry-run-no-category-lookup>>";
  }

  const rows = products.map((p) => buildRow(p, categoryId));

  if (DRY_RUN) {
    mkdirSync(path.dirname(PREVIEW_PATH), { recursive: true });
    writeFileSync(PREVIEW_PATH, JSON.stringify(rows, null, 2));
    console.log(`✅ DRY-RUN preview written → ${PREVIEW_PATH}`);
    console.log(`   ${rows.length} rows would be upserted.`);
    console.log(
      `   Inspect, then run again without --dry-run + with --env-file=.env.local to write.`
    );
    return;
  }

  // Live write
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  try {
    for (const row of rows) {
      try {
        const existing = await prisma.shopProduct.findUnique({
          where: { slug: row.slug },
          select: { id: true },
        });
        if (existing) {
          if (SKIP_EXISTING) {
            skipped++;
            continue;
          }
          await prisma.shopProduct.update({ where: { slug: row.slug }, data: row });
          updated++;
          console.log(`  ✏️  ${row.sku} updated`);
        } else {
          await prisma.shopProduct.create({ data: row });
          created++;
          console.log(`  ➕ ${row.sku} created`);
        }
      } catch (e: any) {
        errors++;
        console.log(`  ✗ ${row.sku} FAILED: ${e.message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    `\n✅ Created ${created}, updated ${updated}, skipped ${skipped}, failed ${errors} of ${rows.length}`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
