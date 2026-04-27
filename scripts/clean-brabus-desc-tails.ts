#!/usr/bin/env tsx
/*
 * Strip contact-form / related-product tail junk from Brabus product
 * descriptions.
 *
 * The earlier enrichment grabbed `<p>` tags from the brabus.com EN page,
 * which include a contact-form block ("You have a question? Feel free to
 * contact us!...") followed by names of related products from the page's
 * recommendation panel. None of that belongs in the product description.
 *
 * This script truncates the description (and bodyHtmlEn) at the first
 * occurrence of any tail-marker phrase. If no marker is present, the row
 * is left untouched.
 *
 * Usage:
 *   tsx scripts/clean-brabus-desc-tails.ts            (dry-run; default)
 *   tsx scripts/clean-brabus-desc-tails.ts --commit
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

/* Markers signal where the real description ends and form/recommendation
   junk begins. Order doesn't matter; we cut at the earliest match. */
const TAIL_MARKERS = [
  'You have a question?',
  'Feel free to contact us',
  'We look forward to your message',
  'Thank you for your interest',
  'Be part of',
  'For Your High-Performance Experience',
  'Contact us!',
  'Subscribe to our newsletter',
  'Follow Brabus',
  'Connect with us',
  'Find a dealer',
  'Where to buy',
  'Request a brochure',
  'Configure your',
  'Speak to an advisor',
  'Book a test',
  'Related products',
  'Similar products',
  'You might also like',
];

function findEarliestMarker(text: string): number {
  let earliest = -1;
  for (const m of TAIL_MARKERS) {
    const i = text.toLowerCase().indexOf(m.toLowerCase());
    if (i >= 0 && (earliest === -1 || i < earliest)) earliest = i;
  }
  return earliest;
}

function cleanText(text: string): string {
  if (!text) return text;
  const i = findEarliestMarker(text);
  if (i < 0) return text;
  /* Find the end of the sentence/paragraph before the marker so we don't
     leave a half-sentence behind. Backtrack to a sentence-ending char or
     opening of a `<p>` tag. */
  let end = i;
  /* Trim trailing whitespace / opening of marker sentence */
  while (end > 0 && /\s/.test(text[end - 1])) end--;
  /* If the marker sits inside an HTML paragraph, drop the entire paragraph. */
  if (text.slice(0, end).lastIndexOf('<p>') > text.slice(0, end).lastIndexOf('</p>')) {
    end = text.slice(0, end).lastIndexOf('<p>');
  }
  return text.slice(0, end).trim();
}

async function main() {
  console.log('=== Strip Brabus description tails ===');
  console.log('Mode:', COMMIT ? 'COMMIT' : 'DRY RUN');

  const all = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: { id: true, sku: true, longDescEn: true, bodyHtmlEn: true },
  });

  let touched = 0;
  let charsRemoved = 0;
  const samples: Array<{ sku: string; before: number; after: number }> = [];

  for (const p of all) {
    const oldLong = p.longDescEn || '';
    const oldHtml = p.bodyHtmlEn || '';
    const newLong = cleanText(oldLong);
    const newHtml = cleanText(oldHtml);
    if (newLong === oldLong && newHtml === oldHtml) continue;
    touched++;
    charsRemoved += (oldLong.length - newLong.length) + (oldHtml.length - newHtml.length);

    if (samples.length < 5) {
      samples.push({ sku: p.sku!, before: oldLong.length, after: newLong.length });
    }

    if (COMMIT) {
      await prisma.shopProduct.update({
        where: { id: p.id },
        data: { longDescEn: newLong, bodyHtmlEn: newHtml },
      });
    }
  }

  console.log(`\nProducts touched: ${touched}`);
  console.log(`Total chars removed: ${charsRemoved} (avg ${Math.round(charsRemoved / Math.max(touched,1))} per row)`);
  console.log('\nSample changes:');
  samples.forEach((s) => {
    console.log(`  ${s.sku}: ${s.before} → ${s.after} chars`);
  });

  /* Backup report */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const reportPath = path.join(backupDir, `brabus-desc-tail-${ts}${COMMIT ? '' : '-dryrun'}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ touched, charsRemoved, samples }, null, 2), 'utf-8');
  console.log(`\nReport: ${reportPath}`);

  if (!COMMIT) console.log('\n(dry-run) — pass --commit to apply.');
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
