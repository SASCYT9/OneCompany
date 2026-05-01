#!/usr/bin/env tsx
/**
 * Targeted DB repair for the iPE BMW M3/M4 G80/G82 product page.
 *
 * Fixes three things without a full reimport:
 *   1. Variant prices — the import bundled cat-back + downpipe + tip upgrades
 *      into one $11,020 figure. Real prices come straight from the iPE 2025
 *      USD price list (parsed JSON). Cat-back + Factory Front Pipe = $6,300;
 *      Full System adds the matching downpipe.
 *   2. Default variant — flips to Cat-back / Factory / Catted (OPF), the
 *      OEM-front-pipe street-legal config that's most commonly purchased.
 *   3. Ukrainian copy — `патрубок` → `труби`, `наконечники` → `насадки`,
 *      `керування клапаном` → `керування клапанами`. OPF warning gets tagged
 *      so the iPE storefront layout can render it as a styled callout.
 *
 * Usage:
 *   pnpm tsx scripts/repair-ipe-bmw-m3-g80.ts        # dry-run, prints diffs
 *   pnpm tsx scripts/repair-ipe-bmw-m3-g80.ts --apply # writes to DB
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();
const SLUG = 'ipe-bmw-m3-m4-g80-g82-exhaust';
const APPLY = process.argv.includes('--apply');

// Prices from artifacts/ipe-price-list/2025-price-list.parsed.json
// (BMW M3/M4 G80/G82 rows, retail_usd column).
const CATBACK_FACTORY = 6300;
const CATBACK_EQUAL = 6600;
const DOWNPIPE_CATTED = 4100;
const DOWNPIPE_CATLESS = 3400;

type VariantOptionContext = {
  isFullSystem: boolean;
  isCatback: boolean;
  frontPipe: 'factory' | 'equal-length' | null;
  downpipe: 'catted' | 'catless' | null;
};

function parseContext(option1?: string | null, option2?: string | null, option3?: string | null): VariantOptionContext {
  const joined = [option1, option2, option3].filter(Boolean).join(' | ').toLowerCase();
  const isFullSystem = /\bfull\s*system\b/.test(joined);
  return {
    isFullSystem,
    isCatback: !isFullSystem && /\bcat\s*back\b|\bcatback\b/.test(joined),
    frontPipe: /\bequal[- ]length\b/.test(joined) ? 'equal-length' : /\bfactory\b/.test(joined) ? 'factory' : null,
    downpipe: /\bcatless\b/.test(joined) ? 'catless' : /\bcatted\b/.test(joined) ? 'catted' : null,
  };
}

function priceForVariant(ctx: VariantOptionContext): number {
  const catback = ctx.frontPipe === 'equal-length' ? CATBACK_EQUAL : CATBACK_FACTORY;
  if (ctx.isFullSystem) {
    const dp = ctx.downpipe === 'catless' ? DOWNPIPE_CATLESS : DOWNPIPE_CATTED;
    return catback + dp;
  }
  return catback;
}

function defaultScore(ctx: VariantOptionContext): number {
  let s = 0;
  if (ctx.isCatback) s += 1000;
  if (ctx.frontPipe === 'factory') s += 100;
  if (ctx.downpipe === 'catted') s += 50;
  return s;
}

// JS \b only fires at ASCII word boundaries; Cyrillic needs explicit lookaround.
const CYR = 'А-Яа-яІіЇїЄєҐґ';
const NB = `(?<![${CYR}])`;
const NA = `(?![${CYR}])`;

const UA_REPLACEMENTS: Array<[RegExp, string]> = [
  [new RegExp(`${NB}Передн(?:ій|ьому|ього)\\s+патрубо(?:к|ка|ку|ком|ці)${NA}`, 'gu'), 'Передні труби'],
  [new RegExp(`${NB}Середн(?:ій|ьому|ього)\\s+патрубо(?:к|ка|ку|ком|ці)${NA}`, 'gu'), 'Середні труби'],
  [new RegExp(`${NB}керування\\s+клапаном${NA}`, 'giu'), 'керування клапанами'],
  [new RegExp(`${NB}керуванням\\s+клапаном${NA}`, 'giu'), 'керуванням клапанами'],
  [/клапанам[ИI]\b/g, 'клапанами'],
];

function fixUaCopy(value: string | null | undefined): string {
  if (!value) return value ?? '';
  let out = value;
  for (const [rx, repl] of UA_REPLACEMENTS) {
    out = out.replace(rx, repl);
  }
  out = out.replace(new RegExp(`${NB}Наконечник(и|а|ів|ам|ами|ах)?${NA}`, 'gu'), (_m, s) => {
    const map: Record<string, string> = { '': 'Насадка', 'и': 'Насадки', 'а': 'Насадка', 'ів': 'Насадок', 'ам': 'Насадкам', 'ами': 'Насадками', 'ах': 'Насадках' };
    return map[s ?? ''] ?? 'Насадки';
  });
  out = out.replace(new RegExp(`${NB}наконечник(и|а|ів|ам|ами|ах)?${NA}`, 'gu'), (_m, s) => {
    const map: Record<string, string> = { '': 'насадка', 'и': 'насадки', 'а': 'насадка', 'ів': 'насадок', 'ам': 'насадкам', 'ами': 'насадками', 'ах': 'насадках' };
    return map[s ?? ''] ?? 'насадки';
  });
  // Tag the OPF warning so the storefront can render it as a styled callout.
  out = out.replace(
    /(?:<strong>)?\s*ПОПЕРЕДЖЕННЯ\s*[-–—]\s*Перед\s+покупкою[^<\n]*?Дякуємо\.\s*(?:<\/strong>)?/g,
    (m) => {
      const text = m.replace(/<\/?strong>/gi, '').trim();
      return `<aside data-warning="opf" class="ipe-warning ipe-warning--opf"><strong>${text}</strong></aside>`;
    }
  );
  return out;
}

async function main() {
  const product = await prisma.shopProduct.findUnique({
    where: { slug: SLUG },
    include: { variants: { orderBy: { position: 'asc' } } },
  });
  if (!product) {
    console.error(`Product not found: ${SLUG}`);
    process.exit(1);
  }

  console.log(`Product: ${product.titleEn} (id=${product.id})`);
  console.log(`Variants: ${product.variants.length}\n`);

  // --- Variant updates --------------------------------------------------------
  type VariantPlan = { id: string; title: string; oldPrice: number | null; newPrice: number; defaulting: boolean };
  const plans: VariantPlan[] = [];
  let bestDefault: { id: string; score: number; price: number } | null = null;

  for (const variant of product.variants) {
    const ctx = parseContext(variant.option1Value, variant.option2Value, variant.option3Value);
    const newPrice = priceForVariant(ctx);
    plans.push({ id: variant.id, title: variant.title ?? '(untitled)', oldPrice: variant.priceUsd != null ? Number(variant.priceUsd) : null, newPrice, defaulting: false });
    const sc = defaultScore(ctx);
    if (!bestDefault || sc > bestDefault.score || (sc === bestDefault.score && newPrice < bestDefault.price)) {
      bestDefault = { id: variant.id, score: sc, price: newPrice };
    }
  }
  if (bestDefault) {
    const target = plans.find((p) => p.id === bestDefault!.id);
    if (target) target.defaulting = true;
  }

  console.log('Variant repricing plan:');
  for (const p of plans) {
    const flag = p.defaulting ? ' [DEFAULT]' : '';
    console.log(`  ${p.title}  $${p.oldPrice ?? '?'} -> $${p.newPrice}${flag}`);
  }

  // --- Description updates ----------------------------------------------------
  const fields = ['shortDescUa', 'longDescUa', 'bodyHtmlUa', 'seoDescriptionUa'] as const;
  console.log('\nUkrainian copy diffs:');
  const descUpdates: Partial<Record<(typeof fields)[number], string>> = {};
  for (const field of fields) {
    const before = (product as any)[field] as string | null;
    if (!before) continue;
    const after = fixUaCopy(before);
    if (after !== before) {
      descUpdates[field] = after;
      const beforeSnippet = before.slice(0, 200).replace(/\s+/g, ' ');
      const afterSnippet = after.slice(0, 200).replace(/\s+/g, ' ');
      console.log(`  ${field}:`);
      console.log(`    -  ${beforeSnippet}…`);
      console.log(`    +  ${afterSnippet}…`);
    }
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write changes)');
    await prisma.$disconnect();
    return;
  }

  // --- Apply ------------------------------------------------------------------
  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      await tx.shopProductVariant.update({
        where: { id: p.id },
        data: {
          priceUsd: p.newPrice,
          isDefault: p.defaulting,
        },
      });
    }
    if (Object.keys(descUpdates).length) {
      await tx.shopProduct.update({
        where: { id: product.id },
        data: descUpdates,
      });
    }
    // Set headline product price to the new default's price for the listing card.
    const defaultPlan = plans.find((p) => p.defaulting);
    if (defaultPlan) {
      await tx.shopProduct.update({
        where: { id: product.id },
        data: { priceUsd: defaultPlan.newPrice },
      });
    }
  });
  console.log('\nApplied. Remember to delete .shop-products-dev-cache.json (3h TTL) for local dev.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
