/**
 * Burger Motorsports — pre-translate cleanup of bodyHtmlEn
 *
 * Strips junk that's irrelevant on our shop and would only waste tokens
 * (and make UA translations awkward) before we send to Gemini:
 *   - Sentences mentioning "click here" / "available here" (link to burgertuning.com)
 *   - External app/install/download/youtube links
 *   - Marketing CTAs: "Save $X", "Free Shipping", "Order now", "for FREE"
 *   - Decorative emoji 🔒 ⚠ ★ etc.
 *   - "Optional X. Click here..." promo sub-clauses
 *   - Trailing FAQ boilerplate ("What is a JB4?", "Is the JB4 a real tune?")
 *   - Dyno-video credit lines ("DRAGY TIMES", "G80 M3 JB4 1/4 mile (stock turbos)")
 *
 * Idempotent. Run with --dry-run first to preview.
 *
 * Usage:
 *   node scripts/clean-burger-pre-translate.mjs --dry-run         # preview
 *   node scripts/clean-burger-pre-translate.mjs                   # apply
 *   node scripts/clean-burger-pre-translate.mjs --slug burger-... # one product
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
const LIMIT = parseInt(getArg('--limit', '0'), 10) || 0;
const DRY_RUN = args.includes('--dry-run');
const SHOW_SAMPLES = parseInt(getArg('--samples', '5'), 10) || 5;

// ── Sentence splitter that handles decimals/abbreviations ──
function splitSentences(text) {
  // Protect decimals like 315.99 and common abbrevs
  const tmp = text
    .replace(/(\d)\.(\d)/g, '$1$2')
    .replace(/\b(Mr|Mrs|Dr|St|vs|i\.e|e\.g|etc|fig|ft|in|cm|mm|kg|lb|oz|ml|hp|whp|wtq|hr|min|sec|psi|nm|gpm|vol|temp|approx|cyl|inj|MAX|MIN)\./gi, '$1');
  // Sentence boundary: . ! ? followed by whitespace + uppercase letter or digit (next sentence start)
  const parts = tmp.split(/(?<=[.!?])(?:\s+|\n+)(?=[A-ZА-Я0-9])|\n{2,}/);
  return parts.map((p) => p.replace(//g, '.').replace(//g, '.').trim()).filter(Boolean);
}

// ── 1. Phrases — if a sentence contains any of these, drop the whole sentence ──
const DROP_IF_CONTAINS = [
  // External links
  /\bclick\s+here\b/i,
  /\bavailable\s+here\b/i,
  /\bDownload\s+(?:the\s+)?JB4PRO\b/i,
  /\bDownload\s+the\s+install\s+guide\b/i,
  /\bDownload\s+JB4PRO\s+for\b/i,
  // Marketing CTAs (broader sentence match)
  /\bOrder\s+now\b/i,
  /\bFree\s+Shipping\s+in\s+USA\b/i,
  /\bSave\s*\$\s*\d/i,
  /\bsave\s+\$\d/i, // lowercase variant
  /\bWhen you hit the checkout button\b/i,
  /\b(?:Buy|purchase)\s+now\b/i,
  /\bfor\s+FREE!?\b/i, // "...add to cart for FREE!"
  /\(\s*Financing\s+available\s*\)/i,
  // Self-referential dyno-video credits
  /^\s*(?:DRAGY\s+TIMES|G\d{2}\s+M\d\s+JB4)/i,
  /\bDyno\s+Results\s*$/i, // line ending with "Dyno Results"
  /\bstock\s+turbos\)\s*$/i,
];

// ── 2. Boilerplate Q&A sections — drop these entire blocks (text from header to next major section or end) ──
// We do this BEFORE sentence splitting because they span sentences.
const BOILERPLATE_QA_HEADERS = [
  /\bWhat\s+is\s+(?:a|the)\s+JB4\??/i,
  /\bIs\s+the\s+JB4\s+a\s+real\s+tune\??/i,
  /\bWhat\s+is\s+(?:a|the)\s+JB\+\??/i,
];

function dropTrailingBoilerplateQA(text) {
  // For each header, find earliest occurrence; if found, truncate text up to that point.
  let earliest = -1;
  for (const rx of BOILERPLATE_QA_HEADERS) {
    const m = text.match(rx);
    if (m && (earliest === -1 || m.index < earliest)) earliest = m.index;
  }
  if (earliest === -1) return text;
  // Keep everything before, drop from that point onward (the QA + everything after)
  return text.slice(0, earliest).trim();
}

// ── 3. Decorative emoji + unicode adornments ──
function stripEmoji(text) {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[★☆⚡✓✔✗✘⭐]/g, '')
    .replace(/[🔒⚠]/g, '');
}

// ── 4. Mid-sentence parenthetical removals ──
const MID_SENTENCE_RX = [
  /\s*\([^)]{0,200}\b(?:click here|available here|see below|see above|sold separately)\b[^)]{0,200}\)/gi,
  /\s*[-–—]\s*\b(?:click here|available here)\b[^.!?\n]{0,100}/gi,
];

// ── 5. Whitespace tidy ──
function tidyWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

export function cleanText(input) {
  if (!input) return input;
  let t = input;

  t = stripEmoji(t);
  t = dropTrailingBoilerplateQA(t);
  for (const rx of MID_SENTENCE_RX) t = t.replace(rx, '');

  // Sentence-level filtering
  const sents = splitSentences(t);
  const kept = sents.filter((s) => {
    if (s.length < 3) return false;
    return !DROP_IF_CONTAINS.some((rx) => rx.test(s));
  });
  t = kept.join(' ');

  t = tidyWhitespace(t);
  return t;
}

async function main() {
  console.log(`🧹 Burger Motorsports — pre-translate cleaner ${DRY_RUN ? '(DRY RUN)' : '(WRITING)'}`);
  console.log('='.repeat(70));

  const where = { brand: 'Burger Motorsports' };
  if (SLUG) where.slug = SLUG;

  const products = await prisma.shopProduct.findMany({
    where,
    select: { id: true, slug: true, titleEn: true, bodyHtmlEn: true },
    orderBy: { priceUsd: 'desc' },
  });
  const queue = LIMIT > 0 ? products.slice(0, LIMIT) : products;
  console.log(`Total: ${products.length} | this run: ${queue.length}`);

  let totalBefore = 0;
  let totalAfter = 0;
  let touched = 0;
  let unchanged = 0;
  const samples = [];

  for (const p of queue) {
    const before = p.bodyHtmlEn || '';
    const after = cleanText(before);
    totalBefore += before.length;
    totalAfter += after.length;
    if (before === after) {
      unchanged++;
      continue;
    }
    touched++;

    if (samples.length < SHOW_SAMPLES) {
      samples.push({
        slug: p.slug,
        title: p.titleEn,
        before,
        after,
        beforeLen: before.length,
        afterLen: after.length,
        saved: before.length - after.length,
        pct: Math.round(((before.length - after.length) / before.length) * 100),
      });
    }

    if (!DRY_RUN) {
      await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlEn: after } });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Touched: ${touched}, Unchanged: ${unchanged}`);
  const saved = totalBefore - totalAfter;
  const pct = totalBefore ? Math.round((saved / totalBefore) * 100) : 0;
  console.log(`Total chars: ${totalBefore.toLocaleString()} → ${totalAfter.toLocaleString()} (saved ${saved.toLocaleString()}, ${pct}%)`);

  console.log(`\n=== Sample diffs (${samples.length}) ===`);
  for (const s of samples) {
    console.log(`\n--- ${s.slug} (saved ${s.saved} chars / ${s.pct}%) ---`);
    console.log(`title: ${s.title?.slice(0, 80)}`);
    console.log(`BEFORE [${s.beforeLen}]: ${s.before.slice(0, 800)}${s.before.length > 800 ? '…' : ''}`);
    console.log(`AFTER  [${s.afterLen}]: ${s.after.slice(0, 800)}${s.after.length > 800 ? '…' : ''}`);
  }
}

// Only run main() when script is invoked directly, not when imported elsewhere.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('clean-burger-pre-translate.mjs');
if (invokedDirectly) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
