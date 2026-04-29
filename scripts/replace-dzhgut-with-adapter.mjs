/**
 * Burger Motorsports — replace "джгут" with "адаптер" in UA descriptions.
 *
 * Original EN distinguishes:
 *   - "harness" = wiring assembly (bundle of wires + plug-and-play connectors)
 *   - "connectors" = individual plugs
 * Current translation uses "джгут" for harness and "роз'єми" for connectors —
 * semantically right, but "джгут" is colloquially associated with medical
 * tourniquets in Ukrainian. "Адаптер" is the cleaner automotive term and
 * shares "джгут"'s gender (masculine 2nd-declension hard stem) so demonstratives
 * and adjectives ("цей джгут", "опціональний джгут") stay valid.
 *
 * All inflected forms handled. Idempotent.
 *
 * Usage:
 *   node scripts/replace-dzhgut-with-adapter.mjs --dry-run --slug burger-...
 *   node scripts/replace-dzhgut-with-adapter.mjs                # apply to all
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

// Map of "джгут" forms to "адаптер" forms (both masc 2nd declension hard stem).
// Order matters — longest endings first so we don't shadow them.
const FORM_MAP = [
  ['джгутами', 'адаптерами'],   // instr.pl
  ['джгутах', 'адаптерах'],     // loc.pl
  ['джгутам', 'адаптерам'],     // dat.pl
  ['джгутів', 'адаптерів'],     // gen.pl
  ['джгутом', 'адаптером'],     // instr.sg
  ['джгута', 'адаптера'],       // gen.sg
  ['джгуту', 'адаптеру'],       // dat.sg
  ['джгуті', 'адаптері'],       // loc.sg
  ['джгути', 'адаптери'],       // nom.pl, acc.pl
  ['джгут', 'адаптер'],         // nom.sg, acc.sg
];

// JS \b is ASCII-only — for Cyrillic boundaries we use explicit
// "not a letter" lookbehind/lookahead. Letters = Cyrillic + Latin.
const NOT_LETTER = '(?:[^а-яіїєґА-ЯІЇЄҐa-zA-Z]|^|$)';
const NOT_LETTER_LB = '(?<![а-яіїєґА-ЯІЇЄҐa-zA-Z])';
const NOT_LETTER_LA = '(?![а-яіїєґА-ЯІЇЄҐa-zA-Z])';

function preserveCase(matched, replacement) {
  if (matched[0] === matched[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function replaceAll(text) {
  if (!text) return { text, changes: 0 };
  let t = text;
  let totalChanges = 0;
  for (const [from, to] of FORM_MAP) {
    const rx = new RegExp(`${NOT_LETTER_LB}(${from})${NOT_LETTER_LA}`, 'gi');
    let count = 0;
    t = t.replace(rx, (m) => {
      count++;
      return preserveCase(m, to);
    });
    if (count > 0) totalChanges += count;
  }
  return { text: t, changes: totalChanges };
}

async function main() {
  console.log(`🔁 Burger "джгут" → "адаптер" ${DRY_RUN ? '(DRY RUN)' : '(WRITING)'}`);
  console.log('='.repeat(60));

  const where = { brand: 'Burger Motorsports' };
  if (SLUG) where.slug = SLUG;

  const products = await prisma.shopProduct.findMany({
    where,
    select: { id: true, slug: true, bodyHtmlUa: true },
  });
  console.log(`Total: ${products.length}`);

  let touched = 0;
  let totalReplacements = 0;
  const samples = [];
  for (const p of products) {
    const ua = p.bodyHtmlUa || '';
    const { text, changes } = replaceAll(ua);
    if (changes === 0) continue;
    touched++;
    totalReplacements += changes;
    if (samples.length < 3) {
      samples.push({ slug: p.slug, before: ua, after: text, changes });
    }
    if (!DRY_RUN) {
      await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlUa: text } });
    }
  }
  console.log(`\n=== Summary ===`);
  console.log(`Touched: ${touched}, Total replacements: ${totalReplacements}`);
  for (const s of samples) {
    console.log(`\n--- ${s.slug} (${s.changes} changes) ---`);
    // show first replacement context
    const idx = s.before.toLowerCase().indexOf('джгут');
    if (idx >= 0) {
      const ctxBefore = s.before.slice(Math.max(0, idx - 40), idx + 50);
      // find the same passage in 'after' — look at same offset
      const ctxAfter = s.after.slice(Math.max(0, idx - 40), idx + 50);
      console.log(`  BEFORE: ...${ctxBefore}...`);
      console.log(`  AFTER:  ...${ctxAfter}...`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
