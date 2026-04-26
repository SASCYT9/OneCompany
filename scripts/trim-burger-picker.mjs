// Post-process burgerFitmentOptions.json — remove options that have 0 matching
// DB products. Keeps the per-brand attribution from the extract script but trims
// "phantom" entries from products that didn't make it into the DB.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const FILE = path.join(process.cwd(), 'src/app/[locale]/shop/data/burgerFitmentOptions.json');

async function main() {
  const FITMENT = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const all = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { tags: true },
  });

  function hasMatch(brand, model, chassis, engine) {
    return all.some(p => {
      const t = p.tags || [];
      if (!t.includes('brand:' + brand)) return false;
      if (model && !t.includes('model:' + model)) return false;
      if (chassis && !t.includes('chassis:' + chassis)) return false;
      if (engine && !t.includes('engine:' + engine)) return false;
      return true;
    });
  }

  let removedBrands = 0, removedModels = 0, removedChassis = 0, removedEngines = 0;

  for (const [brand, bd] of Object.entries(FITMENT)) {
    if (!hasMatch(brand)) {
      delete FITMENT[brand];
      removedBrands++;
      continue;
    }
    // Recompute brand count
    bd.count = all.filter(p => (p.tags||[]).includes('brand:' + brand)).length;

    // Trim allChassis/allEngines to those that have at least one product with this brand
    bd.allChassis = bd.allChassis.filter(c => hasMatch(brand, null, c));
    bd.allEngines = bd.allEngines.filter(e => hasMatch(brand, null, null, e));

    // Trim models
    for (const [model, md] of Object.entries(bd.models)) {
      if (!hasMatch(brand, model)) {
        delete bd.models[model];
        removedModels++;
        continue;
      }
      md.count = all.filter(p => {
        const t = p.tags || [];
        return t.includes('brand:' + brand) && t.includes('model:' + model);
      }).length;
      // Trim model.chassis/engines
      const before = md.chassis.length;
      md.chassis = md.chassis.filter(c => hasMatch(brand, model, c));
      removedChassis += before - md.chassis.length;
      const beforeE = md.engines.length;
      md.engines = md.engines.filter(e => hasMatch(brand, model, null, e));
      removedEngines += beforeE - md.engines.length;
    }
  }

  fs.writeFileSync(FILE, JSON.stringify(FITMENT, null, 2));

  console.log('=== Trim Report ===');
  console.log(`Removed brands (no DB products):       ${removedBrands}`);
  console.log(`Removed models (no DB products):       ${removedModels}`);
  console.log(`Removed chassis options (no products): ${removedChassis}`);
  console.log(`Removed engine options (no products):  ${removedEngines}`);
  console.log(`\nFinal: ${Object.keys(FITMENT).length} brands`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
