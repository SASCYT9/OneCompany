// Replace stale chassis tags with the canonical chassis from the product title.
// The UI's resolveBrabusChassisKey prefers tag-based chassis over title-based,
// so a stale tag (e.g. "W 177" on a GLB X 247 product) corrupts the dropdown.
//   node --env-file=.env.local scripts/sync-brabus-chassis-tags.mjs           # dry-run
//   node --env-file=.env.local scripts/sync-brabus-chassis-tags.mjs --apply
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const CHASSIS_TAG = /^[A-Z]\s?\d{3}[A-Z]?$/;
const CHASSIS_TITLE = /[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/;
const norm = (v) => v.replace(/^([A-Z])\s*(\d)/, "$1 $2");

const products = await prisma.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
  },
  select: { id: true, sku: true, titleEn: true, titleUa: true, tags: true },
});

const changes = [];
for (const x of products) {
  const tags = x.tags || [];
  const chassisTags = tags.filter((t) => CHASSIS_TAG.test(t));
  if (chassisTags.length === 0) continue;
  let titleChassis = null;
  for (const t of [x.titleEn, x.titleUa]) {
    if (!t) continue;
    const m = t.match(CHASSIS_TITLE);
    if (m) {
      titleChassis = norm(m[1]);
      break;
    }
  }
  if (!titleChassis) continue;

  const stale = chassisTags.filter((t) => norm(t) !== titleChassis);
  const hasCanonical = chassisTags.some((t) => norm(t) === titleChassis);
  if (stale.length === 0 && hasCanonical) continue;

  const newTags = [...tags.filter((t) => !stale.includes(t))];
  if (!hasCanonical) newTags.push(titleChassis);

  changes.push({
    id: x.id,
    sku: x.sku,
    removed: stale,
    added: hasCanonical ? [] : [titleChassis],
    oldTags: tags,
    newTags,
  });
}

console.log(`Planned chassis-tag fixes: ${changes.length}`);
for (const c of changes.slice(0, 10)) {
  console.log(`  ${c.sku}: -${JSON.stringify(c.removed)} +${JSON.stringify(c.added)}`);
}

if (!APPLY) {
  console.log("\nDRY-RUN. Re-run with --apply.");
  await prisma.$disconnect();
  process.exit(0);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(
  process.cwd(),
  "archive",
  "data-dumps",
  `brabus-chassis-tags-backup-${ts}.json`
);
fs.writeFileSync(
  backupPath,
  JSON.stringify(
    changes.map((c) => ({ id: c.id, sku: c.sku, oldTags: c.oldTags, newTags: c.newTags })),
    null,
    2
  )
);
console.log(`Backup: ${backupPath}`);

let n = 0;
for (const c of changes) {
  await prisma.shopProduct.update({ where: { id: c.id }, data: { tags: c.newTags } });
  n++;
  if (n % 25 === 0) console.log(`  ${n}/${changes.length}`);
}
console.log(`Done. Updated ${n} rows.`);
await prisma.$disconnect();
