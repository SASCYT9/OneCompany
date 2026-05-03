/**
 * Merge iPE SS/Ti product pairs into single multi-variant products.
 *
 * For each pair (ss-handle, ti-handle):
 *   1. Find the Cat-back SS row and Cat-back Ti row in Excel pricelist
 *      (strict model-token matching against row.model — no cross-platform leaks).
 *   2. Compute retail price (MSRP + $1500/1600 shipping/customs).
 *   3. Replace the SS product's variants with 2 entries (SS + Ti).
 *   4. Upload Ti product's images to Vercel Blob, append to SS gallery,
 *      tag via `ipe.gallery_image_materials` metafield so the PDP swaps
 *      photos when the user toggles material.
 *   5. PRESERVE all existing descriptions on the SS product.
 *   6. If the Ti product exists separately in DB, mark it as DRAFT/unpublished
 *      (don't hard-delete — keeps audit trail and avoids orphaned references).
 *
 * Pass --apply to write; default is dry-run.
 * Pass --pair <slug> to limit to a single pair (matches against ssBaseHandle).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'crypto';
import { PrismaClient, Prisma, type ShopProduct } from '@prisma/client';
import { isBlobStorageConfigured, putPublicBlob } from '@/lib/runtimeBlobStorage';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const PAIR_FILTER_INDEX = process.argv.indexOf('--pair');
const PAIR_FILTER = PAIR_FILTER_INDEX !== -1 ? process.argv[PAIR_FILTER_INDEX + 1] : null;

const BLOB_BASE_URL = 'https://rfip333zgtfizdii.public.blob.vercel-storage.com';

// 16 SS/Ti product pairs that we know exist as siblings in iPE feed AND have
// SS counterpart already in our DB. Format: [ssHandle, tiHandle].
// `ssHandle`/`tiHandle` here are iPE official handles (no `ipe-` prefix).
const PAIRS: Array<[string, string]> = [
  ['audi-rs3-sportback-8v-exhaust', 'audi-rs3-sportback-8v-titanium-exhaust'],
  ['ferrari-458-italia-exhaust', 'ferrari-458-italia-titanium-exhaust'],
  ['ferrari-812-superfast-gts-exhaust', 'ferrari-812-superfast-gts-titanium-exhaust'],
  ['ferrari-f12-berlinetta-exhaust', 'ferrari-f12-berlinetta-titanium-exhaust-system'],
  ['ferrari-gtc4lusso-t-exhaust', 'ferrari-gtc4lusso-t-titanium-exhaust'],
  ['ferrari-portofino-exhaust', 'ferrari-portofino-titanium-exhaust'],
  ['mclaren-540c-570s-570gt-exhaust', 'mclaren-540c-570s-570gt-titanium-exhaust'],
  ['mclaren-600lt-exhaust', 'mclaren-600lt-titanium-exhaust'],
  ['mclaren-650s-exhaust', 'mclaren-650s-titanium-exhaust'],
  ['porsche-718-gts-4-0-718-cayman-gt4-718-spyder-exhaust', 'porsche-718-gts-4-0-718-cayman-gt4-718-spyder-titanium-exhaust'],
  ['porsche-911-carrera-4-s-4s-992-exhaust', 'porsche-911-carrera-4-s-4s-992-titanium-exhaust-system'],
  ['porsche-911-gt3-rs-991-991-2-exhaust', 'porsche-911-gt3-rs-991-991-2-titanium-exhaust-system'],
  ['porsche-911-gt3-rs-997-997-2-exhaust', 'porsche-911-gt3-rs-997-997-2-titanium-exhaust-system'],
  ['porsche-boxster-cayman-981-exhaust', 'porsche-boxster-cayman-981-titanium-exhaust'],
  ['mclaren-720s-exhaust', 'mclaren-720s-titanium'],
  ['porsche-911-turbo-turbo-s-991-991-2-exhaust', 'porsche-911-turbo-turbo-s-991-991-2-titanium'],
];

// Per-pair model tokens override (when handle stripping isn't enough).
// Only specify when the auto-extracted tokens cause mismatches — leave
// undefined to use heuristic.
const MODEL_TOKENS_OVERRIDE: Record<string, string[]> = {
  // Disambiguate from similarly-named platforms in the Excel (we want only
  // 991-era cars when the chassis says 991).
  'porsche-911-gt3-rs-991-991-2-exhaust': ['991', 'gt3'],
  'porsche-911-gt3-rs-997-997-2-exhaust': ['997', 'gt3'],
  'porsche-911-turbo-turbo-s-991-991-2-exhaust': ['991', 'turbo'],
  'porsche-911-carrera-4-s-4s-992-exhaust': ['992', 'carrera'],
  'porsche-718-gts-4-0-718-cayman-gt4-718-spyder-exhaust': ['718', 'gt4'],
  'porsche-boxster-cayman-981-exhaust': ['981'],
  'audi-rs3-sportback-8v-exhaust': ['rs3', '8v'],
  'ferrari-458-italia-exhaust': ['458'],
  'ferrari-812-superfast-gts-exhaust': ['812'],
  'ferrari-f12-berlinetta-exhaust': ['f12'],
  'ferrari-gtc4lusso-t-exhaust': ['lusso'], // Excel writes "GTC4 Lusso T" with space
  'ferrari-portofino-exhaust': ['portofino'],
  'ferrari-f8-tributo-coupe-spider-exhaust': ['f8'],
  'mclaren-540c-570s-570gt-exhaust': ['570s'], // 540C/570S/570GT share platform
  'mclaren-600lt-exhaust': ['600lt'],
  'mclaren-650s-exhaust': ['650s'],
  'mclaren-720s-exhaust': ['720s'],
};

// Markup formula: shop USD = pricelist MSRP + ~$1500-1600 customs/shipping.
const markup = (msrp: number) => msrp + (msrp >= 4000 ? 1600 : 1500);

function stripBrandWords(slug: string): string {
  return slug.replace(/^(porsche|ferrari|mclaren|audi|lamborghini|bmw|mercedes(-benz)?|toyota|subaru)-/, '');
}

function autoExtractTokens(ssHandle: string): string[] {
  // Crude: strip exhaust suffix, brand prefix, then split.
  const stripped = stripBrandWords(ssHandle).replace(/-exhaust(-system)?$/, '');
  return stripped.split('-').filter((t) => t.length >= 2);
}

function getModelTokens(ssHandle: string): string[] {
  return MODEL_TOKENS_OVERRIDE[ssHandle] ?? autoExtractTokens(ssHandle);
}

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

// Section names that represent a complete cat-back-equivalent system that
// we'd quote as the variant's headline price.
const PRIMARY_SECTIONS = [
  'header back system',
  'cat back system',
  'cat-back system',
  'catback system',
  'full system',
  'full exhaust system',
];

// Fallback when the model is sold as separate sections (Ferrari/McLaren split
// systems). "Rear Valvetronic System" is the muffler+rear pipework — the
// closest single SKU to a "main cat-back component". Pricing it as the
// variant's anchor lets the user see ballpark cost; Front/Mid pipes go in
// the upgrade-options note.
const SECONDARY_SECTIONS = ['rear valvetronic system'];

function findCatbackPrice(rows: ParsedRow[], tokens: string[], material: 'SS' | 'Ti'): {
  msrp: number;
  retail: number;
  source: ParsedRow;
  fallback: boolean;
} | null {
  const wantedMaterials = material === 'SS' ? ['ss'] : ['ti', 'ss+ti'];
  const filterBySections = (sections: string[]) =>
    rows.filter((r) => {
      if (!rowMatchesModel(r, tokens)) return false;
      if (r.price_kind !== 'absolute') return false;
      if (typeof r.retail_usd !== 'number' || r.retail_usd <= 0) return false;
      const sec = (r.section ?? '').toLowerCase().trim();
      const matMatch = wantedMaterials.includes((r.material ?? '').toLowerCase().trim());
      const sysMatch = sections.some((s) => sec.includes(s));
      return matMatch && sysMatch;
    });

  let candidates = filterBySections(PRIMARY_SECTIONS);
  let fallback = false;
  if (candidates.length === 0) {
    candidates = filterBySections(SECONDARY_SECTIONS);
    fallback = true;
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.retail_usd ?? 0) - (b.retail_usd ?? 0));
  const best = candidates[0];
  return {
    msrp: best.msrp_usd ?? best.retail_usd! - (best.retail_usd! >= 5500 ? 1600 : 1500),
    retail: best.retail_usd!,
    source: best,
    fallback,
  };
}

function syntheticSku(handle: string, suffix: string): string {
  const digest = createHash('sha1')
    .update(`${handle}::${suffix}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  // Short, deterministic. Strip any non-alphanumerics from handle for prefix.
  const prefix = handle.replace(/[^a-z0-9]/gi, '').slice(0, 24).toUpperCase();
  return `IPE-${prefix}-${digest}`;
}

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function fetchAsBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'OneCompany-IpeImporter/1.0' },
  });
  if (!r.ok) throw new Error(`Fetch ${url} → HTTP ${r.status}`);
  const ab = await r.arrayBuffer();
  const contentType = r.headers.get('content-type') || 'image/jpeg';
  return { buffer: Buffer.from(ab), contentType };
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

type PairAction = {
  ssHandle: string;
  tiHandle: string;
  ssSlug: string;
  ssProduct: ShopProduct;
  tiProductId: string | null;
  ssCatbackPrice: number | null;
  tiCatbackPrice: number | null;
  ssMsrp: number | null;
  tiMsrp: number | null;
  modelTokens: string[];
  tiImageUrls: string[];
  existingMediaCount: number;
  existingGallery: string[];
};

async function planPairs(): Promise<{ actions: PairAction[]; skipped: Array<{ pair: [string, string]; reason: string }> }> {
  const snapshot = await findLatestSnapshot();
  const items = (snapshot.products || snapshot) as Array<{ handle: string; images: string[]; title: string }>;
  const byHandle = new Map(items.map((it) => [it.handle, it]));
  const pricelist = loadParsedPricelist();

  const actions: PairAction[] = [];
  const skipped: Array<{ pair: [string, string]; reason: string }> = [];

  for (const pair of PAIRS) {
    const [ssHandle, tiHandle] = pair;
    if (PAIR_FILTER && !ssHandle.includes(PAIR_FILTER)) continue;

    const ssOfficial = byHandle.get(ssHandle);
    const tiOfficial = byHandle.get(tiHandle);
    if (!ssOfficial || !tiOfficial) {
      skipped.push({ pair, reason: `Missing in iPE snapshot: ss=${!!ssOfficial}, ti=${!!tiOfficial}` });
      continue;
    }
    const ssSlug = `ipe-${ssHandle}`;
    const tiSlug = `ipe-${tiHandle}`;
    const ssProduct = await prisma.shopProduct.findFirst({
      where: { slug: ssSlug },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    if (!ssProduct) {
      skipped.push({ pair, reason: 'SS product not in DB' });
      continue;
    }
    const tiProduct = await prisma.shopProduct.findFirst({ where: { slug: tiSlug }, select: { id: true } });

    const tokens = getModelTokens(ssHandle);
    const ss = findCatbackPrice(pricelist, tokens, 'SS');
    const ti = findCatbackPrice(pricelist, tokens, 'Ti');
    if (!ss && !ti) {
      skipped.push({ pair, reason: `Pricelist match missing both SS and Ti, tokens=${tokens.join(',')}` });
      continue;
    }

    actions.push({
      ssHandle,
      tiHandle,
      ssSlug,
      ssProduct: ssProduct as ShopProduct,
      tiProductId: tiProduct?.id ?? null,
      ssCatbackPrice: ss?.retail ?? null,
      tiCatbackPrice: ti?.retail ?? null,
      ssMsrp: ss?.msrp ?? null,
      tiMsrp: ti?.msrp ?? null,
      modelTokens: tokens,
      tiImageUrls: tiOfficial.images || [],
      existingMediaCount: ssProduct.media.length,
      existingGallery: Array.isArray(ssProduct.gallery) ? (ssProduct.gallery as string[]) : [],
    });
  }
  return { actions, skipped };
}

async function applyAction(action: PairAction) {
  console.log(`\n--- Applying: ${action.ssHandle} ---`);
  const handleNoExhaust = action.ssHandle.replace(/-exhaust(-system)?$/, '');
  const blobFolder = `media/library/shop/ipe/${action.ssHandle}`;
  const relFolder = `/media/shop/ipe/${action.ssHandle}`;

  // 1. Upload Ti images to Blob (positions = existingMediaCount + 1 ...)
  const startPos = action.existingMediaCount + 1;
  const newMedia: Array<{ position: number; src: string; relPath: string; altText: string }> = [];
  for (let i = 0; i < action.tiImageUrls.length; i++) {
    const url = action.tiImageUrls[i];
    const num = String(startPos + i).padStart(2, '0');
    const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const blobPath = `${blobFolder}/${num}.${ext}`;
    const relPath = `${relFolder}/${num}.${ext}`;

    let blobUrl: string;
    try {
      const { buffer, contentType } = await fetchAsBuffer(url);
      const result = await putPublicBlob(blobPath, buffer, contentType || contentTypeFor(`x.${ext}`));
      blobUrl = result.url;
      console.log(`  uploaded ${num}.${ext}: ${buffer.byteLength} bytes`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('already exists')) {
        blobUrl = `${BLOB_BASE_URL}/${blobPath}`;
        console.log(`  reused existing Blob ${num}.${ext}`);
      } else {
        throw err;
      }
    }

    newMedia.push({
      position: startPos + i,
      src: blobUrl,
      relPath,
      altText: `${action.ssProduct.titleEn} ${startPos + i}`,
    });
  }

  // 2. Build new variants — only for materials that have a price in Excel.
  const newVariants: Array<{
    title: string;
    sku: string;
    option1Value: string;
    priceUsd: Prisma.Decimal;
    isDefault: boolean;
    position: number;
  }> = [];
  if (action.ssCatbackPrice !== null) {
    newVariants.push({
      title: `Cat-back System · Stainless Steel`,
      sku: syntheticSku(handleNoExhaust, 'catback-ss'),
      option1Value: `Cat-back System · Stainless Steel`,
      priceUsd: new Prisma.Decimal(action.ssCatbackPrice),
      isDefault: newVariants.length === 0,
      position: newVariants.length + 1,
    });
  }
  if (action.tiCatbackPrice !== null) {
    newVariants.push({
      title: `Cat-back System · Titanium`,
      sku: syntheticSku(handleNoExhaust, 'catback-ti'),
      option1Value: `Cat-back System · Titanium`,
      priceUsd: new Prisma.Decimal(action.tiCatbackPrice),
      isDefault: newVariants.length === 0,
      position: newVariants.length + 1,
    });
  }
  if (newVariants.length === 0) {
    throw new Error('No variants to write — both SS and Ti prices missing');
  }

  const newGallery = [
    ...action.existingGallery,
    ...newMedia.map((m) => m.relPath),
  ];
  const materials = [
    ...new Array(action.existingMediaCount).fill('ss'),
    ...newMedia.map(() => 'ti'),
  ].join(',');

  // 3. DB transaction
  await prisma.$transaction(async (tx) => {
    // Drop existing options + variants for this product
    await tx.shopProductOption.deleteMany({ where: { productId: action.ssProduct.id } });
    await tx.shopProductVariant.deleteMany({ where: { productId: action.ssProduct.id } });

    await tx.shopProductOption.create({
      data: {
        productId: action.ssProduct.id,
        name: 'Система',
        position: 1,
        values: newVariants.map((v) => v.option1Value),
      },
    });

    for (const v of newVariants) {
      await tx.shopProductVariant.create({
        data: {
          productId: action.ssProduct.id,
          title: v.title,
          sku: v.sku,
          position: v.position,
          option1Value: v.option1Value,
          inventoryQty: 0,
          inventoryPolicy: 'CONTINUE',
          priceUsd: v.priceUsd,
          requiresShipping: true,
          taxable: true,
          isDefault: v.isDefault,
        },
      });
    }

    // Add new media
    for (const m of newMedia) {
      await tx.shopProductMedia.create({
        data: {
          productId: action.ssProduct.id,
          src: m.src,
          altText: m.altText,
          position: m.position,
          mediaType: 'IMAGE',
        },
      });
    }

    // Update SS product: gallery, default sku/price. Preserve descriptions!
    const defaultV = newVariants.find((v) => v.isDefault) ?? newVariants[0];
    await tx.shopProduct.update({
      where: { id: action.ssProduct.id },
      data: {
        priceUsd: defaultV.priceUsd,
        sku: defaultV.sku,
        gallery: newGallery as Prisma.InputJsonValue,
      },
    });

    // Material tagging metafield
    const existingMat = await tx.shopProductMetafield.findFirst({
      where: { productId: action.ssProduct.id, namespace: 'ipe', key: 'gallery_image_materials' },
    });
    if (existingMat) {
      await tx.shopProductMetafield.update({ where: { id: existingMat.id }, data: { value: materials, valueType: 'string' } });
    } else {
      await tx.shopProductMetafield.create({
        data: {
          productId: action.ssProduct.id,
          namespace: 'ipe',
          key: 'gallery_image_materials',
          valueType: 'string',
          value: materials,
        },
      });
    }

    // Mark Ti product (if present in DB) as DRAFT and unpublished
    if (action.tiProductId) {
      await tx.shopProduct.update({
        where: { id: action.tiProductId },
        data: { status: 'DRAFT', isPublished: false },
      });
    }
  });

  const priceSummary = newVariants.map((v) => `${v.title.split(' · ')[1]}=$${v.priceUsd}`).join(' / ');
  console.log(`  ✓ ${action.ssHandle} → ${priceSummary}, gallery ${newGallery.length} photos`);
}

async function main() {
  if (APPLY && !isBlobStorageConfigured()) {
    throw new Error('BLOB storage not configured (BLOB_READ_WRITE_TOKEN missing).');
  }
  const { actions, skipped } = await planPairs();

  console.log(`\n=== PLAN: ${actions.length} pairs to apply, ${skipped.length} skipped ===\n`);
  for (const a of actions) {
    console.log(`${a.ssHandle}`);
    console.log(`  ↔ ${a.tiHandle}${a.tiProductId ? ' (will set Ti product to DRAFT)' : ''}`);
    console.log(`  tokens: [${a.modelTokens.join(', ')}]`);
    console.log(`  SS Cat-back: ${a.ssCatbackPrice !== null ? `MSRP $${a.ssMsrp} → retail $${a.ssCatbackPrice}` : '— (not in Excel)'}`);
    console.log(`  Ti Cat-back: ${a.tiCatbackPrice !== null ? `MSRP $${a.tiMsrp} → retail $${a.tiCatbackPrice}` : '— (not in Excel)'}`);
    console.log(`  Ti images to upload: ${a.tiImageUrls.length}`);
    console.log(`  Existing SS gallery: ${a.existingMediaCount}, will become ${a.existingMediaCount + a.tiImageUrls.length}`);
  }
  if (skipped.length) {
    console.log('\n--- Skipped ---');
    for (const s of skipped) console.log(`  ${s.pair[0]}: ${s.reason}`);
  }

  if (!APPLY) {
    console.log('\nDry-run. Re-run with --apply to write.');
    return;
  }

  for (const action of actions) {
    try {
      await applyAction(action);
    } catch (err) {
      console.error(`FAILED: ${action.ssHandle}: ${(err as Error).message}`);
    }
  }
  console.log('\nAll done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
