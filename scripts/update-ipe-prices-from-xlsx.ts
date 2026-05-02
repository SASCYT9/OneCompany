#!/usr/bin/env tsx
/**
 * Re-prices iPE shop variants against the April 2026 V2.0 USD price list.
 *
 * Why this script (vs. running import-ipe-catalog.ts again):
 *   - The full importer re-crawls Shopify, re-translates, rewrites images, and
 *     overwrites the polished UA copy / fitment metadata that already lives in
 *     the DB. We only want price refreshes for products already in the catalog.
 *
 * What it does:
 *   1. Loads the latest official-snapshot.json + match-manifest.json (the
 *      mapping of price-list rows → product handles from the previous import).
 *   2. Loads the 2025 PDF-derived parsed list (the row template the manifest
 *      points into) and the new 2026 xlsx-derived parsed list.
 *   3. For every iPE product in the DB, scopes its rows from the manifest,
 *      replaces each row's msrp_usd / retail_usd with the value found at the
 *      same SKU in the 2026 list (when present), runs the existing
 *      `resolveIpeVariantPricing`, and updates `ShopProductVariant.priceUsd`.
 *   4. Prints a diff table — only variants whose USD price actually moved.
 *
 * Pass --commit to write to the DB; default is dry-run.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaClient } from '@prisma/client';

import {
  buildIpeVariantCandidates,
  resolveIpeVariantPricing,
  type IpeOfficialProductSnapshot,
  type IpeOfficialSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from '../src/lib/ipeCatalogImport';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

const ART_ROOT = path.join(process.cwd(), 'artifacts');
const SNAPSHOT_DIR = path.join(ART_ROOT, 'ipe-import', '2026-04-22T18-48-06-934Z');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'official-snapshot.json');
const MANIFEST_PATH = path.join(SNAPSHOT_DIR, 'match-manifest.json');
const OLD_PRICE_LIST_PATH = path.join(ART_ROOT, 'ipe-price-list', '2025-price-list.parsed.json');
const NEW_PRICE_LIST_PATH = path.join(ART_ROOT, 'ipe-price-list', '2026-04-pricelist.parsed.json');

type ManifestRow = {
  rowIndex: number;
  sku: string;
  priceKind: string;
  brand: string;
  officialHandle: string | null;
  status?: string;
};

type ManifestFile = {
  rows: ManifestRow[];
};

function variantSignature(values: ReadonlyArray<string | null | undefined>) {
  return values.map((v) => (v ?? '').trim().toLowerCase()).filter(Boolean).join(' | ');
}

function sanitizeModelString(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  // The 2025 PDF parser sometimes glued cross-section header tokens into the
  // model string, e.g. `"GT3 ... | 992 | (Stainless) | (Stainless + Ti)"`.
  // Those bracketed material/finish notes break MATERIAL_PATTERNS — the SS
  // catback row ends up classified as Ti because "Ti" is a literal inside
  // "(Stainless + Ti)". Strip any "|"-separated fragment that's mostly a
  // material/finish tag in parens.
  const fragments = value.split('|').map((f) => f.trim()).filter(Boolean);
  const cleaned = fragments.filter((f) => {
    const stripped = f.replace(/^\(|\)$/g, '').trim();
    if (!stripped) return false;
    return !/^(stainless(?:\s+steel)?(?:\s*\+\s*ti(?:tanium)?)?|titanium|ti|ss|carbon(?:\s+fiber)?|cf)$/i.test(stripped);
  });
  return cleaned.join(' | ') || null;
}

function patchRowFromNew(
  oldRow: IpeParsedPriceListRow,
  newRow: IpeParsedPriceListRow | null
): IpeParsedPriceListRow | null {
  if (!newRow) return null;
  // Update the pricing fields from the new list, but also scrub the model
  // string of stray "(Stainless + Ti)" type fragments left over from the PDF
  // parser — they cause `buildIpeCanonicalTokenSetFromPriceRow` to misclassify
  // SS rows as Ti and end up picking the wrong base row.
  return {
    ...oldRow,
    model: sanitizeModelString(oldRow.model),
    msrp_usd: newRow.msrp_usd ?? oldRow.msrp_usd,
    import_fee_usd: newRow.import_fee_usd ?? oldRow.import_fee_usd,
    retail_usd: newRow.retail_usd ?? oldRow.retail_usd,
    price_kind: newRow.price_kind ?? oldRow.price_kind,
  };
}

async function main() {
  const commit = process.argv.includes('--commit');
  const handleFilter = process.argv.find((arg) => arg.startsWith('--handle='))?.slice('--handle='.length);

  const [snapshotRaw, manifestRaw, oldRaw, newRaw] = await Promise.all([
    fs.readFile(SNAPSHOT_PATH, 'utf8'),
    fs.readFile(MANIFEST_PATH, 'utf8'),
    fs.readFile(OLD_PRICE_LIST_PATH, 'utf8'),
    fs.readFile(NEW_PRICE_LIST_PATH, 'utf8'),
  ]);
  const snapshot: IpeOfficialSnapshot = JSON.parse(snapshotRaw);
  const manifest: ManifestFile = JSON.parse(manifestRaw);
  const oldList: IpeParsedPriceList = JSON.parse(oldRaw);
  const newList: IpeParsedPriceList = JSON.parse(newRaw);

  // SKU → new row lookup. Some SKUs repeat (different brands' tip add-ons share
  // the same generic SKU) so we keep all of them and pick the closest by brand.
  const newBySkuByBrand = new Map<string, Map<string, IpeParsedPriceListRow>>();
  for (const row of newList.items) {
    if (!row.sku) continue;
    let brandMap = newBySkuByBrand.get(row.sku);
    if (!brandMap) {
      brandMap = new Map();
      newBySkuByBrand.set(row.sku, brandMap);
    }
    if (!brandMap.has(row.brand)) brandMap.set(row.brand, row);
  }

  function lookupNewRow(sku: string, brand: string): IpeParsedPriceListRow | null {
    const brandMap = newBySkuByBrand.get(sku);
    if (!brandMap) return null;
    return brandMap.get(brand) ?? brandMap.values().next().value ?? null;
  }

  // Group manifest rows by handle.
  const rowsByHandle = new Map<string, ManifestRow[]>();
  for (const row of manifest.rows) {
    if (!row.officialHandle) continue;
    const list = rowsByHandle.get(row.officialHandle) ?? [];
    list.push(row);
    rowsByHandle.set(row.officialHandle, list);
  }

  let scanned = 0;
  let unchanged = 0;
  let changed = 0;
  let resolveFailed = 0;
  const diffs: Array<{
    handle: string;
    title: string;
    optionValues: string[];
    oldUsd: number | null;
    newUsd: number | null;
  }> = [];
  const updates: Array<{ variantId: string; priceUsd: number }> = [];

  for (const product of snapshot.products) {
    if (handleFilter && product.handle !== handleFilter) continue;
    const manifestRows = rowsByHandle.get(product.handle);
    if (!manifestRows || manifestRows.length === 0) continue;
    scanned += 1;

    // Build price rows scoped to this product, replacing 2025 prices with 2026.
    const priceRows: IpeParsedPriceListRow[] = [];
    for (const m of manifestRows) {
      const oldRow = oldList.items[m.rowIndex];
      if (!oldRow) continue;
      const newRow = lookupNewRow(oldRow.sku, oldRow.brand);
      const patched = patchRowFromNew(oldRow, newRow);
      if (patched) priceRows.push(patched);
    }
    if (!priceRows.length) continue;

    // Pull the DB product. iPE Shopify handles like "bmw-m3-m4-g80-g82-exhaust"
    // map onto our slugs as "ipe-bmw-m3-m4-g80-g82-exhaust" (the importer
    // namespaces them) — try both forms.
    const dbProduct = await prisma.shopProduct.findFirst({
      where: { slug: { in: [product.handle, `ipe-${product.handle}`] } },
      include: { variants: true },
    });
    if (!dbProduct) continue;

    const candidates = buildIpeVariantCandidates(product as IpeOfficialProductSnapshot, priceRows);
    const candidateBySig = new Map<string, ReturnType<typeof resolveIpeVariantPricing>>();
    const candidateBySku = new Map<string, ReturnType<typeof resolveIpeVariantPricing>>();
    for (const candidate of candidates) {
      const pricing = resolveIpeVariantPricing(product as IpeOfficialProductSnapshot, candidate, priceRows);
      candidateBySig.set(variantSignature(candidate.optionValues), pricing);
      const candidateSku = candidate.baseRow?.sku ?? null;
      if (candidateSku) candidateBySku.set(candidateSku, pricing);
    }

    for (const dbVariant of dbProduct.variants) {
      const sig = variantSignature([
        dbVariant.option1Value,
        dbVariant.option2Value,
        dbVariant.option3Value,
      ]);
      // Prefer SKU-based matching when the DB variant carries a non-synthetic
      // SKU — the option-value text in the DB was generated from the previous
      // price list, so the same row often has a slightly different
      // section/description string in the new list (e.g. an extra "OPF
      // Version" appendix). SKU is the stable join key.
      let pricing: ReturnType<typeof resolveIpeVariantPricing> | undefined;
      if (dbVariant.sku && !dbVariant.sku.startsWith('IPE-')) {
        pricing = candidateBySku.get(dbVariant.sku);
      }
      if (!pricing && sig) {
        pricing = candidateBySig.get(sig);
      }
      if (!pricing || pricing.priceUsd == null || pricing.priceUsd <= 0) {
        resolveFailed += 1;
        continue;
      }
      const newUsd = Number(pricing.priceUsd);
      const oldUsd = dbVariant.priceUsd != null ? Number(dbVariant.priceUsd) : null;
      if (oldUsd != null && Math.abs(oldUsd - newUsd) < 0.01) {
        unchanged += 1;
        continue;
      }
      changed += 1;
      diffs.push({
        handle: product.handle,
        title: product.title,
        optionValues: [
          dbVariant.option1Value,
          dbVariant.option2Value,
          dbVariant.option3Value,
        ].filter((v): v is string => Boolean(v)),
        oldUsd,
        newUsd,
      });
      updates.push({ variantId: dbVariant.id, priceUsd: newUsd });
    }
  }

  console.log(`Scanned ${scanned} iPE products from snapshot.`);
  console.log(`Variant updates: ${changed} | unchanged: ${unchanged} | resolve-failed: ${resolveFailed}`);
  if (diffs.length) {
    console.log('\nFirst 25 changes:');
    for (const d of diffs.slice(0, 25)) {
      const opt = d.optionValues.join(' / ');
      console.log(
        `  [${d.handle}] ${opt}\n    $${d.oldUsd ?? '?'} -> $${d.newUsd}`
      );
    }
  }

  if (commit && updates.length) {
    console.log(`\nCommitting ${updates.length} variant price updates...`);
    let n = 0;
    for (const u of updates) {
      await prisma.shopProductVariant.update({
        where: { id: u.variantId },
        data: { priceUsd: new Decimal(u.priceUsd.toFixed(2)) },
      });
      n += 1;
      if (n % 25 === 0) console.log(`  ...${n} updated`);
    }
    console.log(`Done: ${n} variants updated.`);
  } else if (!commit) {
    console.log('\n(dry run — pass --commit to write)');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
