#!/usr/bin/env tsx
/*
 * Translate Brabus product titles + descriptions EN → UA via Gemini 2.5 Flash.
 *
 * Targets only products with missing or very-short Ukrainian content. Real
 * UA copy that already exists is left alone.
 *
 * What gets translated for each product:
 *   - titleEn   → titleUa     (if titleUa empty or missing the vehicle suffix)
 *   - longDescEn → longDescUa  (if uaLen < 50 OR uaLen < enLen * 0.5)
 *   - bodyHtmlEn → bodyHtmlUa  (kept in sync with longDescUa)
 *
 * Quality controls:
 *   - System prompt instructs the model to keep brand-specific proper nouns
 *     (BRABUS, Monoblock, PowerXtra, Widestar, AMG, Mercedes, Carbon, Velour
 *     etc.) and vehicle codes (W 465, C 217, X 290) untranslated.
 *   - HTML tags preserved exactly.
 *   - thinkingConfig.thinkingBudget=0 disables reasoning tokens (translation
 *     is straightforward; thinking just wastes tokens and adds latency).
 *   - temperature=0.2 for stable output across re-runs.
 *
 * Usage:
 *   tsx scripts/translate-brabus-ua-gemini.ts                 (dry-run, 5)
 *   tsx scripts/translate-brabus-ua-gemini.ts --commit
 *   tsx scripts/translate-brabus-ua-gemini.ts --commit --limit=20
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMMIT = process.argv.includes('--commit');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : (COMMIT ? Infinity : 5);
const CONCURRENCY = 5; // Gemini Flash has generous rate limits but be polite

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;

const VEHICLE_RE = /(mercedes|porsche|bentley|rolls|maybach|lamborghini|range\s?rover|smart|w\s?\d+|x\s?\d+|c\s?\d+|amg|gle|gls|gla|glb|glc|cls|sl-|sl\s|s-class|g-class|e-class|c-class)/i;

const SYSTEM = `You are a professional translator localising premium-tuning ecommerce content for a Ukrainian luxury car-parts shop.

Translate the input from English to Ukrainian. Rules:
- Preserve all HTML tags (<p>, <strong>, <br>, <ul>, <li>, etc.) EXACTLY as in the source. Do not add, remove, or rename tags.
- Keep these proper nouns UNTRANSLATED: BRABUS, Monoblock, PowerXtra, SportXtra, BoostXtra, Widestar, Masterpiece, Rocket, Carbon (when used as a part name like "Carbon front spoiler"), Velour (when used as a material name in titles).
- Keep all vehicle model codes UNTRANSLATED: W 465, W 463A, C 217, X 290, V 297, R 232, etc.
- Keep brand names UNTRANSLATED: Mercedes, AMG, Porsche, Bentley, Rolls-Royce, Maybach, Lamborghini, Range Rover, smart.
- Keep AMG class codes UNTRANSLATED: AMG G 63, AMG S 63, AMG GT 63, AMG GLE 63, etc.
- Keep "BRABUS Tuning Warranty", "TÜV", "EUR" UNTRANSLATED.
- Translate "for Mercedes" → "для Mercedes" (preserve em-dashes).
- Translate "based on" → "на базі".
- Use natural automotive Ukrainian terminology, not awkward word-by-word translation.
- Use neutral, formal tone (Ukrainian \"Ви\" form when addressing the customer, but prefer impersonal/informational style).
- Output ONLY the translated text. No commentary, no quotes, no markdown fences, no "Here is the translation".`;

async function gemini(text: string, retries = 3): Promise<string> {
  if (!text || !text.trim()) return text;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 }, // disable thinking
    },
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) { await new Promise((r) => setTimeout(r, 2500 * (attempt + 1))); continue; }
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!out) throw new Error('Empty response: ' + JSON.stringify(data).slice(0, 200));
      return out.trim();
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
    }
  }
  throw new Error('unreachable');
}

/* Post-process: enforce brand-name capitalisation in case Gemini drifted. */
function postProcess(text: string): string {
  return text
    .replace(/\bBrabus\b/g, 'BRABUS')
    .replace(/моноблок/gi, 'Monoblock')
    .replace(/powerxtra/gi, 'PowerXtra')
    .replace(/sportxtra/gi, 'SportXtra')
    .replace(/boostxtra/gi, 'BoostXtra')
    .replace(/widestar/gi, 'Widestar')
    .replace(/masterpiece/gi, 'Masterpiece');
}

