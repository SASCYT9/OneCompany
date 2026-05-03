/**
 * Rebuild iPE products from their NATIVE iPE-feed variant structure
 * (instead of my earlier 2-variant SS/Ti synthesis). Targets the 6 products
 * where the official iPE feed has real option axes (Full/Catback System,
 * Factory/Equal-Length Front Pipe, OPF/Non-OPF, Catted/Catless DP) but my
 * replace-script had collapsed them into a 2-variant SS/Ti pair.
 *
 * For each product:
 *   1. Rebuild iPE option axes verbatim from official-snapshot
 *   2. Recreate one variant per option combination
 *   3. Compute price by summing the matching Excel rows for each combo
 *      (Cat-back System price + Downpipe price for that material)
 *   4. Preserve descriptions, gallery, metafields
 *
 * Pass --apply to write; default is dry-run.
 * Pass --slug <substring> to limit to one product.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SLUG_FILTER_INDEX = process.argv.indexOf('--slug');
const SLUG_FILTER = SLUG_FILTER_INDEX !== -1 ? process.argv[SLUG_FILTER_INDEX + 1] : null;

const TARGETS: Array<{
  slug: string;
  modelTokens: string[];
  // Excel section name lookup keys per option category
  sectionMap: {
    catbackFactory?: string;
    catbackEqual?: string;
    downpipeCatted?: string;
    downpipeCatless?: string;
    fullSystem?: string;
    catbackTi?: string;
  };
}> = [
  {
    slug: 'ipe-bmw-m3-m4-g80-g82-exhaust',
    modelTokens: ['m3', 'g80'],
    sectionMap: {
      catbackFactory: 'Cat Back System (Factory Front Pipe)',
      catbackEqual: 'Cat Back System (Equal-Length Front Pipe)',
      downpipeCatted: 'Downpipe', // distinguish via material/desc
      downpipeCatless: 'Downpipe',
      catbackTi: 'Cat Back System (Equal-Length Front Pipe)', // Ti only equal-length
    },
  },
];

type ParsedRow = {
  sku?: string;
  model: string;
  section?: string | null;
  material?: string | null;
  description?: string | null;
  price_kind?: string;
  retail_usd?: number | null;
  msrp_usd?: number | null;
};

function loadParsedPricelist(): ParsedRow[] {
  const raw = JSON.parse(
    require('node:fs').readFileSync('artifacts/ipe-price-list/2026-04-pricelist.parsed.json', 'utf8')
  );
  const all = raw.entries || raw.items || raw;
  if (Array.isArray(all)) return all as ParsedRow[];
  const out: ParsedRow[] = [];
  const flatten = (o: unknown) => {
    if (!o || typeof o !== 'object') return;
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) out.push(...(v as ParsedRow[]));
      else flatten(v);
    }
  };
  flatten(all);
  return out;
}

function rowMatchesModel(row: ParsedRow, tokens: string[]): boolean {
  const model = (row.model ?? '').toLowerCase();
  return tokens.every((t) => model.includes(t.toLowerCase()));
}

async function findLatestSnapshot() {
  const dirs = (await fs.readdir('artifacts/ipe-import', { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const dir of dirs) {
    const p = path.join('artifacts/ipe-import', dir, 'official-snapshot.json');
    if (existsSync(p)) {
      return JSON.parse(await fs.readFile(p, 'utf-8'));
    }
  }
  throw new Error('No iPE snapshot found.');
}

function syntheticSku(handle: string, suffix: string): string {
  const digest = createHash('sha1').update(`${handle}::${suffix}`).digest('hex').slice(0, 8).toUpperCase();
  const prefix = handle.replace(/[^a-z0-9]/gi, '').slice(0, 24).toUpperCase();
  return `IPE-${prefix}-${digest}`;
}

type OfficialVariant = {
  title: string;
  optionValues: string[];
};

type NewVariant = {
  title: string;
  sku: string;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  priceUsd: number;
  isDefault: boolean;
  position: number;
};

function pickPriceForG80Combo(rows: ParsedRow[], combo: string[]): number | null {
  // combo = [Exhaust System (Full/Catback), Design (Factory/Equal-Length), Downpipe (Catted/Catless)]
  const isCatted = /catted/i.test(combo[2]);
  const isFactory = /factory/i.test(combo[1]);
  // Cat Back System price
  const catbackRow = rows.find((r) =>
    (r.section || '').toLowerCase().includes(`cat back system (${isFactory ? 'factory' : 'equal-length'} front pipe)`) &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    r.retail_usd
  );
  // Downpipe price
  const downpipeRow = rows.find((r) =>
    (r.section || '').toLowerCase() === 'downpipe' &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    (isCatted ? /catted/i.test(r.description || '') : /catless/i.test(r.description || '')) &&
    r.retail_usd
  );
  if (!catbackRow || !downpipeRow) return null;
  return (catbackRow.retail_usd || 0) + (downpipeRow.retail_usd || 0);
}

// Per-product variant pricing logic
type Pricer = (rows: ParsedRow[], optionValues: string[]) => number | null;

const G80_PRICER: Pricer = (rows, combo) => {
  const isCatted = /catted/i.test(combo[2]);
  const isFactory = /factory/i.test(combo[1]);
  const cb = rows.find((r) =>
    (r.section || '').toLowerCase().includes(`cat back system (${isFactory ? 'factory' : 'equal-length'} front pipe)`) &&
    (r.material || '').toLowerCase().trim() === 'ss' && r.retail_usd
  );
  const dp = rows.find((r) =>
    (r.section || '').toLowerCase() === 'downpipe' &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    (isCatted ? /catted/i.test(r.description || '') : /catless/i.test(r.description || '')) && r.retail_usd
  );
  if (!cb || !dp) return null;
  return (cb.retail_usd || 0) + (dp.retail_usd || 0);
};

const GT3_992_PRICER: Pricer = (rows, combo) => {
  // [Material, OPF/Non-OPF]
  const isTi = /titanium/i.test(combo[0]);
  const cb = rows.find((r) =>
    (r.section || '').toLowerCase() === 'header back system' &&
    (r.material || '').toLowerCase().trim() === (isTi ? 'ti' : 'ss') && r.retail_usd
  );
  return cb?.retail_usd ?? null;
};

const PORSCHE_718_GT4_BODYKIT_PRICER: Pricer = (rows, combo) => {
  // [Material(SS), Exhaust System (Full/Catback), Downpipe (Catted/Catless × OPF/Non-OPF)]
  const isCatted = /catted/i.test(combo[2]);
  const isOpf = /\bopf\b/i.test(combo[2]) && !/non[- ]?opf/i.test(combo[2]);
  // Cat Back System SS for "718 With 718 GT4 Bodykit"
  const cb = rows.find((r) =>
    (r.section || '').toLowerCase() === 'cat back system' &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    /bodykit|with 718 gt4/i.test(r.description || '') && r.retail_usd
  );
  const dp = rows.find((r) =>
    (r.section || '').toLowerCase() === 'downpipe' &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    (isCatted ? /catted/i.test(r.description || '') : /catless/i.test(r.description || '')) &&
    (isOpf ? /※\s*opf/i.test(r.description || '') : /non[- ]?opf/i.test(r.description || '')) &&
    /718/i.test(r.description || '') && r.retail_usd
  );
  if (!cb || !dp) return null;
  return (cb.retail_usd || 0) + (dp.retail_usd || 0);
};

const HURACAN_TECNICA_PRICER: Pricer = (rows) => {
  const cb = rows.find((r) =>
    (r.section || '').toLowerCase() === 'cat back system' &&
    (r.material || '').toLowerCase().trim() === 'ss' && r.retail_usd
  );
  return cb?.retail_usd ?? null;
};

const CAYENNE_E3_PRICER: Pricer = (rows, combo) => {
  // [Material(SS), Exhaust System (Full/Catback), Downpipe (Catted)]
  const isFull = /full system/i.test(combo[1]);
  const cb = rows.find((r) =>
    (r.section || '').toLowerCase() === 'cat back system' &&
    (r.material || '').toLowerCase().trim() === 'ss' && r.retail_usd
  );
  if (!cb) return null;
  if (!isFull) return cb.retail_usd ?? null;
  // Full System = Cat Back + cheapest catted downpipe
  const dp = rows.find((r) =>
    (r.section || '').toLowerCase() === 'downpipe' &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    /catted/i.test(r.description || '') && r.retail_usd
  );
  return (cb.retail_usd || 0) + (dp?.retail_usd || 0);
};

const M240I_G42_PRICER: Pricer = (rows, combo) => {
  // [Exhaust System, Downpipe (200 Cell OPF / Catless OPF)]
  const is200Cell = /200/i.test(combo[1]);
  const cb = rows.find((r) =>
    (r.section || '').toLowerCase().includes('cat back system') &&
    (r.material || '').toLowerCase().trim() === 'ss' && r.retail_usd
  );
  const dp = rows.find((r) =>
    (r.section || '').toLowerCase() === 'downpipe' &&
    (r.material || '').toLowerCase().trim() === 'ss' &&
    (is200Cell ? /catted/i.test(r.description || '') : /catless/i.test(r.description || '')) && r.retail_usd
  );
  if (!cb || !dp) return null;
  return (cb.retail_usd || 0) + (dp.retail_usd || 0);
};

const PRODUCTS: Array<{
  slug: string;
  modelTokens: string[];
  pricer: Pricer;
  bonusTi?: { title: string; option1: string; option2: string | null; option3: string | null; rowFinder: (rows: ParsedRow[]) => ParsedRow | undefined };
}> = [
  {
    slug: 'ipe-bmw-m3-m4-g80-g82-exhaust',
    modelTokens: ['m3', 'g80'],
    pricer: G80_PRICER,
    bonusTi: {
      title: 'Cat Back System (Equal-Length Front Pipe) · Titanium',
      option1: 'Catback System', option2: 'Equal-Length Front Pipe', option3: 'Titanium',
      rowFinder: (rows) => rows.find((r) => (r.material || '').toLowerCase() === 'ti' && (r.section || '').toLowerCase().includes('cat back') && r.retail_usd),
    },
  },
  { slug: 'ipe-porsche-911-gt3-992-catback-system', modelTokens: ['992', 'gt3'], pricer: GT3_992_PRICER },
  { slug: 'ipe-porsche-718-cayman-boxster-2-5t-982-with-718-gt4-bodykit-exhaust-system', modelTokens: ['718', '982'], pricer: PORSCHE_718_GT4_BODYKIT_PRICER },
  { slug: 'ipe-lamborghini-huracan-tecnica-exhaust-system', modelTokens: ['tecnica'], pricer: HURACAN_TECNICA_PRICER },
  { slug: 'ipe-porsche-cayenne-cayenne-coupe-e3-exhaust', modelTokens: ['cayenne', 'e3'], pricer: CAYENNE_E3_PRICER },
  { slug: 'ipe-bmw-m240i-g42-exhaust-system', modelTokens: ['m240', 'g42'], pricer: M240I_G42_PRICER },
];

async function rebuildOne(target: typeof PRODUCTS[0]) {
  if (SLUG_FILTER && !target.slug.includes(SLUG_FILTER)) return;
  const slug = target.slug;
  console.log(`\n=== ${slug} ===`);

  const snapshot = await findLatestSnapshot();
  const items = (snapshot.products || snapshot) as Array<{ handle: string; options: any[]; variants: OfficialVariant[] }>;
  const official = items.find((it) => it.handle === slug.replace(/^ipe-/, ''));
  if (!official) { console.log('  Official feed missing — skip'); return; }

  const pricelist = loadParsedPricelist();
  const rows = pricelist.filter((r) => rowMatchesModel(r, target.modelTokens));

  const product = await prisma.shopProduct.findFirst({
    where: { slug },
    include: { variants: true, options: true },
  });
  if (!product) { console.log('  Product missing in DB — skip'); return; }

  const newVariants: NewVariant[] = [];
  let pos = 0;
  const handlePrefix = slug.replace(/^ipe-/, '').replace(/-exhaust(-system)?$/, '');
  for (const v of official.variants) {
    const price = target.pricer(rows, v.optionValues);
    if (!price) {
      console.log(`  ⚠ no price for combo: ${v.optionValues.join(' / ')}`);
      continue;
    }
    pos += 1;
    newVariants.push({
      title: v.title,
      sku: syntheticSku(handlePrefix, v.optionValues.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '')),
      option1Value: v.optionValues[0] ?? null,
      option2Value: v.optionValues[1] ?? null,
      option3Value: v.optionValues[2] ?? null,
      priceUsd: price,
      isDefault: pos === 1,
      position: pos,
    });
  }

  if (target.bonusTi) {
    const tiRow = target.bonusTi.rowFinder(rows);
    if (tiRow) {
      pos += 1;
      newVariants.push({
        title: target.bonusTi.title,
        sku: syntheticSku(handlePrefix, 'bonus-ti'),
        option1Value: target.bonusTi.option1,
        option2Value: target.bonusTi.option2,
        option3Value: target.bonusTi.option3,
        priceUsd: tiRow.retail_usd || 0,
        isDefault: false,
        position: pos,
      });
    }
  }

  console.log(`  Plan: ${newVariants.length} variants`);
  for (const v of newVariants) {
    console.log(`    - ${v.title}  $${v.priceUsd}${v.isDefault ? ' [DEF]' : ''}`);
  }
  if (!APPLY) { console.log('  Dry-run.'); return; }

  const oldIds = product.variants.map((v) => v.id);
  if (oldIds.length) {
    const refs =
      (await prisma.shopOrderItem.count({ where: { variantId: { in: oldIds } } })) +
      (await prisma.shopCartItem.count({ where: { variantId: { in: oldIds } } }));
    if (refs > 0) throw new Error('FK refs exist');
  }

  const officialOpts = (official as any).options as Array<{ name: string; values: string[] }>;
  await prisma.$transaction(async (tx) => {
    await tx.shopProductOption.deleteMany({ where: { productId: product.id } });
    await tx.shopProductVariant.deleteMany({ where: { productId: product.id } });

    for (let i = 0; i < officialOpts.length; i++) {
      const opt = officialOpts[i];
      const isLast = i === officialOpts.length - 1;
      const values = isLast && target.bonusTi
        ? [...new Set([...opt.values, target.bonusTi.option3 || target.bonusTi.option2 || target.bonusTi.option1])]
        : opt.values;
      await tx.shopProductOption.create({
        data: { productId: product.id, name: opt.name, position: i + 1, values },
      });
    }

    for (const v of newVariants) {
      await tx.shopProductVariant.create({
        data: {
          productId: product.id,
          title: v.title, sku: v.sku, position: v.position,
          option1Value: v.option1Value, option2Value: v.option2Value, option3Value: v.option3Value,
          inventoryQty: 0, inventoryPolicy: 'CONTINUE',
          priceUsd: new Prisma.Decimal(v.priceUsd),
          requiresShipping: true, taxable: true, isDefault: v.isDefault,
        },
      });
    }
    const def = newVariants.find((v) => v.isDefault) ?? newVariants[0];
    await tx.shopProduct.update({
      where: { id: product.id },
      data: { priceUsd: new Prisma.Decimal(def.priceUsd), sku: def.sku },
    });

    const mat = await tx.shopProductMetafield.findFirst({
      where: { productId: product.id, namespace: 'ipe', key: 'gallery_image_materials' },
    });
    if (mat) await tx.shopProductMetafield.delete({ where: { id: mat.id } });
  });

  console.log('  ✓ rebuilt');
}

async function main() {
  for (const t of PRODUCTS) {
    try { await rebuildOne(t); } catch (e) { console.error(t.slug, ':', (e as Error).message); }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
