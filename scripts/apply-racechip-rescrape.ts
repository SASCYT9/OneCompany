/**
 * Post-rescrape applier — flows updated prices/gains/tier from
 * data/racechip-products.json into:
 *   1) DB: ShopProduct.priceEur + variants.priceEur
 *   2) DB: ShopProduct.shortDescUa/En/tags ONLY when they still match the
 *      auto-generated pattern (preserves manual UA edits per
 *      memory/minimal_reimport.md).
 *   3) src/lib/racechipMissingGts5.generated.ts — regenerated from the
 *      updated audit so the static fallback matches the latest GTS 5 Black
 *      pricing for SKUs that aren't in DB.
 *   4) Deletes .shop-products-dev-cache.json so the dev preview reflects
 *      the change immediately.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

type ScrapedProduct = {
  url: string;
  makeSlug: string;
  modelSlug: string;
  engineSlug: string;
  title?: string;
  selectedTier?: string;
  priceGTS5: number;
  priceAppControl: number;
  priceEUR: number;
  gainHp: number;
  gainNm: number;
  baseHp: number;
  baseKw: number;
  baseNm: number;
  ccm: number;
  timestamp?: string;
};

function makeSlug(makeSlug: string, modelSlug: string, engineSlug: string): string {
  return `racechip-gts5-${makeSlug}-${modelSlug}-${engineSlug}`
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

// ── Auto-pattern matchers (so we don't overwrite manual UA edits) ──────
const SHORT_EN_RE = /^\+\d+\s+HP\s*\/\s*\+\d+\s+Nm\s+—\s+RaceChip GTS 5 with App Control$/;
const SHORT_UA_RE = /^\+\d+\s+к\.с\.\s*\/\s*\+\d+\s+Нм\s+—\s+RaceChip GTS 5 з App Control$/;

function generateShortEn(p: ScrapedProduct) {
  return `+${p.gainHp} HP / +${p.gainNm} Nm — RaceChip GTS 5 with App Control`;
}
function generateShortUa(p: ScrapedProduct) {
  return `+${p.gainHp} к.с. / +${p.gainNm} Нм — RaceChip GTS 5 з App Control`;
}
function generateTags(p: ScrapedProduct): string[] {
  return [
    `car_make:${p.makeSlug}`,
    `car_model:${p.modelSlug}`,
    `car_engine:${p.engineSlug}`,
    'tier:gts5',
    'app_control',
    'chip_tuning',
    `ccm:${p.ccm}`,
    `base_hp:${p.baseHp}`,
    `gain_hp:${p.gainHp}`,
    `gain_nm:${p.gainNm}`,
  ];
}

async function main() {
  const data: ScrapedProduct[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'racechip-products.json'), 'utf-8')
  );
  console.log(`📦 ${data.length} scraped products`);

  let checked = 0;
  let prodPriceUpdated = 0;
  let varPriceUpdated = 0;
  let descUpdated = 0;
  let tagsUpdated = 0;
  let missing = 0;

  for (const p of data) {
    if (!p.priceEUR || p.priceEUR < 50) continue;
    const slug = makeSlug(p.makeSlug, p.modelSlug, p.engineSlug);
    const row = await prisma.shopProduct.findUnique({
      where: { slug },
      select: {
        id: true,
        priceEur: true,
        shortDescEn: true,
        shortDescUa: true,
        tags: true,
        variants: { select: { id: true, priceEur: true, sku: true } },
      },
    });
    if (!row) { missing++; continue; }
    checked++;

    const target = new Prisma.Decimal(p.priceEUR);
    const dataPatch: Prisma.ShopProductUpdateInput = {};

    if (!row.priceEur || !new Prisma.Decimal(row.priceEur).equals(target)) {
      dataPatch.priceEur = target;
      prodPriceUpdated++;
    }

    // Only refresh short desc if it still matches auto-pattern (i.e. unedited)
    if (row.shortDescEn && SHORT_EN_RE.test(row.shortDescEn)) {
      const fresh = generateShortEn(p);
      if (row.shortDescEn !== fresh) {
        dataPatch.shortDescEn = fresh;
        descUpdated++;
      }
    }
    if (row.shortDescUa && SHORT_UA_RE.test(row.shortDescUa)) {
      const fresh = generateShortUa(p);
      if (row.shortDescUa !== fresh) {
        dataPatch.shortDescUa = fresh;
      }
    }

    // Refresh gain_hp / gain_nm tags so filtering and sorting stay correct.
    const expectedTags = new Set(generateTags(p));
    const currentTags = new Set(row.tags || []);
    const sameTags =
      currentTags.size === expectedTags.size &&
      [...currentTags].every((t) => expectedTags.has(t));
    if (!sameTags) {
      dataPatch.tags = [...expectedTags];
      tagsUpdated++;
    }

    if (Object.keys(dataPatch).length) {
      await prisma.shopProduct.update({ where: { id: row.id }, data: dataPatch });
    }

    for (const v of row.variants) {
      if (!v.priceEur || !new Prisma.Decimal(v.priceEur).equals(target)) {
        await prisma.shopProductVariant.update({ where: { id: v.id }, data: { priceEur: target } });
        varPriceUpdated++;
      }
    }
  }

  console.log(`\nDB summary:
  Checked: ${checked}
  Product prices updated: ${prodPriceUpdated}
  Variant prices updated: ${varPriceUpdated}
  Short descriptions refreshed: ${descUpdated}
  Tags refreshed: ${tagsUpdated}
  Missing in DB: ${missing}`);

  // ── (3) Regenerate the fallback file's prices ──────────────────────
  // The static fallback (src/lib/racechipMissingGts5.generated.ts) supplies
  // products that aren't in DB. Update its priceEur/gain values from the
  // fresh scrape. The existing fallback builder adds +59 EUR App Control.
  const generatedPath = path.join(process.cwd(), 'src', 'lib', 'racechipMissingGts5.generated.ts');
  let fallbackUpdated = 0;
  if (fs.existsSync(generatedPath)) {
    const generated = fs.readFileSync(generatedPath, 'utf-8');
    const ROW_MATCH = /\{\s*"url":\s*"([^"]+)",[\s\S]*?\}/g;
    const byUrl = new Map(data.map((p) => [p.url, p]));

    const replaced = generated.replace(ROW_MATCH, (block, url) => {
      const fresh = byUrl.get(url);
      if (!fresh) return block;
      // Replace numeric fields only — preserve the surrounding object shape.
      let out = block;
      out = out.replace(/("priceEur":\s*)\d+(\.\d+)?/, `$1${fresh.priceGTS5}`);
      out = out.replace(/("gainHp":\s*)\d+/, `$1${fresh.gainHp}`);
      out = out.replace(/("gainNm":\s*)\d+/, `$1${fresh.gainNm}`);
      if (out !== block) fallbackUpdated++;
      return out;
    });
    if (fallbackUpdated > 0) {
      fs.writeFileSync(generatedPath, replaced, 'utf-8');
      console.log(`Fallback file: ${fallbackUpdated} rows refreshed`);
    } else {
      console.log('Fallback file: no rows changed');
    }
  }

  // ── (4) Bust dev cache so preview reflects changes ─────────────────
  const cachePath = path.join(process.cwd(), '.shop-products-dev-cache.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log('Dev cache: deleted');
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
