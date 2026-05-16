// Restore galleries from the most recent strip-brabus-showcase-gallery backup.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const dir = path.join(process.cwd(), "archive", "data-dumps");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("brabus-gallery-backup-"))
  .sort();
if (files.length === 0) {
  console.error("No backup found.");
  process.exit(1);
}
const latest = files[files.length - 1];
const arr = JSON.parse(fs.readFileSync(path.join(dir, latest), "utf-8"));
console.log(`Backup: ${latest}  (${arr.length} entries)`);

if (!APPLY) {
  console.log("Sample restorations:");
  for (const r of arr.slice(0, 5))
    console.log(`  ${r.sku}: now ${r.newGallery.length} → restore to ${r.oldGallery.length}`);
  console.log("\nDRY-RUN. Use --apply to write.");
  await prisma.$disconnect();
  process.exit(0);
}

let n = 0;
for (const r of arr) {
  await prisma.shopProduct.update({ where: { id: r.id }, data: { gallery: r.oldGallery } });
  n++;
  if (n % 50 === 0) console.log(`  ${n}/${arr.length}`);
}
console.log(`Restored ${n} galleries.`);
await prisma.$disconnect();
