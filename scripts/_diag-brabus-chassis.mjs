import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const CHASSIS_TAG = /^[A-Z]\s?\d{3}[A-Z]?$/;
const CHASSIS_TITLE = /[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/;
const norm = (v) => v.replace(/^([A-Z])\s*(\d)/, "$1 $2");

const MODEL_KEYS = new Set([
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
console.log("total brabus:", products.length);

const title = (x) => x.titleEn || x.titleUa || "";
function modelKey(x) {
  return (x.tags || []).find((t) => MODEL_KEYS.has(t)) || null;
}
function chassisKey(x) {
  const tag = (x.tags || []).find((t) => CHASSIS_TAG.test(t));
  if (tag) return norm(tag);
  for (const t of [x.titleEn, x.titleUa]) {
    if (!t) continue;
    const m = t.match(CHASSIS_TITLE);
    if (m) return norm(m[1]);
  }
  return null;
}

const G_OK = new Set(["W 463", "W 463A", "W 465"]);
const S_OK = new Set(["W 222", "W 223", "V 222", "V 223", "X 222", "X 223", "C 217", "A 217"]);

console.log("\n=== G-Klasse products with non-G chassis ===");
let nG = 0;
for (const x of products) {
  if (modelKey(x) !== "G-Klasse") continue;
  const c = chassisKey(x);
  if (!c || G_OK.has(c)) continue;
  nG++;
  console.log(`[${c}] ${x.sku} | ${title(x).slice(0, 120)}`);
  console.log(`    tags: ${JSON.stringify(x.tags)}`);
}
console.log("G violations:", nG);

console.log("\n=== S-Klasse products with non-S chassis ===");
let nS = 0;
for (const x of products) {
  if (modelKey(x) !== "S-Klasse") continue;
  const c = chassisKey(x);
  if (!c || S_OK.has(c)) continue;
  nS++;
  console.log(`[${c}] ${x.sku} | ${title(x).slice(0, 120)}`);
  console.log(`    tags: ${JSON.stringify(x.tags)}`);
}
console.log("S violations:", nS);

await p.$disconnect();
