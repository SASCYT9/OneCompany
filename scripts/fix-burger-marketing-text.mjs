/**
 * Burger Motorsports — fix marketing text in descriptions.
 *
 * - Replaces "ОБИДВІ ВЕРСІЇ ТЕПЕР ВКЛЮЧАЮТЬ БЕЗКОШТОВНИЙ ДОДАТОК JB4PRO!"
 *   (and EN counterpart "BOTH VERSIONS NOW INCLUDE THE FREE JB4PRO APP!")
 *   with a single line "Додаток JB4PRO включений у вартість." / "JB4PRO app
 *   included." since we don't differentiate "two versions" — there's just
 *   one JB4PRO product.
 * - Drops paragraphs framing the JB4PRO board as an optional upgrade
 *   ("Також доступний з нашою новою платою JB4PRO..." and EN "Also available
 *   with our new JB4PRO board...") since we don't sell the board as a
 *   separate option.
 *
 * Idempotent.
 *
 * Usage:
 *   node scripts/fix-burger-marketing-text.mjs --dry-run --slug burger-...
 *   node scripts/fix-burger-marketing-text.mjs                # apply to all
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (name, dflt = null) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : dflt;
};
const SLUG = getArg('--slug', null);
const DRY_RUN = args.includes('--dry-run');

// ── Replacements ──
// Each entry: regex, replacement (or '' to drop), description
const UA_REPLACEMENTS = [
  // "ОБИДВІ ВЕРСІЇ ТЕПЕР ВКЛЮЧАЮТЬ БЕЗКОШТОВНИЙ ДОДАТОК JB4PRO!"
  // Replace the marketing exclamation with a calm in-stock note.
  {
    rx: /\s*ОБИДВІ\s+ВЕРСІЇ\s+ТЕПЕР\s+ВКЛЮЧАЮТЬ\s+БЕЗКОШТОВНИЙ\s+ДОДАТОК\s+JB4PRO!?\s*/gi,
    to: ' Додаток JB4PRO включений у вартість. ',
    desc: 'ОБИДВІ ВЕРСІЇ → "Додаток включений у вартість"',
  },
  // "Також доступний з нашою новою платою JB4PRO, яка включає [features]. Включає додаток JB4PRO!"
  // Drop the entire sentence/paragraph — we don't sell the board separately.
  // Match the sentence ending with "оновлень прошивки." or similar before "Включає додаток JB4PRO!"
  {
    rx: /\s*Також\s+доступний\s+з\s+нашою\s+новою\s+платою\s+JB4PRO[\s\S]*?оновлень\s+прошивки\.?\s*/gi,
    to: ' ',
    desc: 'Drop "Також доступний з новою платою JB4PRO..." paragraph',
  },
  // Standalone "Включає додаток JB4PRO!" exclamation (also marketing fluff after the board paragraph)
  {
    rx: /\s*Включає\s+додаток\s+JB4PRO!\s*/gi,
    to: ' ',
    desc: 'Drop standalone "Включає додаток JB4PRO!"',
  },
];

const EN_REPLACEMENTS = [
  {
    rx: /\s*BOTH\s+VERSIONS\s+NOW\s+INCLUDE\s+THE\s+FREE\s+JB4PRO\s+APP!?\s*/gi,
    to: ' JB4PRO app included. ',
    desc: 'BOTH VERSIONS → "JB4PRO app included"',
  },
  {
    rx: /\s*Also\s+available\s+with\s+(?:our\s+new\s+)?JB4PRO\s+board[\s\S]*?firmware\s+updates?\.?\s*/gi,
    to: ' ',
    desc: 'Drop "Also available with JB4PRO board..." paragraph',
  },
  {
    rx: /\s*Includes\s+the\s+JB4PRO\s+app!?\s*/gi,
    to: ' ',
    desc: 'Drop standalone "Includes the JB4PRO app!"',
  },
];

function applyReplacements(text, replacements) {
  if (!text) return { text, changes: [] };
  let t = text;
  const changes = [];
  for (const { rx, to, desc } of replacements) {
    const before = t;
    t = t.replace(rx, to);
    if (t !== before) {
      changes.push(desc);
    }
  }
  // Tidy up double spaces / spaces before punctuation introduced by replacements
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1');
  // Clean up empty <p></p> or paragraphs with only whitespace
  t = t.replace(/<p>\s*<\/p>/gi, '').replace(/<p>\s+<\/p>/gi, '');
  return { text: t.trim(), changes };
}

async function main() {
  console.log(`🧼 Burger marketing text cleanup ${DRY_RUN ? '(DRY RUN)' : '(WRITING)'}`);
  console.log('='.repeat(60));

  const where = { brand: 'Burger Motorsports' };
  if (SLUG) where.slug = SLUG;

  const products = await prisma.shopProduct.findMany({
    where,
    select: { id: true, slug: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log(`Total: ${products.length}`);

  let touchedEn = 0, touchedUa = 0;
  const allChanges = new Map();
  const samples = [];

  for (const p of products) {
    const enResult = applyReplacements(p.bodyHtmlEn || '', EN_REPLACEMENTS);
    const uaResult = applyReplacements(p.bodyHtmlUa || '', UA_REPLACEMENTS);

    if (enResult.changes.length === 0 && uaResult.changes.length === 0) continue;

    [...enResult.changes, ...uaResult.changes].forEach((c) => {
      allChanges.set(c, (allChanges.get(c) || 0) + 1);
    });

    if (samples.length < 3) {
      samples.push({
        slug: p.slug,
        beforeUa: p.bodyHtmlUa || '',
        afterUa: uaResult.text,
        changes: [...enResult.changes, ...uaResult.changes],
      });
    }

    if (!DRY_RUN) {
      const data = {};
      if (enResult.changes.length > 0) data.bodyHtmlEn = enResult.text;
      if (uaResult.changes.length > 0) data.bodyHtmlUa = uaResult.text;
      if (Object.keys(data).length > 0) {
        await prisma.shopProduct.update({ where: { id: p.id }, data });
      }
    }
    if (enResult.changes.length > 0) touchedEn++;
    if (uaResult.changes.length > 0) touchedUa++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Touched EN: ${touchedEn}, Touched UA: ${touchedUa}`);
  console.log(`\nChanges by rule:`);
  for (const [desc, count] of allChanges) {
    console.log(`  ${count}× ${desc}`);
  }

  if (samples.length > 0) {
    console.log(`\n=== Sample diffs ===`);
    for (const s of samples) {
      console.log(`\n--- ${s.slug} ---`);
      console.log(`Changes: ${s.changes.join(', ')}`);
      console.log(`UA len: ${s.beforeUa.length} → ${s.afterUa.length}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
