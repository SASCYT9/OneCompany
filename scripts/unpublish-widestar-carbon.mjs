// Unpublish G-Klasse Widestar Carbon products — not for sale; surfacing them
// confuses buyers (per repeated user feedback). Reversible: isPublished=false,
// row preserved so we can flip back if anything changes.
//   node --env-file=.env.local scripts/unpublish-widestar-carbon.mjs --apply
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const TARGET_SKUS = ["464-234-C-99", "464-234-2C-99", "464-270-234-99"];

const products = await prisma.shopProduct.findMany({
  where: { sku: { in: TARGET_SKUS } },
  select: { id: true, sku: true, titleEn: true, isPublished: true },
});
console.log(`Found ${products.length}/${TARGET_SKUS.length} target SKUs`);
for (const x of products)
  console.log(
    `  ${x.isPublished ? "[PUB]" : "[unp]"} ${x.sku} | ${(x.titleEn || "").slice(0, 90)}`
  );

if (!APPLY) {
  console.log("\nDRY-RUN. Use --apply.");
  await prisma.$disconnect();
  process.exit(0);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(
  process.cwd(),
  "archive",
  "data-dumps",
  `widestar-carbon-unpublish-${ts}.json`
);
fs.writeFileSync(backupPath, JSON.stringify(products, null, 2));
console.log(`Backup: ${backupPath}`);

for (const x of products) {
  await prisma.shopProduct.update({ where: { id: x.id }, data: { isPublished: false } });
  console.log(`  unpublished: ${x.sku}`);
}
await prisma.$disconnect();
