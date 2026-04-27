#!/usr/bin/env tsx
/*
 * Translate Brabus product titles + descriptions EN → UA via DeepL.
 *
 * Targets only products with missing or very-short Ukrainian content. Real
 * UA copy that already exists is left alone.
 *
 * What gets translated for each product:
 *   - titleEn   → titleUa     (if titleUa empty or missing the vehicle suffix)
 *   - longDescEn → longDescUa  (if uaLen < 50 OR uaLen < enLen * 0.5)
 *   - bodyHtmlEn → bodyHtmlUa  (kept in sync with longDescUa)
 *
 * Uses DeepL with `tag_handling: html` + `preserve_formatting: 1` so the
 * <p> structure survives. Brand-specific terms (Monoblock, Widestar,
 * PowerXtra, vehicle codes like W 465 or C 217) are proper nouns and DeepL
 * passes them through unchanged.
 *
 * Usage:
 *   tsx scripts/translate-brabus-ua.ts --limit=5         (dry-run)
 *   tsx scripts/translate-brabus-ua.ts --commit          (translate all)
 *   tsx scripts/translate-brabus-ua.ts --commit --limit=20
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMMIT = process.argv.includes('--commit');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : (COMMIT ? Infinity : 5);
const CONCURRENCY = 8;

const DEEPL_KEY = process.env.DEEPL_AUTH_KEY;
if (!DEEPL_KEY) {
  console.error('Missing DEEPL_AUTH_KEY in .env');
  process.exit(1);
}
const DEEPL_URL = DEEPL_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

const VEHICLE_RE = /(mercedes|porsche|bentley|rolls|maybach|lamborghini|range\s?rover|smart|w\s?\d+|x\s?\d+|c\s?\d+|amg|gle|gls|gla|glb|glc|cls|sl-|sl\s|s-class|g-class|e-class|c-class)/i;

async function deepl(text: string, retries = 3): Promise<string> {
  if (!text || !text.trim()) return text;
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('target_lang', 'UK'); // DeepL uses UK for Ukrainian
  params.append('source_lang', 'EN');
  params.append('tag_handling', 'html');
  params.append('preserve_formatting', '1');
  /* Brabus terms that should never be translated. DeepL `non_splitting_tags`
     keeps them intact. We don't have HTML tags around them so we use a
     glossary-style approach via context tag. */
  params.append('formality', 'less');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(DEEPL_URL, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      if (res.status === 403) throw new Error('403 — invalid DeepL key');
      if (res.ok) {
        const data = await res.json();
        return data.translations?.[0]?.text || text;
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    } catch (err: any) {
      if (err.message.includes('403')) throw err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(`DeepL failed after ${retries} retries`);
}

/* Touch up DeepL output: it sometimes localises Brabus product names that
   should stay as proper nouns. Replace the most common drift. */
function postProcess(text: string): string {
  return text
    .replace(/Моноблок/gi, 'Monoblock')
    .replace(/Карбон/g, 'Carbon')
    .replace(/Велоур/gi, 'Velour') /* "велюр" is correct UA, but if DeepL emits this, fix it */
    .replace(/PowerXtra/gi, 'PowerXtra')
    .replace(/SportXtra/gi, 'SportXtra')
    .replace(/BoostXtra/gi, 'BoostXtra')
    .replace(/Widestar/gi, 'Widestar')
    .replace(/Masterpiece/gi, 'Masterpiece')
    .replace(/Brabus/gi, 'BRABUS');
}

async function main() {
  console.log('=== Brabus EN → UK translation ===');
  console.log('Mode:', COMMIT ? 'COMMIT' : `DRY RUN (limit ${LIMIT})`);
  console.log('DeepL endpoint:', DEEPL_URL);

  const all = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: {
      id: true, sku: true,
      titleEn: true, titleUa: true,
      longDescEn: true, longDescUa: true,
      bodyHtmlEn: true, bodyHtmlUa: true,
    },
  });

  /* Pick candidates that need UA work */
  const candidates = all.filter((p) => {
    const enLen = (p.longDescEn || '').length;
    const uaLen = (p.longDescUa || '').length;
    const titleUaMissingVeh =
      (p.titleEn && VEHICLE_RE.test(p.titleEn) && !VEHICLE_RE.test(p.titleUa || '')) ||
      !p.titleUa?.trim();
    const descNeedsTranslate = enLen > 50 && (uaLen < 50 || uaLen < enLen * 0.5);
    return titleUaMissingVeh || descNeedsTranslate;
  });

  const target = candidates.slice(0, LIMIT === Infinity ? candidates.length : LIMIT);
  console.log(`Candidates: ${candidates.length} | processing this run: ${target.length}`);

  const limit = pLimit(CONCURRENCY);
  let updated = 0;
  let titleOnly = 0;
  let descOnly = 0;
  let both = 0;
  const failures: Array<{ sku: string; error: string }> = [];
  const samples: Array<any> = [];

  await Promise.all(
    target.map((p) =>
      limit(async () => {
        try {
          const enLen = (p.longDescEn || '').length;
          const uaLen = (p.longDescUa || '').length;
          const updates: Record<string, unknown> = {};

          /* Title */
          if (
            (!p.titleUa?.trim()) ||
            (p.titleEn && VEHICLE_RE.test(p.titleEn) && !VEHICLE_RE.test(p.titleUa || ''))
          ) {
            const t = await deepl(p.titleEn || '');
            updates.titleUa = postProcess(t);
          }

          /* Description (long + html) */
          if (enLen > 50 && (uaLen < 50 || uaLen < enLen * 0.5)) {
            if (p.longDescEn) {
              const t = await deepl(p.longDescEn);
              updates.longDescUa = postProcess(t);
            }
            if (p.bodyHtmlEn) {
              const t = await deepl(p.bodyHtmlEn);
              updates.bodyHtmlUa = postProcess(t);
            }
          }

          if (!Object.keys(updates).length) return;

          const hasTitle = 'titleUa' in updates;
          const hasDesc = 'longDescUa' in updates || 'bodyHtmlUa' in updates;
          if (hasTitle && hasDesc) both++;
          else if (hasTitle) titleOnly++;
          else descOnly++;

          if (samples.length < 3) {
            samples.push({
              sku: p.sku,
              before: { titleUa: p.titleUa, descLen: uaLen },
              after: { titleUa: updates.titleUa ?? p.titleUa, descLen: typeof updates.longDescUa === 'string' ? updates.longDescUa.length : uaLen },
              uaPreview: typeof updates.longDescUa === 'string' ? updates.longDescUa.slice(0, 250) : null,
            });
          }

          if (COMMIT) {
            await prisma.shopProduct.update({ where: { id: p.id }, data: updates });
          }
          updated++;
        } catch (e: any) {
          failures.push({ sku: p.sku!, error: e.message });
        }
      }),
    ),
  );

  /* Save report */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `brabus-translate-${ts}${COMMIT ? '' : '-dryrun'}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ updated, titleOnly, descOnly, both, failures, samples }, null, 2), 'utf-8');

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`  title only: ${titleOnly}`);
  console.log(`  desc only: ${descOnly}`);
  console.log(`  both: ${both}`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length) failures.slice(0, 5).forEach((f) => console.log(`  ${f.sku}: ${f.error}`));
  console.log(`Report: ${reportPath}`);

  if (samples.length) {
    console.log('\nSample translations:');
    samples.forEach((s) => {
      console.log(`\n  ${s.sku}`);
      console.log(`    titleUa: "${(s.before.titleUa || '').slice(0,60)}" → "${(s.after.titleUa || '').slice(0,60)}"`);
      console.log(`    descLen: ${s.before.descLen} → ${s.after.descLen}`);
      if (s.uaPreview) console.log(`    UA preview: "${s.uaPreview}"`);
    });
  }
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
