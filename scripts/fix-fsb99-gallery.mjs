import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
const x = await prisma.shopProduct.findFirst({
  where: { sku: "465-800-FSB-99" },
  select: { id: true, sku: true, gallery: true, image: true },
});
const oldGallery = x.gallery || [];
const newGallery = oldGallery
  .filter((u) => !/^https?:\/\/(www\.)?brabus\.com\//i.test(u))
  .slice(0, 4);
console.log(`old (${oldGallery.length}):`);
oldGallery.forEach((u) => console.log("  " + u));
console.log(`new (${newGallery.length}):`);
newGallery.forEach((u) => console.log("  " + u));
if (!APPLY) {
  console.log("DRY-RUN");
  await prisma.$disconnect();
  process.exit(0);
}
const ts = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(
  path.join(process.cwd(), "archive", "data-dumps", `fsb99-gallery-${ts}.json`),
  JSON.stringify({ id: x.id, sku: x.sku, oldGallery, newGallery }, null, 2)
);
await prisma.shopProduct.update({ where: { id: x.id }, data: { gallery: newGallery } });
console.log("Updated.");
await prisma.$disconnect();
