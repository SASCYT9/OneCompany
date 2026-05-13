import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function resolveSnapshotDir(): string {
  const root = path.join(process.cwd(), "artifacts", "ipe-import");
  const dirs = require("node:fs")
    .readdirSync(root, { withFileTypes: true })
    .filter((d: any) => d.isDirectory())
    .map((d: any) => d.name)
    .filter((name: string) =>
      require("node:fs").existsSync(path.join(root, name, "match-manifest.json"))
    )
    .sort()
    .reverse();
  return path.join(root, dirs[0]);
}

const prisma = new PrismaClient();

async function main() {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  const snap: any = JSON.parse(
    await fs.readFile(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8")
  );

  const ipeProducts = await prisma.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: true, options: true },
  });

  let okMatch = 0;
  let dbHasFewer = 0;
  let dbHasMore = 0;
  let dbSingleVariantSnapMulti = 0;
  let dbNotInSnapshot = 0;
  const missingOptionsList: Array<{
    slug: string;
    dbCount: number;
    snapCount: number;
    dbVariants: string[];
    snapVariants: string[];
  }> = [];
  const dbMoreList: Array<{ slug: string; dbCount: number; snapCount: number }> = [];

  for (const dbProd of ipeProducts) {
    // Try matching to snapshot by stripping "ipe-" prefix
    const handleCandidates = [dbProd.slug, dbProd.slug.replace(/^ipe-/, "")];
    const snapProd = snap.products.find((p: any) => handleCandidates.includes(p.handle));
    if (!snapProd) {
      dbNotInSnapshot += 1;
      continue;
    }

    const dbCount = dbProd.variants.length;
    const snapCount = snapProd.variants.length;
    if (dbCount === snapCount) {
      okMatch += 1;
    } else if (dbCount < snapCount) {
      dbHasFewer += 1;
      if (dbCount === 1 && snapCount > 1) dbSingleVariantSnapMulti += 1;
      missingOptionsList.push({
        slug: dbProd.slug,
        dbCount,
        snapCount,
        dbVariants: dbProd.variants.map((v: any) =>
          [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(" / ")
        ),
        snapVariants: snapProd.variants.map((v: any) => v.optionValues.filter(Boolean).join(" / ")),
      });
    } else {
      dbHasMore += 1;
      dbMoreList.push({ slug: dbProd.slug, dbCount, snapCount });
    }
  }

  console.log(`\n=== iPE variant-axis audit ===`);
  console.log(`Total iPE products in DB: ${ipeProducts.length}`);
  console.log(`  Matched to snapshot:                 ${ipeProducts.length - dbNotInSnapshot}`);
  console.log(`  NOT in snapshot:                     ${dbNotInSnapshot}`);
  console.log(`  ✓ Variant count matches snapshot:    ${okMatch}`);
  console.log(`  ✗ DB has FEWER variants than iPE:    ${dbHasFewer}`);
  console.log(`      of which: DB=1 but iPE has >1:   ${dbSingleVariantSnapMulti}`);
  console.log(`  ✗ DB has MORE variants than iPE:     ${dbHasMore}`);

  console.log(
    `\n=== Critical: DB has fewer variants (missing user-selectable options) — top 25 ===`
  );
  for (const m of missingOptionsList.slice(0, 25)) {
    console.log(`\n[${m.slug}]  DB=${m.dbCount} vs iPE=${m.snapCount}`);
    console.log(
      `  DB variants:    ${m.dbVariants
        .slice(0, 4)
        .map((v) => `"${v}"`)
        .join(", ")}${m.dbVariants.length > 4 ? "..." : ""}`
    );
    console.log(
      `  iPE variants:   ${m.snapVariants
        .slice(0, 4)
        .map((v) => `"${v}"`)
        .join(", ")}${m.snapVariants.length > 4 ? "..." : ""}`
    );
  }

  console.log(`\n=== DB has MORE variants (phantom options) — top 10 ===`);
  for (const m of dbMoreList.slice(0, 10)) {
    console.log(`  ${m.slug.padEnd(60)} DB=${m.dbCount} vs iPE=${m.snapCount}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
