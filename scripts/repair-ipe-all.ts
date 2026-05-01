#!/usr/bin/env tsx
/**
 * Targeted repair across ALL iPE products in the DB:
 *   - Re-price variants using the corrected option-axis logic
 *     (resolveIpeVariantPricing) against the parsed PDF rows that were
 *     matched at import time (saved in the `matched_row_indexes` metafield).
 *   - Flip `isDefault` to whichever variant best matches the
 *     Cat-back / Factory / Catted (OPF) profile that's the most-bought spec.
 *   - Sanitize Ukrainian copy: патрубок→труби, наконечники→насадки,
 *     керування клапаном→клапанами, plus tag the OPF warning as a
 *     <aside data-warning="opf"> callout.
 *
 * Safe relative to a full re-import:
 *   - Does NOT call Gemini or any translation provider.
 *   - Does NOT toggle product status (no DRAFT flip).
 *   - Does NOT touch images, options, metafields, tags, collections.
 *   - Does NOT delete anything.
 *
 * Usage:
 *   pnpm tsx scripts/repair-ipe-all.ts          # dry-run
 *   pnpm tsx scripts/repair-ipe-all.ts --apply  # writes
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

import {
  buildIpeVariantCandidates,
  computeIpeRetailPrice,
  resolveIpeVariantPricing,
  type IpeOfficialProductSnapshot,
  type IpeOfficialSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from '../src/lib/ipeCatalogImport';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const PRICE_LIST_PATH = path.join(process.cwd(), 'artifacts', 'ipe-price-list', '2025-price-list.parsed.json');
const IPE_IMPORT_DIR = path.join(process.cwd(), 'artifacts', 'ipe-import');

// JS \b only fires on ASCII; Cyrillic needs explicit lookarounds.
const CYR = 'А-Яа-яІіЇїЄєҐґ';
const NB = `(?<![${CYR}])`;
const NA = `(?![${CYR}])`;

function fixUaCopy(value: string | null | undefined): string {
  if (!value) return value ?? '';
  let out = value;
  out = out.replace(new RegExp(`${NB}Передн(?:ій|ьому|ього)\\s+патрубо(?:к|ка|ку|ком|ці)${NA}`, 'gu'), 'Передні труби');
  out = out.replace(new RegExp(`${NB}Середн(?:ій|ьому|ього)\\s+патрубо(?:к|ка|ку|ком|ці)${NA}`, 'gu'), 'Середні труби');
  out = out.replace(new RegExp(`${NB}керування\\s+клапаном${NA}`, 'giu'), 'керування клапанами');
  out = out.replace(new RegExp(`${NB}керуванням\\s+клапаном${NA}`, 'giu'), 'керуванням клапанами');
  out = out.replace(/клапанам[ИI]\b/g, 'клапанами');
  out = out.replace(new RegExp(`${NB}Наконечник(и|а|ів|ам|ами|ах)?${NA}`, 'gu'), (_m, s) => {
    const map: Record<string, string> = { '': 'Насадка', 'и': 'Насадки', 'а': 'Насадка', 'ів': 'Насадок', 'ам': 'Насадкам', 'ами': 'Насадками', 'ах': 'Насадках' };
    return map[s ?? ''] ?? 'Насадки';
  });
  out = out.replace(new RegExp(`${NB}наконечник(и|а|ів|ам|ами|ах)?${NA}`, 'gu'), (_m, s) => {
    const map: Record<string, string> = { '': 'насадка', 'и': 'насадки', 'а': 'насадка', 'ів': 'насадок', 'ам': 'насадкам', 'ами': 'насадками', 'ах': 'насадках' };
    return map[s ?? ''] ?? 'насадки';
  });
  out = out.replace(
    /(?:<strong>)?\s*ПОПЕРЕДЖЕННЯ\s*[-–—]\s*Перед\s+покупкою[^<\n]*?Дякуємо\.\s*(?:<\/strong>)?/g,
    (m) => {
      const text = m.replace(/<\/?strong>/gi, '').trim();
      return `<aside data-warning="opf" class="ipe-warning ipe-warning--opf"><strong>${text}</strong></aside>`;
    }
  );
  return out;
}

function defaultScore(option1: string | null | undefined, option2: string | null | undefined, option3: string | null | undefined): number {
  const j = [option1, option2, option3].filter(Boolean).join(' | ').toLowerCase();
  let s = 0;
  if (/\bcat\s*back\b|\bcatback\b/.test(j) && !/\bfull\s*system\b/.test(j)) s += 1000;
  if (/\bfactory\b/.test(j)) s += 100;
  if (/\bcatted\b/.test(j)) s += 50;
  if (/\bopf\b/.test(j) && !/\bnon[- ]?opf\b/.test(j)) s += 25;
  return s;
}

async function findLatestSnapshot(): Promise<IpeOfficialSnapshot | null> {
  try {
    const dirs = (await fs.readdir(IPE_IMPORT_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
    for (const dir of dirs) {
      const candidate = path.join(IPE_IMPORT_DIR, dir, 'official-snapshot.json');
      try {
        const raw = await fs.readFile(candidate, 'utf-8');
        return JSON.parse(raw) as IpeOfficialSnapshot;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

type RepairStats = {
  productsScanned: number;
  productsRepriced: number;
  productsCopyChanged: number;
  productsDefaultFlipped: number;
  variantsRepriced: number;
};

async function main() {
  const priceList: IpeParsedPriceList = JSON.parse(await fs.readFile(PRICE_LIST_PATH, 'utf-8'));
  const snapshot = await findLatestSnapshot();
  if (!snapshot) {
    console.error('No iPE import artifact found in artifacts/ipe-import/. Run an import first.');
    process.exit(1);
  }

  const products = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { brand: { contains: 'iPE', mode: 'insensitive' } },
        { brand: { contains: 'innotech', mode: 'insensitive' } },
      ],
    },
    include: {
      variants: { orderBy: { position: 'asc' } },
      metafields: { where: { OR: [{ key: 'official_handle' }, { key: 'matched_row_indexes' }] } },
    },
  });

  console.log(`Found ${products.length} iPE products in DB\n`);

  const stats: RepairStats = {
    productsScanned: 0,
    productsRepriced: 0,
    productsCopyChanged: 0,
    productsDefaultFlipped: 0,
    variantsRepriced: 0,
  };

  for (const product of products) {
    stats.productsScanned += 1;

    const officialHandle = product.metafields.find((m) => m.key === 'official_handle')?.value;
    const matchedRowsRaw = product.metafields.find((m) => m.key === 'matched_row_indexes')?.value;
    const matchedRowIndexes = matchedRowsRaw
      ? matchedRowsRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
      : [];

    // --- Re-price variants ---------------------------------------------------
    type VariantUpdate = { id: string; oldPrice: number | null; newPrice: number; defaulting: boolean };
    const updates: VariantUpdate[] = [];

    if (officialHandle && matchedRowIndexes.length) {
      const officialProduct = snapshot.products.find((p) => p.handle === officialHandle);
      if (officialProduct) {
        const priceRows: IpeParsedPriceListRow[] = matchedRowIndexes
          .map((idx) => priceList.items[idx])
          .filter((row): row is IpeParsedPriceListRow => Boolean(row))
          .map((row) =>
            row.price_kind === 'absolute' && row.retail_usd == null
              ? {
                  ...row,
                  retail_usd: computeIpeRetailPrice(row.msrp_usd, {
                    thresholdUsd: priceList.pricing_formula?.threshold_usd,
                    lowFeeUsd: priceList.pricing_formula?.low_fee_usd,
                    highFeeUsd: priceList.pricing_formula?.high_fee_usd,
                  }),
                }
              : row
          );

        const candidates = buildIpeVariantCandidates(officialProduct as IpeOfficialProductSnapshot, priceRows);

        for (const variant of product.variants) {
          // Match DB variant to a candidate by option values.
          const optKey = [variant.option1Value, variant.option2Value, variant.option3Value]
            .filter(Boolean)
            .join(' | ')
            .toLowerCase();
          const candidate = candidates.find((c) => {
            const cKey = c.optionValues.filter(Boolean).join(' | ').toLowerCase();
            return cKey === optKey;
          });
          if (!candidate) continue;
          const pricing = resolveIpeVariantPricing(officialProduct as IpeOfficialProductSnapshot, candidate, priceRows);
          if (pricing.priceUsd == null || pricing.priceUsd <= 0) continue;
          const oldPrice = variant.priceUsd != null ? Number(variant.priceUsd) : null;
          if (oldPrice !== pricing.priceUsd) {
            updates.push({ id: variant.id, oldPrice, newPrice: pricing.priceUsd, defaulting: false });
          }
        }
      }
    }

    // --- Default variant flip ------------------------------------------------
    let bestDefault: { id: string; score: number; price: number } | null = null;
    for (const variant of product.variants) {
      const newPrice =
        updates.find((u) => u.id === variant.id)?.newPrice
          ?? (variant.priceUsd != null ? Number(variant.priceUsd) : Number.POSITIVE_INFINITY);
      if (newPrice <= 0 || !Number.isFinite(newPrice)) continue;
      const sc = defaultScore(variant.option1Value, variant.option2Value, variant.option3Value);
      if (!bestDefault || sc > bestDefault.score || (sc === bestDefault.score && newPrice < bestDefault.price)) {
        bestDefault = { id: variant.id, score: sc, price: newPrice };
      }
    }

    let defaultFlipped = false;
    if (bestDefault) {
      const target = updates.find((u) => u.id === bestDefault!.id);
      if (target) target.defaulting = true;
      const currentDefault = product.variants.find((v) => v.isDefault);
      if (!currentDefault || currentDefault.id !== bestDefault.id) {
        defaultFlipped = true;
        if (!target) {
          // Default flips even if price didn't change.
          updates.push({ id: bestDefault.id, oldPrice: null, newPrice: bestDefault.price, defaulting: true });
        }
      }
    }

    // --- UA copy sanitization ------------------------------------------------
    const fields = ['shortDescUa', 'longDescUa', 'bodyHtmlUa', 'seoDescriptionUa'] as const;
    const descUpdates: Partial<Record<(typeof fields)[number], string>> = {};
    for (const field of fields) {
      const before = (product as any)[field] as string | null;
      if (!before) continue;
      const after = fixUaCopy(before);
      if (after !== before) descUpdates[field] = after;
    }

    const hasChanges = updates.length || Object.keys(descUpdates).length || defaultFlipped;
    if (!hasChanges) continue;

    const headerLine = `${product.titleEn || product.titleUa || product.slug}  (${product.slug})`;
    console.log(headerLine);
    if (updates.length) {
      stats.variantsRepriced += updates.filter((u) => u.oldPrice != null && u.oldPrice !== u.newPrice).length;
      stats.productsRepriced += 1;
      for (const u of updates) {
        const flag = u.defaulting ? ' [DEFAULT]' : '';
        const old = u.oldPrice != null ? `$${u.oldPrice}` : '(no-change)';
        console.log(`  variant  ${old} -> $${u.newPrice}${flag}`);
      }
    } else if (defaultFlipped) {
      console.log(`  default flipped to variant ${bestDefault?.id}`);
    }
    if (defaultFlipped) stats.productsDefaultFlipped += 1;
    if (Object.keys(descUpdates).length) {
      stats.productsCopyChanged += 1;
      console.log(`  UA copy: ${Object.keys(descUpdates).join(', ')}`);
    }
    console.log('');

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.shopProductVariant.update({
          where: { id: u.id },
          data: {
            priceUsd: u.newPrice,
            isDefault: u.defaulting,
          },
        });
      }
      // Clear isDefault on variants we didn't pick — only when we flipped.
      if (defaultFlipped && bestDefault) {
        await tx.shopProductVariant.updateMany({
          where: { productId: product.id, NOT: { id: bestDefault.id } },
          data: { isDefault: false },
        });
      }
      if (Object.keys(descUpdates).length) {
        await tx.shopProduct.update({
          where: { id: product.id },
          data: descUpdates,
        });
      }
      // Sync the product headline price to the new default's price.
      if (bestDefault) {
        await tx.shopProduct.update({
          where: { id: product.id },
          data: { priceUsd: bestDefault.price },
        });
      }
    });
  }

  console.log('---');
  console.log(`Scanned:           ${stats.productsScanned}`);
  console.log(`Repriced:          ${stats.productsRepriced} products / ${stats.variantsRepriced} variants`);
  console.log(`Default flipped:   ${stats.productsDefaultFlipped}`);
  console.log(`UA copy fixed:     ${stats.productsCopyChanged}`);
  if (!APPLY) console.log('\n(dry-run — pass --apply to write)');
  if (APPLY) console.log('\nApplied. Delete .shop-products-dev-cache.json (3h TTL) for local dev.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
