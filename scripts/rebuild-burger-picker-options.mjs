// Rebuild burgerFitmentOptions.json from DB tags so picker UI exactly matches
// what filtering will return.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const OUT = path.join(process.cwd(), 'src/app/[locale]/shop/data/burgerFitmentOptions.json');

async function main() {
  const all = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { tags: true },
  });

  // For each product, collect (brand, model, chassis, engine) groupings.
  // brand → { count, models: { [model]: { count, chassis: { [c]: count }, engines: { [e]: count } } }, allChassis, allEngines }
  const byBrand = new Map();

  for (const product of all) {
    const tags = product.tags || [];
    const brands = tags.filter(t => t.startsWith('brand:')).map(t => t.slice(6));
    const models = tags.filter(t => t.startsWith('model:')).map(t => t.slice(6));
    const chassis = tags.filter(t => t.startsWith('chassis:')).map(t => t.slice(8));
    const engines = tags.filter(t => t.startsWith('engine:')).map(t => t.slice(7));

    for (const brand of brands) {
      if (brand === 'Universal') continue;
      if (!byBrand.has(brand)) {
        byBrand.set(brand, {
          count: 0,
          models: new Map(),
          allChassis: new Set(),
          allEngines: new Set(),
        });
      }
      const bd = byBrand.get(brand);
      bd.count++;

      for (const m of models) {
        if (!bd.models.has(m)) bd.models.set(m, { count: 0, chassis: new Set(), engines: new Set() });
        const md = bd.models.get(m);
        md.count++;
        for (const c of chassis) md.chassis.add(c);
        for (const e of engines) md.engines.add(e);
      }
      for (const c of chassis) bd.allChassis.add(c);
      for (const e of engines) bd.allEngines.add(e);
    }
  }

  // Serialize: sorted by count desc
  const output = {};
  const sortedBrands = [...byBrand.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [brand, bd] of sortedBrands) {
    output[brand] = {
      count: bd.count,
      models: Object.fromEntries(
        [...bd.models.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .map(([m, md]) => [m, {
            count: md.count,
            chassis: [...md.chassis].sort(),
            engines: [...md.engines].sort(),
          }])
      ),
      allChassis: [...bd.allChassis].sort(),
      allEngines: [...bd.allEngines].sort(),
    };
  }

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`✓ Wrote ${path.relative(process.cwd(), OUT)}`);
  console.log(`Brands: ${Object.keys(output).length}`);
  console.log(`BMW models: ${Object.keys(output.BMW?.models || {}).length}`);
  console.log(`VW models: ${Object.keys(output.VW?.models || {}).length}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