async function main() {
  console.log('=== Brabus EN → UK translation (Gemini 2.5 Flash) ===');
  console.log('Mode:', COMMIT ? 'COMMIT' : `DRY RUN (limit ${LIMIT})`);

  const all = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: {
      id: true, sku: true,
      titleEn: true, titleUa: true,
      longDescEn: true, longDescUa: true,
      bodyHtmlEn: true, bodyHtmlUa: true,
    },
  });

  const candidates = all.filter((p) => {
    const enLen = (p.longDescEn || '').length;
    const uaLen = (p.longDescUa || '').length;
    const titleNeedsTranslate =
      !p.titleUa?.trim() ||
      (p.titleEn && VEHICLE_RE.test(p.titleEn) && !VEHICLE_RE.test(p.titleUa || ''));
    const descNeedsTranslate = enLen > 50 && (uaLen < 50 || uaLen < enLen * 0.5);
    return titleNeedsTranslate || descNeedsTranslate;
  });

  const target = candidates.slice(0, LIMIT === Infinity ? candidates.length : LIMIT);
  console.log(`Candidates: ${candidates.length} | processing this run: ${target.length}`);

  const limit = pLimit(CONCURRENCY);
  let updated = 0;
  let titleOnly = 0, descOnly = 0, both = 0;
  const failures: Array<{ sku: string; error: string }> = [];
  const samples: Array<any> = [];
  let processed = 0;

  await Promise.all(
    target.map((p) =>
      limit(async () => {
        try {
          const enLen = (p.longDescEn || '').length;
          const uaLen = (p.longDescUa || '').length;
          const updates: Record<string, unknown> = {};

          /* Title */
          if (
            !p.titleUa?.trim() ||
            (p.titleEn && VEHICLE_RE.test(p.titleEn) && !VEHICLE_RE.test(p.titleUa || ''))
          ) {
            const t = await gemini(p.titleEn || '');
            updates.titleUa = postProcess(t);
          }

          /* Description */
          if (enLen > 50 && (uaLen < 50 || uaLen < enLen * 0.5)) {
            if (p.longDescEn) {
              const t = await gemini(p.longDescEn);
              updates.longDescUa = postProcess(t);
            }
            if (p.bodyHtmlEn) {
              const t = await gemini(p.bodyHtmlEn);
              updates.bodyHtmlUa = postProcess(t);
            }
          }

          if (!Object.keys(updates).length) return;

          const hasTitle = 'titleUa' in updates;
          const hasDesc = 'longDescUa' in updates || 'bodyHtmlUa' in updates;
          if (hasTitle && hasDesc) both++;
          else if (hasTitle) titleOnly++;
          else descOnly++;

          if (samples.length < 5) {
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
          failures.push({ sku: p.sku!, error: (e?.message || String(e)).slice(0, 150) });
        } finally {
          processed++;
          if (processed % 25 === 0) console.log(`  …processed ${processed}/${target.length}`);
        }
      }),
    ),
  );

  /* Save report */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `brabus-translate-gemini-${ts}${COMMIT ? '' : '-dryrun'}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ updated, titleOnly, descOnly, both, failures, samples }, null, 2), 'utf-8');

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}  (title only: ${titleOnly} | desc only: ${descOnly} | both: ${both})`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length) failures.slice(0, 5).forEach((f) => console.log(`  ${f.sku}: ${f.error}`));
  console.log(`Report: ${reportPath}`);

  if (samples.length) {
    console.log('\nSample translations:');
    samples.forEach((s) => {
      console.log(`\n  ${s.sku}`);
      console.log(`    titleUa: "${(s.before.titleUa || '').slice(0,70)}" → "${(s.after.titleUa || '').slice(0,70)}"`);
      console.log(`    descLen: ${s.before.descLen} → ${s.after.descLen}`);
      if (s.uaPreview) console.log(`    UA preview: "${s.uaPreview}"`);
    });
  }
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
