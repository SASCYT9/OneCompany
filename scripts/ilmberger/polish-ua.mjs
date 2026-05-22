/**
 * Polish UA translations for the 70 newly-translated Ilmberger products:
 *   1. Replace the repetitive marketing-talk final paragraph with a tighter,
 *      less-calqued Ukrainian version.
 *   2. Fix specific literal-translation calques.
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/polish-ua.mjs --dry-run
 *   node --env-file=.env.local scripts/ilmberger/polish-ua.mjs
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

const FILES = [
  "tmp/ilmberger-bmw-s1000xr-2024.json",
  "tmp/ilmberger-bmw-m1000xr-2024.json",
  "tmp/ilmberger-bmw-s1000r-2025.json",
  "tmp/ilmberger-bmw-m1000r-2025.json",
];
const skuSet = new Set();
for (const f of FILES) {
  const arr = JSON.parse(readFileSync(f, "utf-8"));
  for (const p of arr) skuSet.add(p.sku);
}
const slugs = [...skuSet].map((sku) => "ilmberger-" + sku.toLowerCase().replace(/[.\s]+/g, "-"));

const NEW_FINAL_PARAGRAPH =
  "<p>Карбонова деталь Ilmberger — це довгий, копіткий шлях, де точність вирішує все. У детальному репортажі про виробничий процес видно, як народжується кожен виріб: з пристрастю, фаховістю та інженерним досвідом. Так створюється карбон, який не виглядає масовим — і це відчувається у кожній деталі.</p>";

// Regex catches any <p>…</p> block that contains the "обирає карбонову деталь Ilmberger"
// trigger phrase — covers all 8 wording variants I produced.
const FINAL_PARAGRAPH_RE = /<p>[^<]*обирає\s+карбонову\s+деталь\s+Ilmberger[\s\S]*?<\/p>/g;

// Specific calque fixes — applied to bodyHtmlUa, shortDescUa, and seoDescriptionUa.
const CALQUE_FIXES = [
  ["Надайте своєму мотоциклу тієї особливості з", "Додайте своєму мотоциклу родзинки з"],
  [
    "Ексклюзивна близькість до вихлопу завдяки",
    "Максимально щільне прилягання до вихлопної системи завдяки",
  ],
  ["Постачання у готовому до встановлення стані", "Постачається готовим до встановлення"],
  // Stray "обирає" sentence variant that appears in shortDesc strips (no <p>)
];

function polish(html) {
  if (!html) return html;
  let out = html;
  let beforeLen = out.length;
  out = out.replace(FINAL_PARAGRAPH_RE, NEW_FINAL_PARAGRAPH);
  const finalReplaced = beforeLen !== out.length || FINAL_PARAGRAPH_RE.test(html);
  for (const [from, to] of CALQUE_FIXES) {
    out = out.split(from).join(to);
  }
  return { html: out, finalReplaced };
}

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { slug: { in: slugs } },
  select: {
    id: true,
    slug: true,
    sku: true,
    bodyHtmlUa: true,
    shortDescUa: true,
    seoDescriptionUa: true,
  },
});
console.log(`Loaded ${rows.length}/${slugs.length} new SKU rows from DB`);

let bodyUpdated = 0;
let shortUpdated = 0;
let seoUpdated = 0;
let finalParaSwaps = 0;
let calqueFixesCount = 0;
let rowsTouched = 0;

for (const r of rows) {
  const update = {};
  let touched = false;

  if (r.bodyHtmlUa) {
    const before = r.bodyHtmlUa;
    const { html, finalReplaced } = polish(before);
    if (html !== before) {
      update.bodyHtmlUa = html;
      bodyUpdated++;
      touched = true;
      if (finalReplaced) finalParaSwaps++;
      // Count calque hits
      for (const [from] of CALQUE_FIXES) {
        if (before.includes(from)) calqueFixesCount++;
      }
    }
  }
  if (r.shortDescUa) {
    const before = r.shortDescUa;
    let after = before;
    for (const [from, to] of CALQUE_FIXES) after = after.split(from).join(to);
    if (after !== before) {
      update.shortDescUa = after;
      shortUpdated++;
      touched = true;
    }
  }
  if (r.seoDescriptionUa) {
    const before = r.seoDescriptionUa;
    let after = before;
    for (const [from, to] of CALQUE_FIXES) after = after.split(from).join(to);
    if (after !== before) {
      update.seoDescriptionUa = after;
      seoUpdated++;
      touched = true;
    }
  }

  if (!touched) continue;
  rowsTouched++;

  if (DRY) {
    console.log(`  [DRY] ${r.sku} — fields: ${Object.keys(update).join(", ")}`);
  } else {
    await prisma.shopProduct.update({ where: { id: r.id }, data: update });
    console.log(`  ✅ ${r.sku} — fields: ${Object.keys(update).join(", ")}`);
  }
}

console.log(`\n${DRY ? "[DRY] " : ""}Rows touched: ${rowsTouched}/${rows.length}`);
console.log(`  bodyHtmlUa updated: ${bodyUpdated}`);
console.log(`  shortDescUa updated: ${shortUpdated}`);
console.log(`  seoDescriptionUa updated: ${seoUpdated}`);
console.log(`  Final-paragraph swaps: ${finalParaSwaps}`);
console.log(`  Calque fixes applied: ${calqueFixesCount}`);

await prisma.$disconnect();
