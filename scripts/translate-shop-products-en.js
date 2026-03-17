/* eslint-disable no-console */
/**
 * Auto-translate missing EN product texts using DeepL.
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
 *   DEEPL_AUTH_KEY=...
 *   DEEPL_BASE_URL=... (optional; default depends on key type)
 */
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const DEEPL_AUTH_KEY = (process.env.DEEPL_AUTH_KEY || '').trim();
const DEEPL_BASE_URL = (process.env.DEEPL_BASE_URL || '').trim();

function parseArgs(argv) {
  const args = {
    commit: false,
    dryRun: false,
    limit: 0,
    scan: 500,
    includeUnpublished: false,
    translateHtml: false,
    delayMs: 250,
  };
  for (const raw of argv) {
    if (raw === '--commit') args.commit = true;
    if (raw === '--dry-run') args.dryRun = true;
    if (raw === '--include-unpublished') args.includeUnpublished = true;
    if (raw === '--translate-html') args.translateHtml = true;
    if (raw.startsWith('--limit=')) args.limit = Number(raw.split('=')[1] || 0) || 0;
    if (raw.startsWith('--scan=')) args.scan = Math.max(50, Number(raw.split('=')[1] || 0) || 0);
    if (raw.startsWith('--delay-ms=')) args.delayMs = Math.max(0, Number(raw.split('=')[1] || 0) || 0);
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

function stripHtml(value) {
  return normText(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function deepLBaseUrl(authKey) {
  if (DEEPL_BASE_URL) return DEEPL_BASE_URL.replace(/\/+$/, '');
  // Free API keys typically end with ":fx"
  if (authKey && authKey.toLowerCase().endsWith(':fx')) return 'https://api-free.deepl.com';
  return 'https://api.deepl.com';
}

async function deepLTranslate({ text, sourceLang, targetLang, isHtml }) {
  const base = deepLBaseUrl(DEEPL_AUTH_KEY);
  const url = `${base}/v2/translate`;
  const source = sourceLang === 'Ukrainian' ? 'UK' : undefined;
  const target = targetLang === 'English' ? 'EN' : targetLang;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_AUTH_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      target_lang: target,
      ...(source ? { source_lang: source } : {}),
      ...(isHtml ? { tag_handling: 'html' } : {}),
      // DeepL supports 'prefer_more' / 'prefer_less' (as of current docs)
      formality: 'prefer_more',
    }),
  });

  if (!res.ok) {
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const errText = await res.text().catch(() => '');
    const err = new Error(`DeepL error ${res.status}: ${errText || res.statusText}`);
    err.status = res.status;
    err.retryAfterMs = Number.isFinite(retryAfterSeconds) ? Math.max(0, retryAfterSeconds) * 1000 : null;
    throw err;
  }

  const json = await res.json();
  const out = Array.isArray(json.translations) ? json.translations[0]?.text : '';
  const outputText = typeof out === 'string' ? out.trim() : '';
  if (!outputText) throw new Error('DeepL returned empty translation');
  return outputText;
}

