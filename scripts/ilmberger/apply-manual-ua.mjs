/**
 * Apply hand-written UA translations to ShopProduct rows.
 *
 * Reads a JSON file shaped as:
 *   {
 *     "ilmberger-cg-cal-003-1xr20": {
 *       "titleUa": "...",
 *       "shortDescUa": "...",
 *       "bodyHtmlUa": "<h2>...</h2>...",
 *       "categoryUa": "...",                  // optional
 *       "seoTitleUa": "...",                  // optional
 *       "seoDescriptionUa": "..."             // optional
 *     },
 *     ...
 *   }
 *
 * Updates only the keys present (UA-only) — never touches EN side.
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/apply-manual-ua.mjs tmp/ilmberger-ua-batch-1.json
 *   node --env-file=.env.local scripts/ilmberger/apply-manual-ua.mjs tmp/ilmberger-ua-batch-1.json --dry-run
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const FILE = argv.find((a) => !a.startsWith("--"));
if (!FILE) {
  console.error("Usage: node apply-manual-ua.mjs <translations.json> [--dry-run]");
  process.exit(1);
}

const data = JSON.parse(readFileSync(FILE, "utf-8"));
const slugs = Object.keys(data);
console.log(`📂 Loaded ${slugs.length} translations from ${FILE}`);

const prisma = new PrismaClient();
let updated = 0;
let failed = 0;
try {
  for (const slug of slugs) {
    const t = data[slug];
    const update = {};
    for (const k of [
      "titleUa",
      "shortDescUa",
      "bodyHtmlUa",
      "categoryUa",
      "seoTitleUa",
      "seoDescriptionUa",
    ]) {
      if (typeof t[k] === "string" && t[k].length > 0) update[k] = t[k];
    }
    if (Object.keys(update).length === 0) {
      console.log(`  ⏭  ${slug} (no UA fields)`);
      continue;
    }
    if (DRY) {
      console.log(`  ✏️  ${slug} would update ${Object.keys(update).join(", ")}`);
      console.log(`     titleUa: ${update.titleUa ?? "(unchanged)"}`);
    } else {
      try {
        await prisma.shopProduct.update({ where: { slug }, data: update });
        updated++;
        console.log(`  ✅ ${slug}  →  ${update.titleUa ?? "(title unchanged)"}`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${slug} FAILED: ${e.message}`);
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
console.log(`\n${DRY ? "DRY-RUN " : ""}Updated ${updated}/${slugs.length}, failed ${failed}`);
