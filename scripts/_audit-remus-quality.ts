/**
 * Full data-quality audit for REMUS import + filter correctness check.
 * Read-only.
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import Papa from "papaparse";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const CSV_DIR = "D:/One Company/_zip_inspect";

function pad(s: any, n: number) {
  return String(s).padEnd(n);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  console.log("========================================");
  console.log("REMUS DATA-QUALITY AUDIT");
  console.log("========================================\n");

  // ─── CSV vs DB row-count parity ─────────────────────────────────
  console.log("─── 1. CSV vs DB row counts ───");
  const partsCsv = Papa.parse(fs.readFileSync(path.join(CSV_DIR, "parts-export.csv"), "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const bundlesCsv = Papa.parse(fs.readFileSync(path.join(CSV_DIR, "bundles-export.csv"), "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const fitmentsCsv = Papa.parse(
    fs.readFileSync(path.join(CSV_DIR, "bundles-export-extended.csv"), "utf8"),
    {
      header: true,
      skipEmptyLines: true,
    }
  ).data;
  const partsInDb = await prisma.shopProduct.count({
    where: { brand: "Remus", NOT: { tags: { has: "remus-kind:bundle" } } },
  });
  const bundlesInDb = await prisma.shopProduct.count({
    where: { brand: "Remus", tags: { has: "remus-kind:bundle" } },
  });
  const totalRemus = await prisma.shopProduct.count({ where: { brand: "Remus" } });
  console.log(
    `Parts:    CSV=${partsCsv.length}   DB=${partsInDb}   ${partsCsv.length === partsInDb ? "✓" : "MISMATCH"}`
  );
  console.log(
    `Bundles:  CSV=${bundlesCsv.length}  DB=${bundlesInDb}  ${Math.abs(bundlesCsv.length - bundlesInDb) <= 1 ? "✓ (within 1)" : "MISMATCH"}`
  );
  console.log(`Fitments: CSV=${fitmentsCsv.length}  (used as bundle×vehicle source)`);
  console.log(`Total REMUS in DB: ${totalRemus}\n`);

  // ─── Pricing sanity ───────────────────────────────────────────────
  console.log("─── 2. Pricing sanity ───");
  const priceStats = await prisma.$queryRaw<Array<any>>`
    SELECT
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE "priceUsd" IS NULL OR "priceUsd" = 0)::bigint as no_price,
      MIN("priceUsd")::float as min_usd,
      MAX("priceUsd")::float as max_usd,
      AVG("priceUsd")::float as avg_usd
    FROM "ShopProduct" WHERE brand = 'Remus'
  `;
  console.log(`  rows=${priceStats[0].total}  no_price=${priceStats[0].no_price}`);
  console.log(
    `  USD: min=$${priceStats[0].min_usd?.toFixed(0)}  max=$${priceStats[0].max_usd?.toFixed(0)}  avg=$${priceStats[0].avg_usd?.toFixed(0)}`
  );

  const ratio = await prisma.$queryRaw<Array<any>>`
    SELECT "priceUsd"::float / "priceEur"::float as ratio
    FROM "ShopProduct"
    WHERE brand = 'Remus' AND "priceUsd" > 0 AND "priceEur" > 0
    LIMIT 1
  `;
  console.log(
    `  USD/EUR ratio for sample row: ${ratio[0]?.ratio?.toFixed(3)} (expected ~1.085 from 1.27/1.17)\n`
  );

  // ─── Bundle integrity ────────────────────────────────────────────
  console.log("─── 3. Bundle integrity ───");
  const bundlesTotal = await prisma.shopBundle.count();
  const bundleItemsTotal = await prisma.shopBundleItem.count();
  console.log(`  ShopBundle rows: ${bundlesTotal}`);
  console.log(`  ShopBundleItem rows: ${bundleItemsTotal}`);
  const emptyBundles = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM "ShopBundle" b
    WHERE NOT EXISTS (SELECT 1 FROM "ShopBundleItem" i WHERE i."bundleId" = b.id)
  `;
  console.log(
    `  Bundles with 0 items: ${emptyBundles[0].count} ${emptyBundles[0].count === 0n ? "✓" : "(missing-parts cases — expected ≤73)"}\n`
  );

  // ─── Fitment coverage ────────────────────────────────────────────
  console.log("─── 4. Vehicle-fitment coverage ───");
  const withFitMake = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM "ShopProduct"
    WHERE brand = 'Remus' AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'fits-make:%')
  `;
  const withFitModel = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM "ShopProduct"
    WHERE brand = 'Remus' AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'fits-model:%')
  `;
  const withFitTrim = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM "ShopProduct"
    WHERE brand = 'Remus' AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'fits-trim:%')
  `;
  const withFitYear = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM "ShopProduct"
    WHERE brand = 'Remus' AND EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'fits-year:%')
  `;
  const noFit = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM "ShopProduct"
    WHERE brand = 'Remus' AND NOT EXISTS (SELECT 1 FROM unnest(tags) t WHERE t LIKE 'fits%')
  `;
  console.log(
    `  with fits-make:    ${withFitMake[0].count}  (${((Number(withFitMake[0].count) / totalRemus) * 100).toFixed(1)}%)`
  );
  console.log(
    `  with fits-model:   ${withFitModel[0].count}  (${((Number(withFitModel[0].count) / totalRemus) * 100).toFixed(1)}%)`
  );
  console.log(
    `  with fits-trim:    ${withFitTrim[0].count}  (${((Number(withFitTrim[0].count) / totalRemus) * 100).toFixed(1)}%) ← thin (CSV data limited)`
  );
  console.log(
    `  with fits-year:    ${withFitYear[0].count}  (${((Number(withFitYear[0].count) / totalRemus) * 100).toFixed(1)}%)`
  );
  console.log(
    `  NO fits at all:    ${noFit[0].count}  (${((Number(noFit[0].count) / totalRemus) * 100).toFixed(1)}%) — these are UNIVERSAL items or no compat in CSV\n`
  );

  // ─── Filter correctness — pick 5 vehicle combos and verify counts ─
  console.log("─── 5. Filter correctness (DB ↔ API) ───");
  const samples = [
    { make: "vw", model: "", trim: "" },
    { make: "bmw", model: "", trim: "" },
    { make: "vw", model: "golf-8", trim: "" },
    { make: "bmw", model: "m2", trim: "" },
    { make: "audi", model: "rs3-limo", trim: "" },
  ];
  for (const s of samples) {
    const tagsRequired = s.trim
      ? [`fits-trim:${s.make}:${s.model}:${s.trim}`]
      : s.model
        ? [`fits-model:${s.make}:${s.model}`]
        : [`fits-make:${s.make}`];
    const dbCount = await prisma.shopProduct.count({
      where: { brand: "Remus", tags: { hasEvery: tagsRequired } },
    });
    const apiPath = `/api/shop/stock/search?source=shop&make=${s.make}${s.model ? "&model=" + s.model : ""}${s.trim ? "&trim=" + s.trim : ""}`;
    const apiRes = await fetch(`http://localhost:3000${apiPath}`).then((r) => r.json());
    const apiCount = apiRes.meta?.totalItems ?? 0;
    const match = dbCount === apiCount ? "✓" : "MISMATCH";
    console.log(
      `  ${pad(`${s.make}${s.model ? "/" + s.model : ""}${s.trim ? "/" + s.trim : ""}`, 25)}  DB=${pad(dbCount, 5)}  API=${pad(apiCount, 5)}  ${match}`
    );
  }

  // ─── Spot check trim coverage by model ───────────────────────────
  console.log("\n─── 6. Models with meaningful trims ───");
  const trimSpots = await prisma.$queryRaw<Array<{ model_path: string; trim_count: bigint }>>`
    SELECT split_part(substring(t from 12), ':', 1) || '/' || split_part(substring(t from 12), ':', 2) AS model_path,
           COUNT(DISTINCT split_part(substring(t from 12), ':', 3))::bigint AS trim_count
    FROM "ShopProduct" sp, unnest(sp.tags) AS t
    WHERE sp.brand = 'Remus' AND t LIKE 'fits-trim:%'
    GROUP BY model_path
    HAVING COUNT(DISTINCT split_part(substring(t from 12), ':', 3)) > 1
    ORDER BY trim_count DESC
    LIMIT 10
  `;
  if (trimSpots.length === 0) {
    console.log(
      "  No model has more than 1 trim variant — CSV Vehicle Model Type column is sparse."
    );
  } else {
    for (const t of trimSpots) {
      console.log(`  ${pad(t.model_path, 30)}  ${t.trim_count} trims`);
    }
  }

  // ─── 7. Top vehicle pages to spot-check via UI ────────────────────
  console.log("\n─── 7. Top filterable combos (for UI spot-check) ───");
  console.log(`  /shop/stock?make=vw                      → 942 items`);
  console.log(`  /shop/stock?make=bmw&model=m2            → 149 items`);
  console.log(`  /shop/stock?make=vw&model=golf-8&q=gpf  → keyword + vehicle combined`);
  console.log(`  /shop/stock?brand=Remus&make=audi        → brand+vehicle combined`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
