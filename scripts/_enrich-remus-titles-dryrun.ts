/**
 * Dry-run: compares current DB titles for REMUS bundles against the
 * RICHER `Name` column in `bundles-export-extended.csv`. Prints a diff
 * sample + summary stats. NO writes.
 *
 * After review, run the apply-script to update.
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import Papa from "papaparse";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const EXT_CSV = "D:/One Company/_zip_inspect/bundles-export-extended.csv";
const BASE_CSV = "D:/One Company/_zip_inspect/bundles-export.csv";

type ExtRow = { "Product ID": string; Name: string };

function loadCsv<T>(file: string): T[] {
  const text = fs.readFileSync(file, "utf8");
  const parsed = Papa.parse<T>(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

/** Pick the longest distinct Name per bundleId across extended rows. */
function buildBestNameMap(): Map<string, string> {
  const rows = loadCsv<ExtRow>(EXT_CSV);
  const map = new Map<string, string>();
  for (const r of rows) {
    const id = String(r["Product ID"] ?? "").trim();
    const name = String(r.Name ?? "").trim();
    if (!id || !name) continue;
    const prev = map.get(id);
    // Prefer the longest non-empty name (richer = more tip/spec info).
    if (!prev || name.length > prev.length) map.set(id, name);
  }
  return map;
}

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  console.log("Loading extended CSV…");
  const bestNameByBundleId = buildBestNameMap();
  console.log(`Extended CSV: ${bestNameByBundleId.size} unique bundleIds with names.`);

  // Pull all REMUS bundle products from DB. SKU was stored as bundleId
  // by the importer (`data.sku = bundleId`).
  const dbRows = await prisma.shopProduct.findMany({
    where: { brand: "Remus" },
    select: { id: true, slug: true, sku: true, titleEn: true, titleUa: true },
  });
  console.log(`DB: ${dbRows.length} REMUS products.`);

  let wouldChange = 0;
  let wouldGrow = 0;
  let alreadyRich = 0;
  let noExtMatch = 0;
  const samples: Array<{ sku: string; from: string; to: string }> = [];

  for (const row of dbRows) {
    const sku = row.sku ?? "";
    const best = bestNameByBundleId.get(sku);
    if (!best) {
      noExtMatch++;
      continue;
    }
    if (best === row.titleEn) {
      alreadyRich++;
      continue;
    }
    wouldChange++;
    if (best.length > (row.titleEn?.length ?? 0)) wouldGrow++;
    if (samples.length < 12) {
      samples.push({ sku, from: row.titleEn ?? "", to: best });
    }
  }

  console.log("\n=== Title-enrichment dry-run ===");
  console.log(`Would change         : ${wouldChange}`);
  console.log(`Of which, longer     : ${wouldGrow}`);
  console.log(`Already richest      : ${alreadyRich}`);
  console.log(`No match in ext CSV  : ${noExtMatch}`);
  console.log(`Total DB rows        : ${dbRows.length}`);

  console.log("\n=== Sample diffs (first 12) ===");
  for (const s of samples) {
    console.log(`\n[${s.sku}]`);
    console.log(`  FROM: ${s.from}`);
    console.log(`  TO  : ${s.to}`);
  }

  await prisma.$disconnect();
})();
