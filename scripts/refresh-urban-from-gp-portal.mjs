#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');
const LIMIT_ARG = [...args].find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;
const CONCURRENCY = 2;

function norm(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return norm(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function excerpt(text, max = 220) {
  const plain = stripHtml(text);
  if (!plain) return null;
  if (plain.length <= max) return plain;
  const sliced = plain.slice(0, max);
  const stop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('; '), sliced.lastIndexOf(', '));
  return `${(stop > 80 ? sliced.slice(0, stop) : sliced).trim()}…`;
}

async function fetchGpProduct(slug) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(`https://gp-portal.eu/products/${slug}.js`, {
      headers: { 'User-Agent': 'OneCompany/Codex' },
    });
    if (res.status === 404) {
      return null;
    }
    if (res.ok) {
      return res.json();
    }
    if (attempt === 3) {
      throw new Error(`GP Portal fetch failed for ${slug}: HTTP ${res.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  return null;
}

async function fetchGpProductPage(slug) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch(`https://gp-portal.eu/products/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.status === 404) return null;
    if (res.ok) return res.text();
    if (attempt === 3) throw new Error(`GP Portal page fetch failed for ${slug}: HTTP ${res.status}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  return null;
}

async function translateTextToUa(text) {
  const normalized = String(text ?? '');
  if (!norm(normalized)) return normalized;
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=' +
    encodeURIComponent(normalized);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    throw new Error(`Google Translate HTTP ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data?.[0]) ? data[0].map((part) => part?.[0] ?? '').join('') : normalized;
}

function postProcessUa(text) {
  return String(text ?? '')
    .replace(/\bG-Клас\b/g, 'G-Class')
    .replace(/\bГ-Клас\b/g, 'G-Class')
    .replace(/\bРоллс-Ройс\b/g, 'Rolls-Royce')
    .replace(/\bМерседес-Бенц\b/g, 'Mercedes-Benz')
    .replace(/\bФольксваген\b/g, 'Volkswagen')
    .replace(/\bБентлі\b/g, 'Bentley')
    .replace(/\bАуді\b/g, 'Audi')
    .replace(/\bЛенд Ровер\b/g, 'Land Rover')
    .replace(/\bРейндж Ровер\b/g, 'Range Rover')
    .replace(/\bУрбан Аутомотів\b/g, 'Urban Automotive')
    .replace(/\bУрбан\b/g, 'Urban');
}

async function translateHtmlToUa(html) {
  const ua = await translateTextToUa(String(html ?? ''));
  return postProcessUa(ua);
}

function extractGpMetaFromHtml(html) {
  const metaMatch = html.match(/var meta = (\{[\s\S]*?\});/);
  const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  let meta = null;
  let ld = null;
  try {
    meta = metaMatch ? JSON.parse(metaMatch[1]) : null;
  } catch {}
  try {
    ld = ldMatch ? JSON.parse(ldMatch[1]) : null;
  } catch {}
  return { meta, ld };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseWheelSpec(title) {
  const source = String(title || '');
  const diameter = source.match(/\b(19|20|21|22|23|24|25)"/)?.[0] || null;
  const wheelCode = source.match(/\b(UCR|UC\d|WX\d?-?R?|WX\d|UV|NDS)\b/i)?.[0]?.toUpperCase() || null;
  const pcd = source.match(/\b\d+x\d+\b/i)?.[0]?.toUpperCase() || null;
  const et = source.match(/\bET-?\d+\b/i)?.[0]?.toUpperCase() || null;
  const finish =
    source.match(/\b(Gloss Black|Satin Black|Gloss Bronze|Satin Bronze|Silver|Black)\b/i)?.[0] || null;
  const axle = source.match(/\b(Front|Rear)\b/i)?.[0] || null;
  const fitment = source.match(/\(([^)]+)\)/)?.[1] || null;
  return { diameter, wheelCode, pcd, et, finish, axle, fitment };
}

function buildStructuredGpHtml(slug, gp, html) {
  const { meta, ld } = extractGpMetaFromHtml(html);
  const product = meta?.product || {};
  const firstVariant = Array.isArray(product.variants) ? product.variants[0] : null;
  const title = String(gp?.title || ld?.name || firstVariant?.name || slug).trim();
  const category = String(gp?.type || product.type || ld?.category || '').trim() || 'Component';
  const sku = String(firstVariant?.sku || ld?.sku || '').trim() || null;
  const price = firstVariant?.price != null ? Number(firstVariant.price) / 100 : ld?.offers?.price || null;
  const brand = String(gp?.vendor || product.vendor || ld?.brand?.name || 'Urban').trim();

  if (/^wheels?$|wheel spacers?|wheel nuts?/i.test(category)) {
    const spec = parseWheelSpec(title);
    const points = [
      spec.diameter ? `Diameter: ${spec.diameter}` : null,
      spec.wheelCode ? `Wheel design: ${spec.wheelCode}` : null,
      spec.pcd ? `PCD: ${spec.pcd}` : null,
      spec.et ? `Offset: ${spec.et}` : null,
      spec.finish ? `Finish: ${spec.finish}` : null,
      spec.axle ? `Axle position: ${spec.axle}` : null,
      spec.fitment ? `Fitment in GP listing: ${spec.fitment}` : null,
      sku ? `SKU: ${sku}` : null,
      price ? `Price on GP Portal: €${price}` : null,
    ].filter(Boolean);

    return [
      `<p>GP Portal lists this ${escapeHtml(brand)} wheel specification as <strong>${escapeHtml(title)}</strong>.</p>`,
      `<ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`,
    ].join('');
  }

  const points = [
    `Category on GP Portal: ${category}`,
    sku ? `SKU: ${sku}` : null,
    price ? `Price on GP Portal: €${price}` : null,
    firstVariant?.name && firstVariant.name !== title ? `Variant title on GP Portal: ${firstVariant.name}` : null,
  ].filter(Boolean);

  return [
    `<p>GP Portal lists this ${escapeHtml(brand)} product as <strong>${escapeHtml(title)}</strong>.</p>`,
    `<ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`,
  ].join('');
}

async function mapWithConcurrency(items, worker, concurrency = 4) {
  const results = new Array(items.length);
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return results;
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      vendor: { equals: 'Urban Automotive', mode: 'insensitive' },
      status: 'ACTIVE',
      isPublished: true,
    },
    orderBy: { slug: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
    select: {
      id: true,
      slug: true,
      titleEn: true,
    },
  });

  const prepared = await mapWithConcurrency(
    rows,
    async (row) => {
      const gp = await fetchGpProduct(row.slug);
      if (!gp) {
        return {
          slug: row.slug,
          skipped: true,
          reason: 'GP product not found',
        };
      }
      let bodyHtmlEn = String(gp.description || '').trim();
      if (!bodyHtmlEn) {
        const html = await fetchGpProductPage(row.slug);
        if (!html) {
          return {
            slug: row.slug,
            skipped: true,
            reason: 'GP product page not found',
          };
        }
        bodyHtmlEn = buildStructuredGpHtml(row.slug, gp, html);
      }
      const bodyHtmlUa = await translateHtmlToUa(bodyHtmlEn);
      return {
        id: row.id,
        slug: row.slug,
        bodyHtmlEn,
        bodyHtmlUa,
        shortDescEn: excerpt(bodyHtmlEn, 240),
        shortDescUa: excerpt(bodyHtmlUa, 240),
        longDescEn: stripHtml(bodyHtmlEn),
        longDescUa: stripHtml(bodyHtmlUa),
        seoDescriptionEn: excerpt(bodyHtmlEn, 160),
        seoDescriptionUa: excerpt(bodyHtmlUa, 160),
      };
    },
    CONCURRENCY
  );

  const updates = prepared.filter((entry) => !entry.skipped);
  const skipped = prepared.filter((entry) => entry.skipped);

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        total: rows.length,
        updates: updates.length,
        skipped: skipped.length,
        sample: updates.slice(0, 8).map((entry) => ({
          slug: entry.slug,
          shortDescEn: entry.shortDescEn,
          shortDescUa: entry.shortDescUa,
        })),
      },
      null,
      2
    )
  );

  if (DRY_RUN) {
    await prisma.$disconnect();
    return;
  }

  for (const entry of updates) {
    await prisma.shopProduct.update({
      where: { id: entry.id },
      data: {
        shortDescEn: entry.shortDescEn,
        shortDescUa: entry.shortDescUa,
        longDescEn: entry.longDescEn,
        longDescUa: entry.longDescUa,
        bodyHtmlEn: entry.bodyHtmlEn,
        bodyHtmlUa: entry.bodyHtmlUa,
        seoDescriptionEn: entry.seoDescriptionEn,
        seoDescriptionUa: entry.seoDescriptionUa,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
