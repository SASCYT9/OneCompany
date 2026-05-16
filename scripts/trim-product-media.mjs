// Trim ShopProductMedia entries down to a max position per SKU.
// Per explicit user request: 465-234-00 → keep first 2, 464-234-35 → keep first 4.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const PLAN = [
  { sku: "465-234-00", keep: 2 },
  { sku: "464-234-35", keep: 4 },
];

const backupAll = [];
for (const { sku, keep } of PLAN) {
  const x = await prisma.shopProduct.findFirst({
    where: { sku },
    select: {
      id: true,
      sku: true,
      media: { select: { id: true, src: true, position: true }, orderBy: { position: "asc" } },
    },
  });
  if (!x) {
    console.log(`MISS ${sku}`);
    continue;
  }
  const toKeep = x.media.slice(0, keep);
  const toDelete = x.media.slice(keep);
  console.log(`${sku}: ${x.media.length} → keep ${toKeep.length}, delete ${toDelete.length}`);
  backupAll.push({ sku, productId: x.id, deleted: toDelete });
  if (APPLY && toDelete.length) {
    await prisma.shopProductMedia.deleteMany({ where: { id: { in: toDelete.map((m) => m.id) } } });
  }
}
if (APPLY) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bp = path.join(process.cwd(), "archive", "data-dumps", `trim-media-${ts}.json`);
  fs.writeFileSync(bp, JSON.stringify(backupAll, null, 2));
  console.log(`Backup: ${bp}`);
} else {
  console.log("\nDRY-RUN.");
}
await prisma.$disconnect();
