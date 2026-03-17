/* eslint-disable no-console */
/**
 * Auto-translate missing EN product texts using OpenAI.
 *
 * Why:
 * - Our storefront reads { ua, en } pairs; if EN fields are empty, EN pages show blank.
 * - CSV imports often include only one language.
 *
 * What it does:
 * - Finds ShopProduct rows where EN fields are missing/empty or identical to UA
 * - Translates UA -> EN for short/long descriptions (and optionally HTML body)
 * - De-duplicates repeated UA texts (translate once, reuse)
 *
 * Usage:
 *   node scripts/translate-shop-products-en.js --dry-run
 *   node scripts/translate-shop-products-en.js --limit=50
 *   node scripts/translate-shop-products-en.js --commit --limit=50
 *
 * Env:
 *   OPENAI_API_KEY=...
 *   OPENAI_MODEL=... (optional)
 */
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

function parseArgs(argv) {
  const args = { commit: false, dryRun: false, limit: 0, includeUnpublished: false, translateHtml: false };
  for (const raw of argv) {
    if (raw === '--commit') args.commit = true;
    if (raw === '--dry-run') args.dryRun = true;
    if (raw === '--include-unpublished') args.includeUnpublished = true;
    if (raw === '--translate-html') args.translateHtml = true;
    if (raw.startsWith('--limit=')) args.limit = Number(raw.split('=')[1] || 0) || 0;
  }
  if (!args.commit) args.dryRun = true;
  return args;
}

