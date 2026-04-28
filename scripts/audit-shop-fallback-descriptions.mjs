import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

const POOR_UA_HINTS = [
  /\bproductbase\b/i,
  /^\s*$/,
];

// Canonical fingerprints of the Urban editorial fallback that should NOT appear
// on non-Urban brand pages.
const URBAN_VOICE_FINGERPRINTS = [
  /стриман[іий]м?,? технічн[оiї]/i,
  /Urban Automotive/,
  /Urban-програма/i,
  /OEM Plus/i,
];

const URBAN_BRAND_KEYS = ['urban', 'urban automotive'];

function isUrbanBrand(row) {
  const brand = (row.brand ?? '').toLowerCase();
  if (URBAN_BRAND_KEYS.includes(brand)) return true;
  if (typeof row.slug === 'string' && row.slug.startsWith('urb-')) return true;
  return false;
}

function isWeak(value) {
  if (!value) return true;
  const stripped = String(value).replace(/<[^>]+>/g, '').trim();
  if (!stripped) return true;
  if (stripped.length < 30) return true;
  for (const rx of POOR_UA_HINTS) {
    if (rx.test(stripped)) return true;
  }
  return false;
}

function detectUrbanVoiceLeak(row) {
  if (isUrbanBrand(row)) return null;
  for (const rx of URBAN_VOICE_FINGERPRINTS) {
    for (const field of ['titleUa', 'shortDescUa', 'longDescUa', 'bodyHtmlUa']) {
      const value = row[field] ?? '';
      if (value && rx.test(value)) {
        return { field, pattern: rx.toString(), match: value.match(rx)?.[0] ?? '' };
      }
    }
  }
  return null;
}

async function run() {
  const rows = await p.shopProduct.findMany({
    where: { isPublished: true },
    select: {
      slug: true,
      brand: true,
      vendor: true,
      titleUa: true,
      titleEn: true,
      shortDescUa: true,
      longDescUa: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      sku: true,
    },
  });

  const perBrand = new Map();
  const urbanVoiceLeaks = [];
  const emptyUaBody = [];
  const missingSku = [];

  for (const row of rows) {
    const brand = row.brand || '(no-brand)';
    if (!perBrand.has(brand)) {
      perBrand.set(brand, {
        brand,
        total: 0,
        urbanVoiceLeak: 0,
        emptyUaBody: 0,
        missingSku: 0,
      });
    }
    const entry = perBrand.get(brand);
    entry.total += 1;

    const leak = detectUrbanVoiceLeak(row);
    if (leak) {
      entry.urbanVoiceLeak += 1;
      urbanVoiceLeaks.push({
        slug: row.slug,
        brand,
        ...leak,
      });
    }

    if (isWeak(row.bodyHtmlUa)) {
      entry.emptyUaBody += 1;
      emptyUaBody.push({ slug: row.slug, brand });
    }

    if (!row.sku) {
      entry.missingSku += 1;
      missingSku.push({ slug: row.slug, brand, titleEn: row.titleEn?.slice(0, 80) ?? '' });
    }
  }

  const summary = [...perBrand.values()].sort((a, b) => b.total - a.total);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `shop-fallback-audit-${stamp}.json`);

  const report = {
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    summary,
    urbanVoiceLeaks,
    emptyUaBody,
    missingSku,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('=== Per-brand ===');
  for (const row of summary) {
    console.log(
      `  ${row.brand.padEnd(24)} total=${String(row.total).padStart(4)}  urbanVoiceLeak=${String(row.urbanVoiceLeak).padStart(4)}  emptyUa=${String(row.emptyUaBody).padStart(4)}  missingSku=${String(row.missingSku).padStart(4)}`
    );
  }
  console.log(`\nUrban-voice leaks (non-Urban brand pages mentioning Urban Automotive / OEM Plus / etc.): ${urbanVoiceLeaks.length}`);
  console.log(`Rows with empty/weak bodyHtmlUa: ${emptyUaBody.length}`);
  console.log(`Rows with missing SKU: ${missingSku.length}`);
  console.log(`\nReport: ${outPath}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
