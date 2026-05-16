// Title is authoritative: "Continental GTC" → "Bentley Continental GTC Speed",
// "Continental GT" (no C) → "Bentley Continental GT Speed".
//   node --env-file=.env.local scripts/fix-bentley-gtc-tags.mjs            # dry-run
//   node --env-file=.env.local scripts/fix-bentley-gtc-tags.mjs --apply
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const products = await prisma.shopProduct.findMany({
  where: { tags: { has: "Bentley" } },
  select: { id: true, sku: true, titleEn: true, titleUa: true, tags: true },
});

const changes = [];
for (const x of products) {
  const t = (x.titleEn || "") + " " + (x.titleUa || "");
  const isGTC = /Continental\s+GTC\b/i.test(t);
  const isGT = !isGTC && /Continental\s+GT\b/i.test(t);
  let correct = null;
  if (isGTC) correct = "Bentley Continental GTC Speed";
  else if (isGT) correct = "Bentley Continental GT Speed";
  if (!correct) continue;

  const tags = x.tags || [];
  const wrong = tags.filter(
    (tg) =>
      (tg === "Bentley Continental GT Speed" || tg === "Bentley Continental GTC Speed") &&
      tg !== correct
  );
  const hasCorrect = tags.includes(correct);
  if (wrong.length === 0 && hasCorrect) continue;

  const newTags = [...tags.filter((tg) => !wrong.includes(tg))];
  if (!hasCorrect) newTags.push(correct);
  changes.push({
    id: x.id,
    sku: x.sku,
    removed: wrong,
    added: hasCorrect ? [] : [correct],
    oldTags: tags,
    newTags,
  });
}

console.log(`Planned: ${changes.length}`);
for (const c of changes.slice(0, 10)) {
  console.log(`  ${c.sku}: -${JSON.stringify(c.removed)} +${JSON.stringify(c.added)}`);
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
  `bentley-tags-backup-${ts}.json`
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
}
console.log(`Done. Updated ${n} rows.`);
await prisma.$disconnect();
