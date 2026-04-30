import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function makeSlug(makeSlug: string, modelSlug: string, engineSlug: string): string {
  return `racechip-gts5-${makeSlug}-${modelSlug}-${engineSlug}`
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

async function main() {
  const data = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'racechip-products.json'), 'utf-8')
  );

  let checked = 0, updatedProducts = 0, updatedVariants = 0, missing = 0;
  for (const p of data) {
    if (!p.priceEUR) continue;
    const slug = makeSlug(p.makeSlug, p.modelSlug, p.engineSlug);
    const row = await prisma.shopProduct.findUnique({
      where: { slug },
      select: { id: true, priceEur: true, variants: { select: { id: true, priceEur: true, sku: true } } },
    });
    if (!row) { missing++; continue; }
    checked++;
    const target = new Prisma.Decimal(p.priceEUR);
    if (!row.priceEur || !new Prisma.Decimal(row.priceEur).equals(target)) {
      await prisma.shopProduct.update({ where: { id: row.id }, data: { priceEur: target } });
      updatedProducts++;
      if (updatedProducts <= 5) console.log(`  ${slug}: ${row.priceEur} → ${target}`);
    }
    for (const v of row.variants) {
      if (!v.priceEur || !new Prisma.Decimal(v.priceEur).equals(target)) {
        await prisma.shopProductVariant.update({ where: { id: v.id }, data: { priceEur: target } });
        updatedVariants++;
      }
    }
  }
  console.log(`\nChecked: ${checked}, Products updated: ${updatedProducts}, Variants updated: ${updatedVariants}, Missing in DB: ${missing}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
