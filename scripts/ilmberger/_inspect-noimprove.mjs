import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const NEW_FILES = [
  "tmp/ilmberger-bmw-s1000xr-2024.json",
  "tmp/ilmberger-bmw-m1000xr-2024.json",
  "tmp/ilmberger-bmw-s1000r-2025.json",
  "tmp/ilmberger-bmw-m1000r-2025.json",
];
const newSkus = new Set();
for (const f of NEW_FILES) for (const p of JSON.parse(readFileSync(f, "utf-8"))) newSkus.add(p.sku);

const KEEP =
  /^(BMW|Ducati|Ilmberger|Panigale|Streetfighter|Diavel|XDiavel|Carbon|RR|XR|MY|TÜV|ABE|OEM|ISO|UV|WSBK|EWC|Formula|Prepreg|monoposto|biposto|M1R)$/i;
const score = (text) => {
  if (!text) return 0;
  const t = text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const runs = t.match(/[A-Za-z][A-Za-z\-']{2,}/g) ?? [];
  let s = 0;
  const samples = [];
  for (const r of runs) {
    if (KEEP.test(r)) continue;
    if (/^[A-Z]{2,5}$/.test(r)) continue;
    if (/^S\d|^M\d/.test(r)) continue;
    s++;
    if (samples.length < 8) samples.push(r);
  }
  return { score: s, samples };
};

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
  select: { sku: true, titleUa: true, shortDescUa: true, bodyHtmlUa: true },
});
const problems = [];
for (const r of rows) {
  if (newSkus.has(r.sku)) continue;
  const s = score(r.shortDescUa);
  if (s.score === 0) continue;
  const b = score(r.bodyHtmlUa);
  problems.push({
    sku: r.sku,
    titleUa: r.titleUa,
    shortScore: s.score,
    shortSamples: s.samples,
    bodyScore: b.score,
    bodySamples: b.samples,
  });
}
problems.sort((a, b) => b.bodyScore - a.bodyScore);
console.log(`Found ${problems.length} products still with EN in shortDescUa`);
console.log(
  `Of those, ${problems.filter((p) => p.bodyScore >= 5).length} also have EN in bodyHtmlUa`
);
console.log("\nTop 15 by bodyScore:");
for (const p of problems.slice(0, 15)) {
  console.log(
    `  ${p.sku.padEnd(20)} body=${String(p.bodyScore).padStart(3)} short=${String(p.shortScore).padStart(2)}`
  );
  console.log(`    title: ${p.titleUa}`);
  console.log(`    body samples: ${p.bodySamples.join(", ")}`);
}
await prisma.$disconnect();
