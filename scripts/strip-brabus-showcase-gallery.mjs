// Strip external (brabus.com) marketing showcase URLs from Brabus product galleries.
// These are styled "look-book" shots of full vehicles wearing complete BRABUS kits
// (incl. Widestar Carbon which is NOT for sale) — they confuse buyers into thinking
// unrelated parts are bundled. Local blob images (close-ups of the actual product)
// are kept untouched.
//   node --env-file=.env.local scripts/strip-brabus-showcase-gallery.mjs           # dry-run
//   node --env-file=.env.local scripts/strip-brabus-showcase-gallery.mjs --apply
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const products = await prisma.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
  },
  select: { id: true, sku: true, slug: true, image: true, gallery: true, titleEn: true },
});

const isExternalBrabus = (u) => /^https?:\/\/(www\.)?brabus\.com\//i.test(u);

const changes = [];
for (const x of products) {
  const g = x.gallery || [];
  const filtered = g.filter((u) => !isExternalBrabus(u));
  if (filtered.length === g.length) continue;
  changes.push({
    id: x.id,
    sku: x.sku,
    removed: g.filter(isExternalBrabus),
    oldGallery: g,
    newGallery: filtered,
  });
}

console.log(`Brabus products: ${products.length}`);
console.log(`Galleries with brabus.com URLs: ${changes.length}`);
console.log(`Total URLs to remove: ${changes.reduce((s, c) => s + c.removed.length, 0)}`);
console.log("\nSamples:");
for (const c of changes.slice(0, 5)) {
  console.log(
    `  ${c.sku}: -${c.removed.length} (was ${c.oldGallery.length}, now ${c.newGallery.length})`
  );
}

if (!APPLY) {
  console.log("\nDRY-RUN.");
  await prisma.$disconnect();
  process.exit(0);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(
  process.cwd(),
  "archive",
  "data-dumps",
  `brabus-gallery-backup-${ts}.json`
);
fs.writeFileSync(
  backupPath,
  JSON.stringify(
    changes.map((c) => ({
      id: c.id,
      sku: c.sku,
      oldGallery: c.oldGallery,
      newGallery: c.newGallery,
    })),
    null,
    2
  )
);
console.log(`Backup: ${backupPath}`);

let n = 0;
for (const c of changes) {
  await prisma.shopProduct.update({ where: { id: c.id }, data: { gallery: c.newGallery } });
  n++;
  if (n % 50 === 0) console.log(`  ${n}/${changes.length}`);
}
console.log(`Done. Updated ${n} galleries.`);
await prisma.$disconnect();
