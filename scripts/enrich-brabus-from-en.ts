#!/usr/bin/env tsx
/*
 * Enrich Brabus products with proper title + description from brabus.com EN.
 *
 * Targets products with EITHER:
 *   - description shorter than 150 chars in both EN and UA, OR
 *   - title without a vehicle model token (Mercedes / Porsche / W 465 etc.)
 *
 * For each, fetches the canonical EN product page on brabus.com (URL
 * resolved from /en-int/sitemap.xml by SKU match) and replaces:
 *   - titleEn (full Brabus title with vehicle suffix)
 *   - longDescEn (cleaned description, no cookie/legal boilerplate)
 *   - bodyHtmlEn (same, kept in sync)
 *   - titleUa (existing UA title + Ukrainian-translated vehicle suffix
 *     extracted from the new EN title)
 *
 * Usage:
 *   tsx scripts/enrich-brabus-from-en.ts            (dry-run; default 5 items)
 *   tsx scripts/enrich-brabus-from-en.ts --limit=20
 *   tsx scripts/enrich-brabus-from-en.ts --commit
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const limitFlag = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitFlag ? Number(limitFlag.split('=')[1]) : (COMMIT ? Infinity : 5);
const CONCURRENCY = 3;
const RETRY_ON_FAIL = 2;

const SITEMAP_URL = 'https://www.brabus.com/en-int/sitemap.xml';
const VEHICLE_RE = /(mercedes|porsche|bentley|rolls|maybach|lamborghini|range\s?rover|smart|w\s?\d+|x\s?\d+|c\s?\d+|amg|gle|gls|gla|glb|glc|cls|sl-|sl\s|s-class|g-class|e-class|c-class)/i;

/* Strip cookie/legal/contact boilerplate Brabus appends on every product page */
const BOILERPLATE_FRAGMENT = /(we use cookies|brabus gmbh|brabus-allee|d-46240 bottrop|info@brabus|coveto|google maps|youtube videos|google ireland|cookie settings|privacy policy|data protection|google analytics|facebook pixel|inquiry item|brabus consultant|brabus tuning warranty|brabus tuning-garantie|stellenanzeigen|bewerbungsportal|wir schaffen|we create modern|individual luxury|switch countries|please select the website|note: due to|please note: the assembly|after internal verification|currently not available for direct purchase|requires extensive consultation|sent directly to your home|installed at brabus|installed by a brabus dealer|brabus customer advisor|brabus dealer will|appointment for the installation|delivery option is preselected|tÜv approval and registration|will be invoiced separately|delivery worldwide|registration in the vehicle registration certificate|articles will be requested without)/i;

async function fetchOnce(url: string): Promise<{ status: number; text?: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    if (res.ok && !res.url.includes('/404.html')) {
      return { status: res.status, text: await res.text(), finalUrl: res.url };
    }
    return { status: res.url.includes('/404.html') ? 404 : res.status, finalUrl: res.url };
  } catch {
    clearTimeout(timeout);
    return { status: 0, finalUrl: url };
  }
}

/* Some sitemap entries are stale — they include numeric-prefixed segments
   like "/2-c-167/2-amg-line/" that redirect to 404. The live URL drops
   those numeric prefixes. Try original first, then progressive strip. */
function urlVariants(url: string): string[] {
  const variants = new Set<string>([url]);
  /* Strip `\d+-` prefix from any path segment between /article/ and the SKU. */
  const stripped = url.replace(/\/(\d+-)([a-z])/gi, '/$2');
  if (stripped !== url) variants.add(stripped);
  /* Strip only the c-167-style "2-c-167" prefix (specific to chassis codes). */
  const chassisStripped = url.replace(/\/\d+-(c-?\d|w-?\d|x-?\d|v-?\d|r-?\d|z-?\d)/gi, '/$1');
  if (chassisStripped !== url) variants.add(chassisStripped);
  return [...variants];
}

