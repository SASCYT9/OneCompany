import { PrismaClient } from "@prisma/client";
import fs from "fs";
const p = new PrismaClient();

// Read backup to compare before/after
const backups = fs
  .readdirSync("archive/data-dumps")
  .filter(
    (f) => f.startsWith("brabus-tags-backup-") || f.startsWith("brabus-chassis-tags-backup-")
  );
const allBackup = new Map();
for (const f of backups) {
  const arr = JSON.parse(fs.readFileSync(`archive/data-dumps/${f}`, "utf-8"));
  for (const r of arr) {
    if (!allBackup.has(r.sku)) allBackup.set(r.sku, { oldTags: r.oldTags, newTagsHistory: [] });
    allBackup.get(r.sku).newTagsHistory.push({ file: f, newTags: r.newTags });
  }
}

const products = await p.shopProduct.findMany({
  where: {
    OR: [
      { titleEn: { contains: "Bentley", mode: "insensitive" } },
      { titleEn: { contains: "GTC", mode: "insensitive" } },
      { tags: { has: "Bentley" } },
      { tags: { has: "Bentley Continental GTC Speed" } },
      { tags: { has: "Bentley Continental GT Speed" } },
    ],
  },
  select: { sku: true, titleEn: true, titleUa: true, tags: true },
});
console.log(`Found ${products.length} Bentley-related products`);
for (const x of products) {
  const b = allBackup.get(x.sku);
  console.log(`\n  ${x.sku} | ${(x.titleEn || x.titleUa || "").slice(0, 90)}`);
  console.log(`    NOW:  ${JSON.stringify(x.tags)}`);
  if (b) {
    console.log(
      `    WAS:  ${JSON.stringify(b.oldTags)}  (touched by: ${b.newTagsHistory.map((h) => h.file).join(", ")})`
    );
  } else {
    console.log(`    (not touched by recent scripts)`);
  }
}
await p.$disconnect();
