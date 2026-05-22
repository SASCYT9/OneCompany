/**
 * Apply REMUS title enrichment: replaces shallow `Name` from
 * `bundles-export.csv` with the richer `Name` from
 * `bundles-export-extended.csv` (which includes silencer + tip detail).
 *
 * Idempotent — re-running yields 0 changes once titles match.
 *
 * Safety:
 *   - Only touches `brand='Remus'` rows. Other brands are not touched.
 *   - Updates titleEn AND titleUa (UA is still EN copy at this stage; will be
 *     translated when public REMUS store ships).
 *   - Batches of 50 updates per tick; logs progress every 250 rows.
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import Papa from "papaparse";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const EXT_CSV = "D:/One Company/_zip_inspect/bundles-export-extended.csv";

type ExtRow = { "Product ID": string; Name: string };

function loadCsv<T>(file: string): T[] {
  const text = fs.readFileSync(file, "utf8");
  return Papa.parse<T>(text, { header: true, skipEmptyLines: true }).data;
}

function buildBestNameMap(): Map<string, string> {
  const rows = loadCsv<ExtRow>(EXT_CSV);
  const map = new Map<string, string>();
  for (const r of rows) {
    const id = String(r["Product ID"] ?? "").trim();
    const name = String(r.Name ?? "").trim();
    if (!id || !name) continue;
    const prev = map.get(id);
    if (!prev || name.length > prev.length) map.set(id, name);
  }
  return map;
}

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  console.log("Loading extended CSV…");
  const bestNameByBundleId = buildBestNameMap();
  console.log(`Extended CSV: ${bestNameByBundleId.size} unique bundleIds.`);

  const dbRows = await prisma.shopProduct.findMany({
    where: { brand: "Remus" },
    select: { id: true, sku: true, titleEn: true },
  });
  console.log(`DB: ${dbRows.length} REMUS products. Scanning…`);

  // Build update plan (sku ↔ newTitle).
  type Job = { id: string; sku: string; oldTitle: string; newTitle: string };
  const jobs: Job[] = [];
  for (const r of dbRows) {
    const sku = r.sku ?? "";
    const best = bestNameByBundleId.get(sku);
    if (!best || best === r.titleEn) continue;
    jobs.push({ id: r.id, sku, oldTitle: r.titleEn ?? "", newTitle: best });
  }
  console.log(`Plan: ${jobs.length} rows to update.`);

  if (jobs.length === 0) {
    console.log("Nothing to do — all titles already match.");
    await prisma.$disconnect();
    return;
  }

  // Show first 5 jobs for safety preview.
  console.log("\n=== Sample (first 5) ===");
  for (const j of jobs.slice(0, 5)) {
    console.log(`[${j.sku}]\n  FROM: ${j.oldTitle}\n  TO  : ${j.newTitle}`);
  }

  console.log("\nApplying…");
  let done = 0;
  const startedAt = Date.now();

  // Sequential batches of 50 — pgbouncer-friendly (avoids pool exhaustion).
  const BATCH = 50;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const slice = jobs.slice(i, i + BATCH);
    await Promise.all(
      slice.map((j) =>
        prisma.shopProduct.update({
          where: { id: j.id },
          data: { titleEn: j.newTitle, titleUa: j.newTitle },
          select: { id: true },
        })
      )
    );
    done += slice.length;
    if (done % 250 === 0 || done === jobs.length) {
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`  ${done}/${jobs.length} (${secs}s)`);
    }
  }

  console.log(`\nDone in ${((Date.now() - startedAt) / 1000).toFixed(1)}s — ${done} rows updated.`);

  // Post-check: verify a few rows got the new titles.
  const verify = await prisma.shopProduct.findMany({
    where: { id: { in: jobs.slice(0, 3).map((j) => j.id) } },
    select: { sku: true, titleEn: true },
  });
  console.log("\n=== Post-verify ===");
  for (const v of verify) console.log(`[${v.sku}] ${v.titleEn}`);

  await prisma.$disconnect();
})();