async function fetchPage(url: string, retries = RETRY_ON_FAIL): Promise<string | null> {
  for (const candidate of urlVariants(url)) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetchOnce(candidate);
      if (res.text) return res.text;
      if (res.status >= 400 && res.status < 500) break; // try next variant
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

async function buildSkuUrlMap(): Promise<Map<string, string>> {
  const xml = await fetchPage(SITEMAP_URL);
  if (!xml) throw new Error('Failed to fetch EN sitemap');
  const m = new Map<string, string>();
  for (const match of xml.matchAll(/<loc>(https:\/\/www\.brabus\.com\/en-int\/cars\/tuning\/[^<]+\/article\/[^<]+\.html)<\/loc>/g)) {
    const url = match[1];
    const last = url.split('/').pop()!.replace('.html', '').toLowerCase();
    m.set(last, url);
  }
  /* Fallback: DE sitemap entries that don't have EN counterparts. Translate
     URL paths so we still hit the EN page. */
  const xmlDe = await fetchPage('https://www.brabus.com/de-de/sitemap.xml');
  if (xmlDe) {
    for (const match of xmlDe.matchAll(/<loc>(https:\/\/www\.brabus\.com\/de-de\/cars\/tuning\/[^<]+\/artikel\/[^<]+\.html)<\/loc>/g)) {
      const urlDe = match[1];
      const last = urlDe.split('/').pop()!.replace('.html', '').toLowerCase();
      if (m.has(last)) continue;
      const urlEn = urlDe
        .replace('/de-de/', '/en-int/')
        .replace('/auf-basis-mercedes/', '/based-on-mercedes/')
        .replace('/auf-basis-porsche/', '/based-on-porsche/')
        .replace('/auf-basis-rolls-royce/', '/based-on-rolls-royce/')
        .replace('/auf-basis-bentley/', '/based-on-bentley/')
        .replace('/auf-basis-lamborghini/', '/based-on-lamborghini/')
        .replace('/auf-basis-smart/', '/based-on-smart/')
        .replace('/uebersicht/', '/overview/')
        .replace('/artikel/', '/article/');
      m.set(last, urlEn);
    }
  }
  return m;
}

type Extracted = {
  title: string;
  descriptionParagraphs: string[];
  descriptionHtml: string;
  descriptionText: string;
};

function extractFromPage(html: string): Extracted {
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim();
  const paragraphs: string[] = [];
  $('p, .product__description, .text, .description').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    /* Filter: between 30 and 1500 chars, no boilerplate */
    if (t.length >= 30 && t.length <= 1500 && !BOILERPLATE_FRAGMENT.test(t)) {
      paragraphs.push(t);
    }
  });
  /* Deduplicate consecutive identical paragraphs and very-similar ones */
  const seen = new Set<string>();
  const uniq = paragraphs.filter((p) => {
    const key = p.slice(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const descHtml = uniq.map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');
  const descText = uniq.join(' ');
  return { title, descriptionParagraphs: uniq, descriptionHtml: descHtml, descriptionText: descText };
}

function extractVehicleSuffix(enTitle: string): string | null {
  /* English Brabus titles end with "for Mercedes – W 465 – AMG G 63" or
     similar. Capture from "for " onward. */
  const m = enTitle.match(/\sfor\s+([^]+)$/i);
  if (m) return m[1].trim();
  /* Sometimes "BRABUS based on Porsche 911 Turbo" — also a vehicle suffix. */
  const m2 = enTitle.match(/\sbased on\s+([^]+)$/i);
  if (m2) return 'based on ' + m2[1].trim();
  return null;
}

function uaVehicleSuffix(suffixEn: string): string {
  /* Translate the simple "for X" → "для X". The vehicle code stays. */
  return 'для ' + suffixEn;
}

function buildUaTitle(currentTitleUa: string, enTitle: string): string {
  /* If UA title already has vehicle words, keep it. */
  if (VEHICLE_RE.test(currentTitleUa)) return currentTitleUa;
  const suffEn = extractVehicleSuffix(enTitle);
  if (!suffEn) return currentTitleUa;
  /* Take everything before "for"/"based on" of the EN title — that's the
     part-name only — and rebuild a simple UA title. We keep the original
     UA part-name and append the vehicle suffix in Ukrainian. */
  if (suffEn.startsWith('based on')) {
    return `${currentTitleUa} ${suffEn.replace(/^based on/, 'на базі')}`;
  }
  return `${currentTitleUa} ${uaVehicleSuffix(suffEn)}`;
}

async function main() {
  console.log('=== Brabus EN-enrichment ===');
  console.log('Mode:', COMMIT ? 'COMMIT' : `DRY RUN (limit ${LIMIT})`);

  const skuToUrl = await buildSkuUrlMap();
  /* Aliases for SKUs that the sitemap encodes with `_` where our DB uses `-` */
  for (const [k, v] of [...skuToUrl.entries()]) {
    if (k.includes('_')) skuToUrl.set(k.replace(/_/g, '-'), v);
  }
  console.log(`Sitemap SKUs available: ${skuToUrl.size}`);

  const where = { brand: { equals: 'brabus', mode: 'insensitive' } };
  const allDb = await prisma.shopProduct.findMany({
    where,
    select: {
      id: true, sku: true, slug: true,
      titleEn: true, titleUa: true,
      longDescEn: true, longDescUa: true,
      bodyHtmlEn: true, bodyHtmlUa: true,
    },
  });

  const candidates = allDb.filter((p) => {
    const dl = Math.max(
      (p.longDescEn || '').length,
      (p.longDescUa || '').length,
      (p.bodyHtmlEn || '').length,
    );
    const titleHasVeh = VEHICLE_RE.test(p.titleEn || '') || VEHICLE_RE.test(p.titleUa || '');
    return dl < 150 || !titleHasVeh;
  });

  /* Filter to those we can resolve to a URL */
  const planned = candidates
    .map((p) => ({ p, url: skuToUrl.get((p.sku || '').toLowerCase()) }))
    .filter((x): x is { p: typeof allDb[number]; url: string } => !!x.url);

  console.log(`Need enrichment: ${candidates.length}, with URL: ${planned.length}`);

  const target = planned.slice(0, LIMIT === Infinity ? planned.length : LIMIT);
  console.log(`Processing this run: ${target.length}`);

  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const failures: Array<{ sku: string; reason: string }> = [];
  const updates: Array<{ id: string; sku: string; before: any; after: any }> = [];

  await Promise.all(
    target.map(({ p, url }) =>
      limit(async () => {
        processed++;
        const html = await fetchPage(url);
        if (!html) {
          failures.push({ sku: p.sku!, reason: 'fetch failed' });
          return;
        }
        const ex = extractFromPage(html);
        if (!ex.title || ex.descriptionText.length < 50) {
          failures.push({ sku: p.sku!, reason: `weak page (title=${ex.title.length}, desc=${ex.descriptionText.length})` });
          skipped++;
          return;
        }

        const newTitleEn = ex.title;
        const newTitleUa = buildUaTitle(p.titleUa || '', ex.title);
        const newLongDescEn = ex.descriptionText;
        const newBodyHtmlEn = ex.descriptionHtml;

        const data: Record<string, unknown> = {};
        if (newTitleEn && newTitleEn !== p.titleEn) data.titleEn = newTitleEn;
        if (newTitleUa && newTitleUa !== p.titleUa) data.titleUa = newTitleUa;
        if (newLongDescEn && (newLongDescEn !== (p.longDescEn || ''))) {
          data.longDescEn = newLongDescEn;
          data.bodyHtmlEn = newBodyHtmlEn;
        }

        if (!Object.keys(data).length) { skipped++; return; }

        updates.push({
          id: p.id,
          sku: p.sku!,
          before: { titleEn: p.titleEn, titleUa: p.titleUa, descLen: (p.longDescEn || '').length },
          after: { titleEn: data.titleEn ?? p.titleEn, titleUa: data.titleUa ?? p.titleUa, descLen: (newLongDescEn || '').length },
        });

        if (COMMIT) {
          await prisma.shopProduct.update({ where: { id: p.id }, data });
          updated++;
        }
      }),
    ),
  );

  /* Save change set */
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const reportPath = path.join(backupDir, `brabus-enrich-${ts}${COMMIT ? '' : '-dryrun'}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ processed, updates, failures }, null, 2), 'utf-8');
  console.log(`\nReport: ${reportPath}`);

  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed}`);
  console.log(`${COMMIT ? 'Updated' : 'Would update'}: ${updates.length}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Fetch failures: ${failures.filter(f => f.reason === 'fetch failed').length}`);
  console.log(`Weak pages skipped: ${failures.filter(f => f.reason !== 'fetch failed').length}`);

  if (updates.length) {
    console.log('\nFirst 5 sample changes:');
    updates.slice(0, 5).forEach(u => {
      console.log(`  ${u.sku}`);
      console.log(`    titleEn: "${(u.before.titleEn || '').slice(0,70)}" → "${(u.after.titleEn || '').slice(0,70)}"`);
      console.log(`    titleUa: "${(u.before.titleUa || '').slice(0,70)}" → "${(u.after.titleUa || '').slice(0,70)}"`);
      console.log(`    descLen: ${u.before.descLen} → ${u.after.descLen}`);
    });
  }
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
