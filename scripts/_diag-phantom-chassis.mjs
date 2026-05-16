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

let n = 0;
for (const x of products) {
  const tags = x.tags || [];
  const chassisTag = tags.find((t) => CHASSIS_TAG.test(t));
  if (!chassisTag) continue;
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
  if (norm(chassisTag) === titleChassis) continue;
  n++;
  console.log(
    `  tag=${chassisTag} title=${titleChassis}  ${x.sku} | ${(x.titleEn || "").slice(0, 80)}`
  );
  console.log(`    tags: ${JSON.stringify(tags)}`);
}
console.log(`\nPhantom chassis-tag mismatches: ${n}`);
await p.$disconnect();
