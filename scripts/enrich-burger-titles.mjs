// Enrich Burger product titles with the supported model list when missing.
// Strategy:
//  - If the title already mentions any tagged model → leave alone
//  - Otherwise append " — <model list>" (≤5 models) or " (для <brand>)" if too many
//  - Skip Universal-only products

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

// Models that are too generic to add (already in many other contexts)
const GENERIC_MODELS = new Set(['Cooper', 'turbo', 'Turbo', 'R', 'GT', 'Genesis']);

function getModels(tags) {
  return (tags || [])
    .filter((t) => t.startsWith('model:'))
    .map((t) => t.slice(6))
    .filter((m) => !GENERIC_MODELS.has(m));
}

function getBrands(tags) {
  return (tags || [])
    .filter((t) => t.startsWith('brand:'))
    .map((t) => t.slice(6))
    .filter((b) => b !== 'Universal');
}

function titleHasAnyModel(title, models) {
  if (!title) return false;
  const t = title.toLowerCase();
  return models.some((m) => t.includes(m.toLowerCase()));
}

function buildSuffix(models, brands, locale) {
  if (models.length === 0) return '';
  // Sort BMW models in canonical order (Series → M → X → Z → i)
  const sorted = [...models].sort((a, b) => {
    const groupA = /-Series$/.test(a) ? 0 : /^M\d/.test(a) ? 1 : /^X\d/.test(a) || a === 'XM' ? 2 : /^Z\d/.test(a) ? 3 : /^i\d/.test(a) ? 4 : 5;
    const groupB = /-Series$/.test(b) ? 0 : /^M\d/.test(b) ? 1 : /^X\d/.test(b) || b === 'XM' ? 2 : /^Z\d/.test(b) ? 3 : /^i\d/.test(b) ? 4 : 5;
    if (groupA !== groupB) return groupA - groupB;
    const numA = (a.match(/\d+/) || [999])[0];
    const numB = (b.match(/\d+/) || [999])[0];
    return parseInt(numA) - parseInt(numB);
  });

  // Compact representation if too many (>7)
  if (sorted.length > 7) {
    return locale === 'ua'
      ? ` (${brands.join('/')}: ${sorted.slice(0, 5).join(', ')} та ще ${sorted.length - 5})`
      : ` (${brands.join('/')}: ${sorted.slice(0, 5).join(', ')} +${sorted.length - 5} more)`;
  }
  // Up to 7: list them all
  return ` — ${brands.join('/')} ${sorted.join(', ')}`;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, titleUa: true, tags: true },
  });

  let changed = 0;
  const samples = [];

  for (const p of products) {
    const models = getModels(p.tags);
    if (models.length === 0) continue;
    const brands = getBrands(p.tags);
    if (brands.length === 0) continue;

    const enHasModel = titleHasAnyModel(p.titleEn, models);
    const uaHasModel = titleHasAnyModel(p.titleUa, models);

    const data = {};
    if (!enHasModel) {
      const suffix = buildSuffix(models, brands, 'en');
      data.titleEn = (p.titleEn + suffix).trim();
    }
    if (!uaHasModel) {
      const suffix = buildSuffix(models, brands, 'ua');
      data.titleUa = ((p.titleUa || '') + suffix).trim();
    }

    if (Object.keys(data).length > 0) {
      await prisma.shopProduct.update({ where: { id: p.id }, data });
      changed++;
      if (samples.length < 10) {
        samples.push({
          before: p.titleUa,
          after: data.titleUa || p.titleUa,
        });
      }
    }
  }

  console.log(`Enriched titles: ${changed}`);
  console.log('\nSamples:');
  for (const s of samples) {
    console.log(`  Before: ${s.before}`);
    console.log(`  After:  ${s.after}`);
    console.log();
  }
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
