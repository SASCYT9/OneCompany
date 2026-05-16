// Chassis-authoritative model-tag normalizer for Brabus catalog.
// Title's "– <CHASSIS> – <modelName>" is the source of truth.
// Run modes:
//   node --env-file=.env.local scripts/normalize-brabus-model-tags.mjs           # dry-run
//   node --env-file=.env.local scripts/normalize-brabus-model-tags.mjs --apply   # write changes
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const CHASSIS_TITLE = /[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/;
const norm = (v) => v.replace(/^([A-Z])\s*(\d)/, "$1 $2");

// All model keys recognized by the UI filter — used to know which existing tags to consider "model tags".
const ALL_MODEL_KEYS = new Set([
  "G-Klasse",
  "A-Klasse",
  "C-Klasse",
  "CLS-Klasse",
  "E-Klasse",
  "EQC-Klasse",
  "EQC",
  "EQS-Klasse",
  "EQS SUV",
  "GLB-Klasse",
  "GLC-Klasse",
  "GLE-Klasse",
  "GLS-Klasse",
  "GT-Klasse",
  "S-Klasse",
  "SL-Klasse",
  "V-Klasse",
  "X-Klasse",
  "Porsche 911 Turbo",
  "Porsche Taycan",
  "Rolls-Royce Ghost",
  "Rolls-Royce Cullinan",
  "Bentley Continental GT Speed",
  "Bentley Continental GTC Speed",
  "Lamborghini Urus SE",
  "P530",
  "smart #1",
  "smart #3",
]);

// chassis code → canonical Mercedes model tag
const CHASSIS_TO_MODEL = {
  "W 463": "G-Klasse",
  "W 463A": "G-Klasse",
  "W 465": "G-Klasse",
  "W 222": "S-Klasse",
  "W 223": "S-Klasse",
  "V 222": "S-Klasse",
  "V 223": "S-Klasse",
  "X 222": "S-Klasse",
  "X 223": "S-Klasse",
  "Z 223": "S-Klasse", // Maybach S — folded into S-Klasse (no separate Maybach model in UI)
  "C 217": "S-Klasse",
  "A 217": "S-Klasse", // S-Coupe / S-Cabrio
  "V 297": "EQS-Klasse",
  "X 297": "EQS-Klasse",
  "X 296": "EQS SUV",
  "R 230": "SL-Klasse",
  "R 231": "SL-Klasse",
  "R 232": "SL-Klasse",
  "X 290": "GT-Klasse",
  "C 190": "GT-Klasse",
  "R 190": "GT-Klasse",
  "C 192": "GT-Klasse",
  "W 177": "A-Klasse",
  "V 177": "A-Klasse",
  "W 205": "C-Klasse",
  "S 205": "C-Klasse",
  "A 205": "C-Klasse",
  "C 205": "C-Klasse",
  "W 206": "C-Klasse",
  "S 206": "C-Klasse",
  "A 206": "C-Klasse",
  "C 206": "C-Klasse",
  "C 257": "CLS-Klasse",
  "X 257": "CLS-Klasse",
  "W 213": "E-Klasse",
  "S 213": "E-Klasse",
  "A 238": "E-Klasse",
  "C 238": "E-Klasse",
  "W 214": "E-Klasse",
  "S 214": "E-Klasse",
  "N 293": "EQC",
  "X 247": "GLB-Klasse",
  "X 253": "GLC-Klasse",
  "C 253": "GLC-Klasse",
  "X 254": "GLC-Klasse",
  "C 254": "GLC-Klasse",
  "V 167": "GLE-Klasse",
  "C 167": "GLE-Klasse",
  "C 292": "GLE-Klasse",
  "X 166": "GLS-Klasse",
  "X 167": "GLS-Klasse",
  "W 447": "V-Klasse",
  "V 447": "V-Klasse",
  "W 470": "X-Klasse",
};

function chassisFromTitle(p) {
  for (const t of [p.titleEn, p.titleUa]) {
    if (!t) continue;
    const m = t.match(CHASSIS_TITLE);
    if (m) return norm(m[1]);
  }
  return null;
}

const products = await prisma.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
  },
  select: { id: true, sku: true, titleEn: true, titleUa: true, tags: true },
});
console.log(`Total Brabus products: ${products.length}`);

const changes = [];
for (const p of products) {
  const chassis = chassisFromTitle(p);
  if (!chassis) continue;
  const correctModel = CHASSIS_TO_MODEL[chassis];
  if (!correctModel) continue;

  const tags = p.tags || [];
  const currentModelTags = tags.filter((t) => ALL_MODEL_KEYS.has(t));
  const wrong = currentModelTags.filter((t) => t !== correctModel);
  const missing = currentModelTags.includes(correctModel) ? [] : [correctModel];
  if (wrong.length === 0 && missing.length === 0) continue;

  const newTags = [...tags.filter((t) => !wrong.includes(t)), ...missing];
  changes.push({
    id: p.id,
    sku: p.sku,
    chassis,
    correctModel,
    removed: wrong,
    added: missing,
    oldTags: tags,
    newTags,
    title: (p.titleEn || p.titleUa || "").slice(0, 90),
  });
}

console.log(`\nPlanned changes: ${changes.length}`);
const byModel = new Map();
for (const c of changes) {
  const key = `${c.chassis} → ${c.correctModel} (remove: ${c.removed.join(",") || "—"})`;
  byModel.set(key, (byModel.get(key) || 0) + 1);
}
console.log("\nSummary by chassis → model:");
for (const [k, n] of [...byModel.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(4)}  ${k}`);
}

console.log("\nFirst 20 sample changes:");
for (const c of changes.slice(0, 20)) {
  console.log(
    `  [${c.chassis}] ${c.sku}  -${JSON.stringify(c.removed)} +${JSON.stringify(c.added)}  | ${c.title}`
  );
}

if (!APPLY) {
  console.log("\nDRY-RUN. Re-run with --apply to write changes.");
  await prisma.$disconnect();
  process.exit(0);
}

const backupDir = path.join(process.cwd(), "archive", "data-dumps");
fs.mkdirSync(backupDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `brabus-tags-backup-${ts}.json`);
fs.writeFileSync(
  backupPath,
  JSON.stringify(
    changes.map((c) => ({ id: c.id, sku: c.sku, oldTags: c.oldTags, newTags: c.newTags })),
    null,
    2
  )
);
console.log(`\nBackup written: ${backupPath}`);

console.log(`Applying ${changes.length} updates...`);
let n = 0;
for (const c of changes) {
  await prisma.shopProduct.update({ where: { id: c.id }, data: { tags: c.newTags } });
  n++;
  if (n % 25 === 0) console.log(`  ${n}/${changes.length}`);
}
console.log(`Done. Updated ${n} rows.`);

await prisma.$disconnect();
