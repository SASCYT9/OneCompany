/**
 * Import the REMUS catalog (parts + bundles + vehicle fitments) into
 * ShopProduct / ShopBundle / ShopBundleItem so dealers can browse it on
 * the B2B portal (`/shop/stock`). Products are tagged `audience:b2b` —
 * hidden from every public listing until we launch the public REMUS
 * brand-store.
 *
 * Source CSVs (Sanity export, GBP-pricing):
 *   D:/One Company/_zip_inspect/parts-export.csv             (429 rows)
 *   D:/One Company/_zip_inspect/bundles-export.csv           (3,423 rows)
 *   D:/One Company/_zip_inspect/bundles-export-extended.csv  (7,648 rows = bundles × vehicle fits)
 *
 * Usage:
 *   npx tsx scripts/import-remus-catalog.ts --dry-run                 # plan only
 *   npx tsx scripts/import-remus-catalog.ts --parts-only --limit=10  # 10 parts
 *   npx tsx scripts/import-remus-catalog.ts --parts-only             # all 429 parts
 *   npx tsx scripts/import-remus-catalog.ts --bundles-only           # bundles + fitments
 *   npx tsx scripts/import-remus-catalog.ts                          # full sync (parts → bundles → fitments)
 *
 * Idempotency: upserts by slug — re-running with the same CSVs is safe.
 * Pre-existing ShopProducts from other brands are not touched.
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import Papa from "papaparse";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Defer prisma import until after dotenv.config — prisma client reads
// DATABASE_URL at module-load time.

// ───── Currency conversion (Phase 1 — hardcoded; revisit at Phase 2) ────
// Reference rates 2026-05-20 ± rounded to 2 decimals.
const GBP_TO_USD = 1.27;
const GBP_TO_EUR = 1.17;
const GBP_TO_UAH = 52.0;

// ───── Constants ─────────────────────────────────────────────────────────
const CSV_DIR = "D:/One Company/_zip_inspect";
const PARTS_CSV = path.join(CSV_DIR, "parts-export.csv");
const BUNDLES_CSV = path.join(CSV_DIR, "bundles-export.csv");
const FITMENTS_CSV = path.join(CSV_DIR, "bundles-export-extended.csv");

const BRAND_NAME = "Remus";
const VENDOR_NAME = "Remus";
const BASE_TAGS: ReadonlyArray<string> = [
  "audience:b2b",
  "store:main",
  "brand:remus",
  "remus",
  "remus-source:csv-export",
];

// ───── Args ──────────────────────────────────────────────────────────────
type Args = {
  dryRun: boolean;
  partsOnly: boolean;
  bundlesOnly: boolean;
  limitParts: number;
  limitBundles: number;
};

function parseArgs(): Args {
  const out: Args = {
    dryRun: false,
    partsOnly: false,
    bundlesOnly: false,
    limitParts: 0,
    limitBundles: 0,
  };
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--parts-only") out.partsOnly = true;
    else if (a === "--bundles-only") out.bundlesOnly = true;
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10) || 0;
      out.limitParts = n;
      out.limitBundles = n;
    } else if (a.startsWith("--limit-parts=")) {
      out.limitParts = parseInt(a.slice("--limit-parts=".length), 10) || 0;
    } else if (a.startsWith("--limit-bundles=")) {
      out.limitBundles = parseInt(a.slice("--limit-bundles=".length), 10) || 0;
    }
  }
  return out;
}

// ───── Helpers ───────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function trimOrNull(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function parsePriceGbp(raw: unknown): number {
  const n = parseFloat(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function gbpToUsd(gbp: number): number {
  return Math.round(gbp * GBP_TO_USD * 100) / 100;
}
function gbpToEur(gbp: number): number {
  return Math.round(gbp * GBP_TO_EUR * 100) / 100;
}
function gbpToUah(gbp: number): number {
  return Math.round(gbp * GBP_TO_UAH);
}

function readCsv<T = any>(filepath: string): T[] {
  const buf = fs.readFileSync(filepath, "utf8");
  const parsed = Papa.parse(buf, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    console.warn(
      `[remus-import] CSV parse warnings in ${path.basename(filepath)}:`,
      parsed.errors.slice(0, 3)
    );
  }
  return parsed.data as T[];
}

function parseVehicleCompat(value: string | null | undefined): string[] {
  // Parses "TOYOTA/Fortuner/2016; TOYOTA/Innova Reborn/2015,2016,2017" into
  // STRUCTURED fitment tags so the B2B portal's Make→Model→Trim cascading
  // filter can decompose them:
  //   fits-make:toyota
  //   fits-model:toyota:fortuner
  //   fits-year:2016
  // The single-string `fits:toyota-fortuner` is also emitted for back-compat
  // with anything that searches the raw form.
  if (!value) return [];
  const fits = new Set<string>();
  for (const entry of value
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const parts = entry
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) continue;
    const make = parts[0];
    const model = parts[1];
    const yearsField = parts[2] ?? "";
    const makeSlug = slugify(make);
    const modelSlug = slugify(model);
    if (!makeSlug || !modelSlug) continue;
    fits.add(`fits-make:${makeSlug}`);
    fits.add(`fits-model:${makeSlug}:${modelSlug}`);
    fits.add(`fits:${makeSlug}-${modelSlug}`); // back-compat
    // Years are comma-separated within the third segment: "2014,2015,2016"
    for (const y of yearsField
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (/^\d{4}$/.test(y)) fits.add(`fits-year:${y}`);
    }
  }
  return [...fits];
}

function parsePartSkuList(raw: string | null | undefined): string[] {
  // "025017 0000, 025017 1500" or "001090 0505" — comma-separated SKUs.
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ───── Pass 1: Parts ─────────────────────────────────────────────────────

type PartRow = {
  SKU: string;
  EAN: string;
  Name: string;
  "Main Category": string;
  "Sub Category": string;
  "Vehicle Compatibility": string;
  "Price (GBP) Excl VAT": string;
  "In Stock": string;
  "Picture Link": string;
};

async function importParts(args: Args) {
  const { prisma } = await import("../src/lib/prisma");
  const rows = readCsv<PartRow>(PARTS_CSV);
  const limit = args.limitParts > 0 ? Math.min(args.limitParts, rows.length) : rows.length;
  console.log(
    `[parts] ${rows.length} rows in CSV; importing ${limit}${args.dryRun ? " (DRY RUN)" : ""}`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    const sku = trimOrNull(row.SKU);
    if (!sku) {
      skipped++;
      continue;
    }
    const slug = `remus-${slugify(sku)}`;
    const name = trimOrNull(row.Name) ?? `REMUS ${sku}`;
    const mainCat = trimOrNull(row["Main Category"]) ?? "Cars";
    const subCat = trimOrNull(row["Sub Category"]);
    const category = subCat ? `${mainCat} / ${subCat}` : mainCat;
    const ean = trimOrNull(row.EAN);
    const gbp = parsePriceGbp(row["Price (GBP) Excl VAT"]);
    const thumbnail = trimOrNull(row["Picture Link"]);
    const inStock = String(row["In Stock"] || "").toLowerCase() === "yes";
    const fitTags = parseVehicleCompat(row["Vehicle Compatibility"]);
    const tags = Array.from(
      new Set(
        [
          ...BASE_TAGS,
          ...fitTags,
          gbp > 0 ? `remus-price-gbp:${gbp.toFixed(2)}` : null,
          ean ? `remus-ean:${ean}` : null,
        ].filter(Boolean) as string[]
      )
    );

    const data = {
      slug,
      sku,
      brand: BRAND_NAME,
      vendor: VENDOR_NAME,
      scope: "auto",
      titleEn: name,
      titleUa: name,
      categoryEn: category,
      categoryUa: category,
      productCategory: subCat ?? null,
      stock: inStock ? "inStock" : "outOfStock",
      image: thumbnail,
      priceUsd: gbp > 0 ? gbpToUsd(gbp) : null,
      priceEur: gbp > 0 ? gbpToEur(gbp) : null,
      priceUah: gbp > 0 ? gbpToUah(gbp) : null,
      tags,
      status: "ACTIVE" as const,
      isPublished: true, // gate is the audience:b2b tag, not isPublished
    };

    if (args.dryRun) {
      if (i < 3) {
        console.log(`[parts] would upsert ${slug}:`, {
          name: data.titleEn.slice(0, 60),
          priceUsd: data.priceUsd,
          stock: data.stock,
          fits: fitTags.slice(0, 3),
        });
      }
      created++;
      continue;
    }

    const existing = await prisma.shopProduct.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      await prisma.shopProduct.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.shopProduct.create({ data });
      created++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(
        `[parts] ${i + 1}/${limit} processed (created=${created} updated=${updated} skipped=${skipped})`
      );
    }
  }

  console.log(`[parts] DONE — created=${created} updated=${updated} skipped=${skipped}`);
  return { created, updated, skipped };
}

// ───── Pass 2 + 3: Bundles + Fitments ────────────────────────────────────

type BundleRow = {
  "Product ID": string;
  Name: string;
  "Vehicle Compatibility": string;
  "Part SKUs": string;
  "Bundle Price (GBP) Excl VAT": string;
  "In Stock": string;
  "Picture Link": string;
  "Gallery Links": string;
};

type FitmentRow = {
  "Product ID": string;
  "Vehicle Make": string;
  "Vehicle Model": string;
  "Vehicle Model Type": string;
  "Vehicle Year Start": string;
  "Vehicle Year End": string;
  "Vehicle Engine": string;
  "Vehicle kW": string;
};

async function importBundles(args: Args) {
  const { prisma } = await import("../src/lib/prisma");
  const rows = readCsv<BundleRow>(BUNDLES_CSV);
  const limit = args.limitBundles > 0 ? Math.min(args.limitBundles, rows.length) : rows.length;
  console.log(
    `[bundles] ${rows.length} rows in CSV; importing ${limit}${args.dryRun ? " (DRY RUN)" : ""}`
  );

  // Pre-index fitments by bundle ID so each bundle pulls its fit-tags
  // in O(1). Read once even when limit is small.
  //
  // Each bundle gets STRUCTURED fitment tags consumed by the B2B portal's
  // Make→Model→Trim cascading filter:
  //   fits-make:<makeSlug>           e.g. "fits-make:vw"
  //   fits-model:<make>:<model>      e.g. "fits-model:vw:golf-8"
  //   fits-trim:<make>:<model>:<trim> e.g. "fits-trim:vw:golf-8:r"
  //   fits-year:<year>               e.g. "fits-year:2022"
  // Plus a back-compat flat tag `fits:<make>-<model>` for free-text search.
  const fitments = readCsv<FitmentRow>(FITMENTS_CSV);
  const fitsByBundle = new Map<string, Set<string>>();
  for (const f of fitments) {
    const id = trimOrNull(f["Product ID"]);
    if (!id) continue;
    const make = trimOrNull(f["Vehicle Make"]);
    const model = trimOrNull(f["Vehicle Model"]);
    const modelType = trimOrNull(f["Vehicle Model Type"]);
    if (!make || !model) continue;
    const makeSlug = slugify(make);
    const modelSlug = slugify(model);
    if (!makeSlug || !modelSlug) continue;
    const set = fitsByBundle.get(id) ?? new Set<string>();
    set.add(`fits-make:${makeSlug}`);
    set.add(`fits-model:${makeSlug}:${modelSlug}`);
    set.add(`fits:${makeSlug}-${modelSlug}`); // back-compat flat form
    if (modelType) {
      const trimSlug = slugify(modelType);
      if (trimSlug) set.add(`fits-trim:${makeSlug}:${modelSlug}:${trimSlug}`);
    }
    const yStart = trimOrNull(f["Vehicle Year Start"]);
    const yEnd = trimOrNull(f["Vehicle Year End"]);
    if (yStart && yStart !== "0") {
      const start = parseInt(yStart, 10);
      const end = yEnd && yEnd !== "0" ? parseInt(yEnd, 10) : start;
      if (Number.isFinite(start) && start > 1900) {
        const finalEnd = Number.isFinite(end) && end >= start ? end : start;
        // Emit one tag per year so a year-pick query matches via tag-has.
        for (let y = start; y <= Math.min(finalEnd, start + 30); y++) {
          set.add(`fits-year:${y}`);
        }
      }
    }
    fitsByBundle.set(id, set);
  }
  console.log(
    `[bundles] indexed fitments for ${fitsByBundle.size} bundles from ${fitments.length} rows`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let bundleLinkedItems = 0;
  let bundleMissingParts = 0;

  // Cache part SKU → product ID lookups to avoid re-querying.
  const partIdBySku = new Map<string, string>();
  async function findPartId(sku: string): Promise<string | null> {
    if (partIdBySku.has(sku)) return partIdBySku.get(sku) ?? null;
    const row = await prisma.shopProduct.findUnique({
      where: { slug: `remus-${slugify(sku)}` },
      select: { id: true },
    });
    if (row) {
      partIdBySku.set(sku, row.id);
      return row.id;
    }
    partIdBySku.set(sku, "");
    return null;
  }

  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    const bundleId = trimOrNull(row["Product ID"]);
    if (!bundleId) {
      skipped++;
      continue;
    }
    const partSkus = parsePartSkuList(row["Part SKUs"]);
    if (partSkus.length === 0) {
      skipped++;
      continue;
    }

    const slug = `remus-bundle-${slugify(bundleId)}`;
    const name = trimOrNull(row.Name) ?? `REMUS Bundle ${bundleId}`;
    const gbp = parsePriceGbp(row["Bundle Price (GBP) Excl VAT"]);
    const thumbnail = trimOrNull(row["Picture Link"]);
    const inStock = String(row["In Stock"] || "").toLowerCase() === "yes";
    const csvFits = parseVehicleCompat(row["Vehicle Compatibility"]);
    const extendedFits = fitsByBundle.get(bundleId);
    const allFits = new Set<string>(csvFits);
    if (extendedFits) for (const t of extendedFits) allFits.add(t);

    const tags = Array.from(
      new Set(
        [
          ...BASE_TAGS,
          "remus-kind:bundle",
          ...allFits,
          gbp > 0 ? `remus-price-gbp:${gbp.toFixed(2)}` : null,
        ].filter(Boolean) as string[]
      )
    );

    const data = {
      slug,
      sku: bundleId,
      brand: BRAND_NAME,
      vendor: VENDOR_NAME,
      scope: "auto",
      titleEn: name,
      titleUa: name,
      categoryEn: "Cars / Bundles",
      categoryUa: "Cars / Bundles",
      productCategory: "Bundle",
      stock: inStock ? "inStock" : "outOfStock",
      image: thumbnail,
      priceUsd: gbp > 0 ? gbpToUsd(gbp) : null,
      priceEur: gbp > 0 ? gbpToEur(gbp) : null,
      priceUah: gbp > 0 ? gbpToUah(gbp) : null,
      tags,
      status: "ACTIVE" as const,
      isPublished: true,
    };

    if (args.dryRun) {
      if (i < 3) {
        console.log(`[bundles] would upsert ${slug}:`, {
          name: data.titleEn.slice(0, 60),
          parts: partSkus.length,
          fits: tags.filter((t) => t.startsWith("fits:")).length,
          priceUsd: data.priceUsd,
        });
      }
      created++;
      continue;
    }

    const existing = await prisma.shopProduct.findUnique({
      where: { slug },
      select: { id: true },
    });

    let bundleProductId: string;
    if (existing) {
      await prisma.shopProduct.update({ where: { id: existing.id }, data });
      bundleProductId = existing.id;
      updated++;
    } else {
      const newRow = await prisma.shopProduct.create({ data });
      bundleProductId = newRow.id;
      created++;
    }

    // Resolve part component IDs.
    const componentIds: { partSku: string; productId: string }[] = [];
    let missingForThisBundle = 0;
    for (const partSku of partSkus) {
      const pid = await findPartId(partSku);
      if (pid) componentIds.push({ partSku, productId: pid });
      else missingForThisBundle++;
    }
    if (missingForThisBundle > 0) bundleMissingParts += missingForThisBundle;

    // (Re)write bundle + items. Easier to nuke + rewrite than diff.
    await prisma.shopBundle.upsert({
      where: { productId: bundleProductId },
      create: { productId: bundleProductId },
      update: {},
    });
    await prisma.shopBundleItem.deleteMany({
      where: { bundle: { productId: bundleProductId } },
    });
    if (componentIds.length > 0) {
      const bundleRow = await prisma.shopBundle.findUnique({
        where: { productId: bundleProductId },
        select: { id: true },
      });
      if (bundleRow) {
        await prisma.shopBundleItem.createMany({
          data: componentIds.map((c, idx) => ({
            bundleId: bundleRow.id,
            componentProductId: c.productId,
            quantity: 1,
            position: idx + 1,
          })),
        });
        bundleLinkedItems += componentIds.length;
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(
        `[bundles] ${i + 1}/${limit} processed (created=${created} updated=${updated} ` +
          `linked=${bundleLinkedItems} missing-parts=${bundleMissingParts})`
      );
    }
  }

  console.log(
    `[bundles] DONE — created=${created} updated=${updated} skipped=${skipped} ` +
      `linkedItems=${bundleLinkedItems} missingParts=${bundleMissingParts}`
  );
  return { created, updated, skipped, bundleLinkedItems, bundleMissingParts };
}

// ───── Main ──────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  console.log("[remus-import] args:", args);

  if (!fs.existsSync(PARTS_CSV)) throw new Error(`Missing CSV: ${PARTS_CSV}`);
  if (!fs.existsSync(BUNDLES_CSV)) throw new Error(`Missing CSV: ${BUNDLES_CSV}`);
  if (!fs.existsSync(FITMENTS_CSV)) throw new Error(`Missing CSV: ${FITMENTS_CSV}`);

  if (!args.bundlesOnly) {
    await importParts(args);
  }
  if (!args.partsOnly) {
    await importBundles(args);
  }
  console.log("[remus-import] FINISHED");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
