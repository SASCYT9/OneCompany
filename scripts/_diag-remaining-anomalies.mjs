import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const CHASSIS_TITLE = /[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/;
const norm = (v) => v.replace(/^([A-Z])\s*(\d)/, "$1 $2");
const MODEL_KEYS = new Set([
  "G-Klasse",
  "A-Klasse",
  "C-Klasse",
  "CLS-Klasse",
  "E-Klasse",
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
]);

const products = await p.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
  },
  select: { sku: true, titleEn: true, titleUa: true, tags: true },
});

function modelKey(x) {
  return (x.tags || []).find((t) => MODEL_KEYS.has(t)) || null;
}
function chassisKey(x) {
  for (const t of [x.titleEn, x.titleUa]) {
    if (!t) continue;
    const m = t.match(CHASSIS_TITLE);
    if (m) return norm(m[1]);
  }
  return null;
}

const targets = [
  ["GLB-Klasse", "W 177"],
  ["GLC-Klasse", "W 206"],
  ["GT-Klasse", "C 192"],
  ["SL-Klasse", "C 192"],
  ["SL-Klasse", "X 290"],
];
for (const [m, c] of targets) {
  console.log(`\n=== model=${m} chassis=${c} ===`);
  for (const x of products) {
    if (modelKey(x) !== m) continue;
    if (chassisKey(x) !== c) continue;
    console.log(`  ${x.sku} | ${(x.titleEn || x.titleUa || "").slice(0, 110)}`);
    console.log(`    tags: ${JSON.stringify(x.tags)}`);
  }
}
await p.$disconnect();
