import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

const TEST_HINTS = [
  /\btest\b/i,
  /\bsample\b/i,
  /\bplaceholder\b/i,
  /\blorem ipsum\b/i,
  /\bdummy\b/i,
  /\bfoo\b|\bbar\b|\bbaz\b/i,
  /\btodo\b/i,
  /\bxxx\b/i,
  /\bdebug\b/i,
  /\bdraft\b/i,
  /\bcoming soon\b/i,
];

const STUB_HINTS = [
  /^[a-z0-9-]+$/i, // kebab-only title (looks like a slug, not a name)
];

async function run() {
  const rows = await p.shopProduct.findMany({
    where: {
      isPublished: true,
      OR: [
        { brand: { contains: 'akrapovi', mode: 'insensitive' } },
        { slug: { startsWith: 'akrapovic-' } },
      ],
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      titleEn: true,
      titleUa: true,
      shortDescUa: true,
      shortDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      productType: true,
      categoryEn: true,
      categoryUa: true,
      priceEur: true,
      priceUah: true,
      priceUsd: true,
      tags: true,
    },
  });

  console.log(`Total Akrapovič rows (published): ${rows.length}\n`);

  const findings = {
    total: rows.length,
    testKeywordHits: [],
    suspiciousTitles: [],
    emptyTitleEn: [],
    emptyTitleUa: [],
    titleMismatch: [],
    nonAkrapovicTitle: [],
    zeroPriceAll: [],
    onlyEurPrice: [],
    missingSkuAndUntitled: [],
    duplicates: [],
    weirdSkuFormat: [],
    productTypeBleed: [],
    bodyHtmlEnglishOnly: [],
    htmlScriptOrIframe: [],
    excessivelyShort: [],
  };

  // Slug → first row map for duplicates
  const slugSeen = new Map();
  // titleEn → list for duplicate detection
  const titleEnGroups = new Map();

  for (const row of rows) {
    // 1. Test / placeholder keyword in any text field
    const allText = [
      row.titleEn,
      row.titleUa,
      row.shortDescEn,
      row.shortDescUa,
      row.bodyHtmlEn,
      row.bodyHtmlUa,
    ]
      .filter(Boolean)
      .join(' ');
    for (const rx of TEST_HINTS) {
      if (rx.test(allText)) {
        findings.testKeywordHits.push({
          slug: row.slug,
          pattern: rx.toString(),
          match: allText.match(rx)?.[0] ?? '',
          field: row.titleEn?.match(rx)
            ? 'titleEn'
            : row.titleUa?.match(rx)
              ? 'titleUa'
              : 'description',
        });
        break;
      }
    }

    // 2. Empty critical fields
    if (!row.titleEn?.trim()) findings.emptyTitleEn.push(row.slug);
    if (!row.titleUa?.trim()) findings.emptyTitleUa.push(row.slug);

    // 3. Title looks like a slug or single word
    const titleEn = (row.titleEn || '').trim();
    if (titleEn && /^[a-z0-9-]+$/i.test(titleEn) && titleEn.includes('-')) {
      findings.suspiciousTitles.push({ slug: row.slug, titleEn });
    }
    if (titleEn && titleEn.length < 8 && !/^AKRAPOVIC/i.test(titleEn)) {
      findings.suspiciousTitles.push({ slug: row.slug, titleEn });
    }

    // 4. titleEn doesn't start with "AKRAPOVIC" (almost all real Akrapovič
    //    products start with the brand wordmark)
    if (titleEn && !/^\s*AKRAPOVI[CČ]/i.test(titleEn)) {
      findings.nonAkrapovicTitle.push({ slug: row.slug, titleEn: titleEn.slice(0, 80) });
    }

    // 5. Zero price
    if (
      (row.priceEur ?? 0) === 0 &&
      (row.priceUsd ?? 0) === 0 &&
      (row.priceUah ?? 0) === 0
    ) {
      findings.zeroPriceAll.push({ slug: row.slug, titleEn: titleEn.slice(0, 60) });
    }

    // 6. SKU present but format looks weird
    if (row.sku && !/^[A-Z0-9]+(?:[-/][A-Z0-9]+)*$/i.test(row.sku.trim())) {
      findings.weirdSkuFormat.push({ slug: row.slug, sku: row.sku });
    }

    // 7. HTML script / iframe in body
    const bodies = [row.bodyHtmlEn, row.bodyHtmlUa, row.shortDescEn, row.shortDescUa]
      .filter(Boolean)
      .join('\n');
    if (/<script|<iframe|javascript:/i.test(bodies)) {
      findings.htmlScriptOrIframe.push({ slug: row.slug });
    }

    // 8. Both titles missing AND no sku → ghost
    if (!row.titleEn?.trim() && !row.titleUa?.trim() && !row.sku) {
      findings.missingSkuAndUntitled.push({ slug: row.slug });
    }

    // 9. Body shorter than expected when title looks like a real product
    const bodyText = (row.bodyHtmlUa || row.bodyHtmlEn || '').replace(/<[^>]+>/g, '').trim();
    if (titleEn && titleEn.length > 30 && bodyText.length > 0 && bodyText.length < 25) {
      findings.excessivelyShort.push({ slug: row.slug, titleEn: titleEn.slice(0, 60), bodyLen: bodyText.length });
    }

    // 10. productType weirdness — should not be the literal title or a long sentence
    if (row.productType && row.productType.length > 60) {
      findings.productTypeBleed.push({
        slug: row.slug,
        productType: row.productType.slice(0, 100),
      });
    }

    // 11. Duplicate detection
    if (slugSeen.has(row.slug)) {
      findings.duplicates.push({ slug: row.slug, type: 'duplicate-slug' });
    } else {
      slugSeen.set(row.slug, row.id);
    }
    if (titleEn) {
      const list = titleEnGroups.get(titleEn) ?? [];
      list.push(row.slug);
      titleEnGroups.set(titleEn, list);
    }
  }

  // Title duplicates across slugs
  for (const [titleEn, slugs] of titleEnGroups) {
    if (slugs.length > 1) {
      findings.duplicates.push({ titleEn: titleEn.slice(0, 80), slugs, count: slugs.length });
    }
  }

  // Output
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `akrapovic-catalog-audit-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2), 'utf8');

  console.log('=== Akrapovič catalog audit ===');
  console.log(`Test/placeholder keyword hits: ${findings.testKeywordHits.length}`);
  console.log(`Empty titleEn:                 ${findings.emptyTitleEn.length}`);
  console.log(`Empty titleUa:                 ${findings.emptyTitleUa.length}`);
  console.log(`Suspicious slug-like titles:   ${findings.suspiciousTitles.length}`);
  console.log(`Title doesn't start AKRAPOVIC: ${findings.nonAkrapovicTitle.length}`);
  console.log(`Zero price (all currencies):   ${findings.zeroPriceAll.length}`);
  console.log(`Weird SKU format:              ${findings.weirdSkuFormat.length}`);
  console.log(`Script / iframe in HTML:       ${findings.htmlScriptOrIframe.length}`);
  console.log(`Excessively short body:        ${findings.excessivelyShort.length}`);
  console.log(`productType bleed (too long):  ${findings.productTypeBleed.length}`);
  console.log(`Duplicates by titleEn:         ${findings.duplicates.filter(d => d.slugs).length}`);
  console.log(`Untitled + no SKU (ghosts):    ${findings.missingSkuAndUntitled.length}`);
  console.log(`\nReport: ${outPath}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
