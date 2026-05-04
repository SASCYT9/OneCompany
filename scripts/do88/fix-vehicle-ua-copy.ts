/**
 * Surgical UA-copy sweep for DO88 products surfaced via vehicle fitment.
 * Targets the 9 known defects identified by audit:
 *   - Swedish leftover "Stycken/stycken" → "шт."
 *   - English "Suits/Fits" → "Підходить для"
 *   - " and " between two vehicle clauses → " та "
 *   - lowercase Cyrillic "турбо" inside CAPS Latin tech-strings → "Turbo"
 *   - "Muffler" (verb-form, not branded) — left as-is (tuning jargon)
 *
 * Does not touch EN copy. Does not touch SKUs / chassis IDs / brand badges.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Patch = (s: string) => string;

const titlePatches: Patch[] = [
  (s) => s.replace(/\((\d+)\s+[Ss]tycken\)/g, '($1 шт.)'),
  (s) => s.replace(/\bSuits\s+/g, 'Підходить для '),
  (s) => s.replace(/\bFits\s+/g, 'Підходить для '),
  // " and " between two clauses where each side is a vehicle/brand mention.
  // Conservative: only replace when surrounded by uppercase letter or digit
  // (typical for "Mk7 Golf R and Audi 8V S3" pattern).
  (s) => s.replace(/(\b\w*[A-Z0-9]\w*)\s+and\s+(\w*[A-Z]\w*)/g, '$1 та $2'),
  // Lowercase Cyrillic "турбо" sandwiched between latin tokens (tech strings).
  // \b doesn't recognize Cyrillic word boundaries in JS regex, so anchor by
  // explicit surrounding context instead.
  (s) => s.replace(/(Garrett\s+PowerMax)\s+турбо(?=\s)/gi, '$1 Turbo'),
  (s) => s.replace(/(Stage\s+\d)\s+турбо(?=\s)/gi, '$1 Turbo'),
  (s) => s.replace(/(\(MQB\))\s+турбо(?=\s)/g, '$1 Turbo'),
  (s) => s.replace(/(GEN4\))\s+турбо(?=\s)/g, '$1 Turbo'),
  // Generic: "турбо" preceded by a Latin-uppercase token (chassis/brand code).
  (s) => s.replace(/([A-Z][A-Z0-9]*)\s+турбо(?=\s)/g, '$1 Turbo'),
  // "турбо" preceded by a parenthesised tech bracket like "(245HK)".
  (s) => s.replace(/(\))\s+турбо(?=\s)/g, '$1 Turbo'),
];

const bodyPatches: Patch[] = [
  (s) => s.replace(/(\b\w*[A-Z0-9]\w*)\s+and\s+(\w*[A-Z]\w*)/g, '$1 та $2'),
];

async function main() {
  const all = await prisma.shopProduct.findMany({
    where: { brand: 'DO88' },
    select: { id: true, sku: true, titleUa: true, bodyHtmlUa: true },
  });

  let touched = 0;
  for (const p of all) {
    const oldTitle = p.titleUa ?? '';
    const oldBody = p.bodyHtmlUa ?? '';
    let newTitle = oldTitle;
    for (const fn of titlePatches) newTitle = fn(newTitle);
    let newBody = oldBody;
    for (const fn of bodyPatches) newBody = fn(newBody);

    if (newTitle !== oldTitle || newBody !== oldBody) {
      touched++;
      await prisma.shopProduct.update({
        where: { id: p.id },
        data: { titleUa: newTitle, bodyHtmlUa: newBody },
      });
      if (newTitle !== oldTitle) {
        console.log(`  ${p.sku}`);
        console.log(`    -  ${oldTitle}`);
        console.log(`    +  ${newTitle}`);
      } else if (newBody !== oldBody) {
        console.log(`  ${p.sku} (body only)`);
      }
    }
  }
  console.log(`\nUpdated ${touched} of ${all.length} DO88 products.`);
  await prisma.$disconnect();
}

main();
