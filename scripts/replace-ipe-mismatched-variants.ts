/**
 * Replace variants on iPE products whose existing variants come from
 * the wrong pricelist row (different model). For each product, look up
 * Cat-back SS/Ti rows in Excel using STRICT model-token matching, then
 * rebuild the variants. Preserve descriptions, gallery, and metafields.
 *
 * For products without a known good Cat-back row in either material,
 * skip and report — those need manual classification.
 *
 * Pass --apply to write; default is dry-run.
 * Pass --slug <substring> to limit to one product.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createHash } from 'crypto';
import { PrismaClient, Prisma, type ShopProduct } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SLUG_FILTER_INDEX = process.argv.indexOf('--slug');
const SLUG_FILTER = SLUG_FILTER_INDEX !== -1 ? process.argv[SLUG_FILTER_INDEX + 1] : null;

// 22 single-product mismatches discovered. Tokens were chosen to land in
// the right Excel `model` column without leaking into adjacent platforms.
const TARGETS: Array<{ slug: string; tokens: string[]; note?: string }> = [
  { slug: 'ipe-ferrira-488-gtb-titanium', tokens: ['488'], note: 'iPE handle has typo "ferrira"; Excel writes 488 GTB' },
  { slug: 'ipe-porsche-911-gt3-992-catback-system', tokens: ['992', 'gt3'] },
  { slug: 'ipe-bmw-m3-e90-e92-e93-exhaust', tokens: ['m3', 'e9'] },
  { slug: 'ipe-porsche-718-cayman-boxster-2-5t-982-with-718-gt4-bodykit-exhaust-system', tokens: ['718', '982'], note: '982 chassis with GT4 bodykit, 2.5T engine' },
  { slug: 'ipe-mercedes-benz-gt43-gt50-gt53-coupe-x290-1-exhaust', tokens: ['x290'] },
  { slug: 'ipe-porsche-911-turbo-turbo-s-997-2-exhaust', tokens: ['997', 'turbo'] },
  { slug: 'ipe-audi-rs3-sedan-sportback-8v-2-exhaust', tokens: ['rs3', '8v.2'] },
  { slug: 'ipe-bmw-m3-m4-g80-g82-exhaust', tokens: ['m3', 'g80'] },
  { slug: 'ipe-lamborghini-huracan-evo-exhaust', tokens: ['huracán', 'evo'] }, // try acute first
  { slug: 'ipe-lamborghini-huracan-tecnica-exhaust-system', tokens: ['huracán', 'tecnica'] },
  { slug: 'ipe-lamborghini-huracan-performante-exhaust', tokens: ['huracán', 'performante'] },
  { slug: 'ipe-lamborghini-huracan-sto-exhaust-system', tokens: ['huracán', 'sto'] },
  { slug: 'ipe-mercedes-benz-c63-w204-c204-x204-3-exhaust', tokens: ['c63', 'w204'] },
  { slug: 'ipe-bmw-m5-f90-exhaust', tokens: ['m5', 'f90'] },
  { slug: 'ipe-porsche-cayenne-cayenne-coupe-e3-exhaust', tokens: ['cayenne', 'e3'] },
  { slug: 'ipe-porsche-boxster-cayman-boxster-s-cayman-s-boxster-gts-cayman-gts-718-982-exhaust', tokens: ['718', 'boxster', '982'] },
  { slug: 'ipe-porsche-cayenne-s-cayenne-s-coupe-e3-exhaust', tokens: ['cayenne', 's', 'e3'] },
  { slug: 'ipe-porsche-911-carrera-s-4s-997-exhaust', tokens: ['997', 'carrera'] },
  { slug: 'ipe-lamborghini-aventador-svj-lp770-4', tokens: ['svj'] },
  { slug: 'ipe-porsche-macan-2-0t-95b-2-exhaust', tokens: ['macan', '95b'] },
  { slug: 'ipe-bmw-m240i-g42-exhaust-system', tokens: ['m240', 'g42'] },
  { slug: 'ipe-mclaren-765lt-exhaust', tokens: ['765lt'] },
];

const markup = (msrp: number) => msrp + (msrp >= 4000 ? 1600 : 1500);

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

const PRIMARY_SECTIONS = [
  'header back system', 'cat back system', 'cat-back system', 'catback system',
  'full system', 'full exhaust system',
];
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
  const digest = createHash('sha1').update(`${handle}::${suffix}`).digest('hex').slice(0, 8).toUpperCase();
  const prefix = handle.replace(/[^a-z0-9]/gi, '').slice(0, 24).toUpperCase();
  return `IPE-${prefix}-${digest}`;
}

type Action = {
  slug: string;
  product: ShopProduct & { variants: Array<{ id: string; sku: string | null }>; metafields: any[] };
  tokens: string[];
  ssPrice: number | null;
  tiPrice: number | null;
  ssMsrp: number | null;
  tiMsrp: number | null;
  ssFallback?: boolean;
  tiFallback?: boolean;
};

async function planAll(): Promise<{ actions: Action[]; skipped: Array<{ slug: string; reason: string }> }> {
  const pricelist = loadParsedPricelist();
  const actions: Action[] = [];
  const skipped: Array<{ slug: string; reason: string }> = [];
  for (const t of TARGETS) {
    if (SLUG_FILTER && !t.slug.includes(SLUG_FILTER)) continue;
    const product = await prisma.shopProduct.findFirst({
      where: { slug: t.slug },
      include: {
        variants: { select: { id: true, sku: true } },
        metafields: true,
      },
    });
    if (!product) {
      skipped.push({ slug: t.slug, reason: 'not in DB' });
      continue;
    }
    let ss = findCatbackPrice(pricelist, t.tokens, 'SS');
    let ti = findCatbackPrice(pricelist, t.tokens, 'Ti');
    // Fallback: try without diacritic for Lamborghini huracán → huracan
    if (!ss && !ti) {
      const altTokens = t.tokens.map((tok) => tok.replace(/á/g, 'a'));
      ss = findCatbackPrice(pricelist, altTokens, 'SS');
      ti = findCatbackPrice(pricelist, altTokens, 'Ti');
    }
    if (!ss && !ti) {
      skipped.push({ slug: t.slug, reason: `no SS/Ti pricelist match for tokens [${t.tokens.join(',')}]` });
      continue;
    }
    actions.push({
      slug: t.slug,
      product: product as any,
      tokens: t.tokens,
      ssPrice: ss?.retail ?? null,
      tiPrice: ti?.retail ?? null,
      ssMsrp: ss?.msrp ?? null,
      tiMsrp: ti?.msrp ?? null,
      ssFallback: ss?.fallback,
      tiFallback: ti?.fallback,
    });
  }
  return { actions, skipped };
}

async function applyAction(action: Action) {
  const handleNoExhaust = action.slug.replace(/^ipe-/, '').replace(/-exhaust(-system)?$/, '');
  const newVariants: Array<{
    title: string;
    sku: string;
    option1Value: string;
    priceUsd: Prisma.Decimal;
    isDefault: boolean;
    position: number;
  }> = [];
  if (action.ssPrice !== null) {
    newVariants.push({
      title: `Cat-back System · Stainless Steel`,
      sku: syntheticSku(handleNoExhaust, 'catback-ss'),
      option1Value: `Cat-back System · Stainless Steel`,
      priceUsd: new Prisma.Decimal(action.ssPrice),
      isDefault: newVariants.length === 0,
      position: newVariants.length + 1,
    });
  }
  if (action.tiPrice !== null) {
    newVariants.push({
      title: `Cat-back System · Titanium`,
      sku: syntheticSku(handleNoExhaust, 'catback-ti'),
      option1Value: `Cat-back System · Titanium`,
      priceUsd: new Prisma.Decimal(action.tiPrice),
      isDefault: newVariants.length === 0,
      position: newVariants.length + 1,
    });
  }
  if (newVariants.length === 0) throw new Error('No variants to write');

  // Safety check on existing variants — make sure nothing is referenced by orders/carts.
  const oldIds = action.product.variants.map((v) => v.id);
  if (oldIds.length) {
    const [orderRefs, cartRefs] = await Promise.all([
      prisma.shopOrderItem.count({ where: { variantId: { in: oldIds } } }),
      prisma.shopCartItem.count({ where: { variantId: { in: oldIds } } }),
    ]);
    if (orderRefs + cartRefs > 0) {
      throw new Error(`FK refs found (orders=${orderRefs}, carts=${cartRefs}) — refusing to delete`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.shopProductOption.deleteMany({ where: { productId: action.product.id } });
    await tx.shopProductVariant.deleteMany({ where: { productId: action.product.id } });
    await tx.shopProductOption.create({
      data: {
        productId: action.product.id,
        name: 'Система',
        position: 1,
        values: newVariants.map((v) => v.option1Value),
      },
    });
    for (const v of newVariants) {
      await tx.shopProductVariant.create({
        data: {
          productId: action.product.id,
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
    const defaultV = newVariants.find((v) => v.isDefault) ?? newVariants[0];
    await tx.shopProduct.update({
      where: { id: action.product.id },
      data: {
        priceUsd: defaultV.priceUsd,
        sku: defaultV.sku,
      },
    });
  });

  const summary = newVariants.map((v) => `${v.title.split(' · ')[1]}=$${v.priceUsd}`).join(' / ');
  console.log(`  ✓ ${action.slug} → ${summary}`);
}

async function main() {
  const { actions, skipped } = await planAll();
  console.log(`\n=== PLAN: ${actions.length} actions, ${skipped.length} skipped ===\n`);
  for (const a of actions) {
    console.log(`${a.slug}`);
    console.log(`  tokens: [${a.tokens.join(', ')}]`);
    console.log(`  SS: ${a.ssPrice !== null ? `$${a.ssPrice} (MSRP $${a.ssMsrp})${a.ssFallback ? ' [Rear Valve fallback]' : ''}` : '—'}`);
    console.log(`  Ti: ${a.tiPrice !== null ? `$${a.tiPrice} (MSRP $${a.tiMsrp})${a.tiFallback ? ' [Rear Valve fallback]' : ''}` : '—'}`);
  }
  if (skipped.length) {
    console.log('\n--- Skipped ---');
    for (const s of skipped) console.log(`  ${s.slug}: ${s.reason}`);
  }
  if (!APPLY) {
    console.log('\nDry-run. Re-run with --apply to write.');
    return;
  }
  for (const action of actions) {
    try {
      await applyAction(action);
    } catch (err) {
      console.error(`FAILED: ${action.slug}: ${(err as Error).message}`);
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