function normText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isMissingOrSameAsUa(ua, en) {
  const uaN = normText(ua);
  const enN = normText(en);
  if (!uaN) return false; // nothing to translate
  if (!enN) return true;
  return uaN.toLowerCase() === enN.toLowerCase();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function openaiTranslate({ text, sourceLang, targetLang }) {
  const prompt = [
    `Translate from ${sourceLang} to ${targetLang}.`,
    `Keep brand/product names, SKUs, and model names unchanged.`,
    `Keep the tone premium, concise, and natural (not literal).`,
    `Do not add new facts. Do not hallucinate specs.`,
    `Return ONLY the translated text.`,
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'text', text: prompt }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text }],
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${errText || res.statusText}`);
  }

  const json = await res.json();
  const outputText =
    (typeof json.output_text === 'string' && json.output_text.trim()) ||
    // Fallback: try to reconstruct from output array
    (Array.isArray(json.output)
      ? json.output
          .flatMap((o) => (Array.isArray(o.content) ? o.content : []))
          .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
          .join('\n')
          .trim()
      : '');

  if (!outputText) {
    throw new Error('OpenAI returned empty translation');
  }
  return outputText;
}

async function translateWithRetry(payload, { attempts = 4 } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await openaiTranslate(payload);
    } catch (e) {
      lastErr = e;
      const backoff = 500 * Math.pow(2, i);
      await sleep(backoff);
    }
  }
  throw lastErr || new Error('Translation failed');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!OPENAI_API_KEY && args.commit) {
    console.error('Missing OPENAI_API_KEY. Use --dry-run or set OPENAI_API_KEY in .env.local');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const where = args.includeUnpublished ? {} : { isPublished: true };

  const products = await prisma.shopProduct.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: args.limit > 0 ? args.limit : undefined,
    select: {
      id: true,
      slug: true,
      titleUa: true,
      titleEn: true,
      shortDescUa: true,
      shortDescEn: true,
      longDescUa: true,
      longDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      updatedAt: true,
    },
  });

  const candidates = products.filter((p) => {
    const shortNeed = isMissingOrSameAsUa(p.shortDescUa, p.shortDescEn);
    const longNeed = isMissingOrSameAsUa(p.longDescUa || p.bodyHtmlUa, p.longDescEn || p.bodyHtmlEn);
    const htmlNeed = args.translateHtml && isMissingOrSameAsUa(p.bodyHtmlUa, p.bodyHtmlEn);
    return shortNeed || longNeed || htmlNeed;
  });

  console.log(
    JSON.stringify(
      {
        mode: args.commit ? 'commit' : 'dry-run',
        model: DEFAULT_MODEL,
        totalLoaded: products.length,
        candidates: candidates.length,
        translateHtml: args.translateHtml,
      },
      null,
      2
    )
  );

  const cache = new Map(); // uaText(lowercased) -> enText
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of candidates) {
    const updates = {};
    const planned = [];

    const shortUa = normText(p.shortDescUa);
    if (isMissingOrSameAsUa(shortUa, p.shortDescEn) && shortUa) {
      const key = `short:${shortUa.toLowerCase()}`;
      const translated =
        cache.get(key) ||
        (OPENAI_API_KEY
          ? await translateWithRetry({ text: shortUa, sourceLang: 'Ukrainian', targetLang: 'English' })
          : '');
      if (translated) cache.set(key, translated);
      if (translated) updates.shortDescEn = translated;
      planned.push('shortDescEn');
    }

    const longUa = normText(p.longDescUa || '');
    if (isMissingOrSameAsUa(longUa, p.longDescEn) && longUa) {
      const key = `long:${longUa.toLowerCase()}`;
      const translated =
        cache.get(key) ||
        (OPENAI_API_KEY
          ? await translateWithRetry({ text: longUa, sourceLang: 'Ukrainian', targetLang: 'English' })
          : '');
      if (translated) cache.set(key, translated);
      if (translated) updates.longDescEn = translated;
      planned.push('longDescEn');
    }

    if (!updates.longDescEn) {
      const bodyUaPlain = normText(p.bodyHtmlUa ? String(p.bodyHtmlUa).replace(/<[^>]+>/g, ' ') : '');
      const bodyEnPlain = normText(p.bodyHtmlEn ? String(p.bodyHtmlEn).replace(/<[^>]+>/g, ' ') : '');
      if (isMissingOrSameAsUa(bodyUaPlain, bodyEnPlain) && bodyUaPlain) {
        const key = `body_plain:${bodyUaPlain.toLowerCase()}`;
        const translated =
          cache.get(key) ||
          (OPENAI_API_KEY
            ? await translateWithRetry({ text: bodyUaPlain, sourceLang: 'Ukrainian', targetLang: 'English' })
            : '');
        if (translated) cache.set(key, translated);
        if (translated) updates.longDescEn = translated;
        planned.push('longDescEn(from bodyHtmlUa)');
      }
    }

    if (args.translateHtml) {
      const bodyUaHtml = normText(p.bodyHtmlUa);
      if (isMissingOrSameAsUa(bodyUaHtml, p.bodyHtmlEn) && bodyUaHtml) {
        const key = `body_html:${bodyUaHtml.toLowerCase()}`;
        const translated =
          cache.get(key) ||
          (OPENAI_API_KEY
            ? await translateWithRetry({ text: bodyUaHtml, sourceLang: 'Ukrainian', targetLang: 'English' })
            : '');
        if (translated) cache.set(key, translated);
        if (translated) updates.bodyHtmlEn = translated;
        planned.push('bodyHtmlEn');
      }
    }

    const hasUpdates = Object.keys(updates).length > 0;
    const hasPlan = planned.length > 0;
    if (!hasUpdates && !hasPlan) {
      skipped++;
      continue;
    }

    if (!args.commit) {
      updated++;
      console.log(
        `[dry-run] ${p.slug}`,
        hasUpdates ? Object.keys(updates) : planned,
        OPENAI_API_KEY ? '' : '(no OPENAI_API_KEY; showing plan only)'
      );
      continue;
    }

    try {
      await prisma.shopProduct.update({
        where: { id: p.id },
        data: updates,
      });
      updated++;
      console.log(`[updated] ${p.slug}`, Object.keys(updates));
    } catch (e) {
      failed++;
      console.error(`[failed] ${p.slug}`, e instanceof Error ? e.message : String(e));
    }
  }

  console.log(
    JSON.stringify(
      {
        finished: true,
        updated,
        skipped,
        failed,
        cacheSize: cache.size,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