async function translateWithRetry(payload, { attempts = 4 } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await deepLTranslate(payload);
    } catch (e) {
      lastErr = e;
      const status = e && typeof e === 'object' ? e.status : null;
      const retryAfterMs = e && typeof e === 'object' ? e.retryAfterMs : null;
      const backoff = 750 * Math.pow(2, i);
      const waitMs =
        status === 429 && typeof retryAfterMs === 'number'
          ? Math.max(retryAfterMs, backoff)
          : backoff;
      await sleep(waitMs);
    }
  }
  throw lastErr || new Error('Translation failed');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!DEEPL_AUTH_KEY && args.commit) {
    console.error('Missing DEEPL_AUTH_KEY. Use --dry-run or set DEEPL_AUTH_KEY in .env.local');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const where = args.includeUnpublished ? {} : { isPublished: true };

  const products = [];
  let cursor = undefined;
  let fetched = 0;
  while (fetched < args.scan) {
    const page = await prisma.shopProduct.findMany({
      where: {
        ...where,
        OR: [
          // We only translate when UA source exists; otherwise skip later.
          { shortDescUa: { not: null } },
          { longDescUa: { not: null } },
          ...(args.translateHtml ? [{ bodyHtmlUa: { not: null } }] : []),
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(200, args.scan - fetched),
      ...(cursor ? { cursor, skip: 1 } : {}),
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
    if (!page.length) break;
    products.push(...page);
    fetched += page.length;
    cursor = { id: page[page.length - 1].id };
  }

  const candidates = products.filter((p) => {
    const shortNeed = isMissingOrSameAsUa(p.shortDescUa, p.shortDescEn);
    const longNeed = isMissingOrSameAsUa(p.longDescUa || p.bodyHtmlUa, p.longDescEn || p.bodyHtmlEn);
    const htmlNeed =
      args.translateHtml &&
      isMissingOrSameAsUa(stripHtml(p.bodyHtmlUa), stripHtml(p.bodyHtmlEn));
    return shortNeed || longNeed || htmlNeed;
  });

  console.log(
    JSON.stringify(
      {
        mode: args.commit ? 'commit' : 'dry-run',
        provider: 'deepl',
        baseUrl: deepLBaseUrl(DEEPL_AUTH_KEY),
        totalLoaded: products.length,
        candidates: candidates.length,
        translateHtml: args.translateHtml,
        delayMs: args.delayMs,
        scan: args.scan,
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
    if (args.limit > 0 && updated >= args.limit) break;
    const updates = {};
    const planned = [];

    const shortUa = normText(p.shortDescUa);
    if (isMissingOrSameAsUa(shortUa, p.shortDescEn) && shortUa) {
      const key = `short:${shortUa.toLowerCase()}`;
      const translated =
        cache.get(key) ||
        (DEEPL_AUTH_KEY
          ? await translateWithRetry({
              text: shortUa,
              sourceLang: 'Ukrainian',
              targetLang: 'English',
              isHtml: false,
            })
          : '');
      if (translated) cache.set(key, translated);
      if (translated) updates.shortDescEn = translated;
      planned.push('shortDescEn');
      if (args.delayMs) await sleep(args.delayMs);
    }

    const longUa = normText(p.longDescUa || '');
    if (isMissingOrSameAsUa(longUa, p.longDescEn) && longUa) {
      const key = `long:${longUa.toLowerCase()}`;
      const translated =
        cache.get(key) ||
        (DEEPL_AUTH_KEY
          ? await translateWithRetry({
              text: longUa,
              sourceLang: 'Ukrainian',
              targetLang: 'English',
              isHtml: false,
            })
          : '');
      if (translated) cache.set(key, translated);
      if (translated) updates.longDescEn = translated;
      planned.push('longDescEn');
      if (args.delayMs) await sleep(args.delayMs);
    }

    if (!updates.longDescEn) {
      const bodyUaPlain = normText(p.bodyHtmlUa ? String(p.bodyHtmlUa).replace(/<[^>]+>/g, ' ') : '');
      const bodyEnPlain = normText(p.bodyHtmlEn ? String(p.bodyHtmlEn).replace(/<[^>]+>/g, ' ') : '');
      if (isMissingOrSameAsUa(bodyUaPlain, bodyEnPlain) && bodyUaPlain) {
        const key = `body_plain:${bodyUaPlain.toLowerCase()}`;
        const translated =
          cache.get(key) ||
          (DEEPL_AUTH_KEY
            ? await translateWithRetry({
                text: bodyUaPlain,
                sourceLang: 'Ukrainian',
                targetLang: 'English',
                isHtml: false,
              })
            : '');
        if (translated) cache.set(key, translated);
        if (translated) updates.longDescEn = translated;
        planned.push('longDescEn(from bodyHtmlUa)');
        if (args.delayMs) await sleep(args.delayMs);
      }
    }

    if (args.translateHtml) {
      const bodyUaHtml = normText(p.bodyHtmlUa);
      const bodyEnHtml = normText(p.bodyHtmlEn);
      if (isMissingOrSameAsUa(stripHtml(bodyUaHtml), stripHtml(bodyEnHtml)) && bodyUaHtml) {
        const key = `body_html:${bodyUaHtml.toLowerCase()}`;
        const translated =
          cache.get(key) ||
          (DEEPL_AUTH_KEY
            ? await translateWithRetry({
                text: bodyUaHtml,
                sourceLang: 'Ukrainian',
                targetLang: 'English',
                isHtml: true,
              })
            : '');
        if (translated) cache.set(key, translated);
        if (translated) updates.bodyHtmlEn = translated;
        planned.push('bodyHtmlEn');
        if (args.delayMs) await sleep(args.delayMs);
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
        DEEPL_AUTH_KEY ? '' : '(no DEEPL_AUTH_KEY; showing plan only)'
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

