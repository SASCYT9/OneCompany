import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
// Run with: npx tsx scripts/audit-burger-filter-coverage.ts
//
// Walks every (brand, model, chassis) combo declared in burgerFitmentOptions.json
// and verifies that the DB has matching products. Flags any combo that returns 0
// products — those are dead-end filter selections users can hit but find nothing.

type FitmentBrand = {
  count: number;
  models: Record<string, { count: number; chassis: string[]; engines: string[] }>;
  allChassis: string[];
  allEngines: string[];
};

async function main() {
  const fitmentPath = path.join(process.cwd(), 'src/app/[locale]/shop/data/burgerFitmentOptions.json');
  const fitment: Record<string, FitmentBrand> = JSON.parse(fs.readFileSync(fitmentPath, 'utf-8'));

  const all = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', isPublished: true },
    select: { slug: true, tags: true },
  });

  function countMatching(brand: string, model: string | null, chassis: string | null) {
    return all.filter((p) => {
      const tags = p.tags || [];
      if (!tags.includes(`brand:${brand}`)) return false;
      if (model && !tags.includes(`model:${model}`)) return false;
      if (chassis && !tags.includes(`chassis:${chassis}`)) return false;
      return true;
    }).length;
  }

  const dead: Array<{ brand: string; model?: string; chassis?: string; expected: number; actual: number }> = [];
  let combos = 0;

  for (const [brand, bd] of Object.entries(fitment)) {
    const brandActual = countMatching(brand, null, null);
    if (brandActual === 0) {
      dead.push({ brand, expected: bd.count, actual: 0 });
    }

    for (const [model, md] of Object.entries(bd.models || {})) {
      combos++;
      const modelActual = countMatching(brand, model, null);
      if (modelActual === 0) {
        dead.push({ brand, model, expected: md.count, actual: 0 });
      }

      for (const chassis of md.chassis || []) {
        combos++;
        const chActual = countMatching(brand, model, chassis);
        if (chActual === 0) {
          dead.push({ brand, model, chassis, expected: -1, actual: 0 });
        }
      }
    }
  }

  console.log(`=== Filter coverage audit ===`);
  console.log(`Total combos checked: ${combos}`);
  console.log(`Dead-end combos (picker shows option, but 0 products): ${dead.length}`);
  if (dead.length > 0) {
    console.log(`\nDead-end combinations (first 20):`);
    for (const d of dead.slice(0, 20)) {
      const path = `${d.brand}` + (d.model ? ` → ${d.model}` : '') + (d.chassis ? ` → ${d.chassis}` : '');
      console.log(`  ${path} | expected ${d.expected > 0 ? d.expected : '?'} → actual ${d.actual}`);
    }
  }

  // BMW M3 G80 specifically
  console.log(`\n=== BMW M3 G80 deep-dive ===`);
  const bmw = countMatching('BMW', null, null);
  const bmwM3 = countMatching('BMW', 'M3', null);
  const bmwM3G80 = countMatching('BMW', 'M3', 'G80');
  const bmwM3F80 = countMatching('BMW', 'M3', 'F80');
  console.log(`BMW total:                  ${bmw}`);
  console.log(`BMW + model:M3:             ${bmwM3}`);
  console.log(`BMW + M3 + chassis:G80:     ${bmwM3G80}`);
  console.log(`BMW + M3 + chassis:F80:     ${bmwM3F80}`);

  const m3g80Products = all.filter(
    (p) =>
      (p.tags || []).includes('brand:BMW') &&
      (p.tags || []).includes('model:M3') &&
      (p.tags || []).includes('chassis:G80')
  );
  console.log(`\nProducts shown for ?brand=BMW&model=M3&chassis=G80:`);
  for (const p of m3g80Products.slice(0, 30)) {
    const isJb4 = (p.tags || []).includes('type:jb4-tuners');
    console.log(`  ${isJb4 ? '🔥' : '  '} ${p.slug}`);
  }
  if (m3g80Products.length > 30) console.log(`  ... and ${m3g80Products.length - 30} more`);

  // Other popular combos
  console.log(`\n=== Popular vehicle spot-checks ===`);
  const popular = [
    ['BMW', 'M2', 'G87'],
    ['BMW', 'M2', 'F87'],
    ['BMW', 'M4', 'G82'],
    ['BMW', 'M4', 'F82'],
    ['BMW', 'M5', 'F90'],
    ['BMW', 'M5', 'G90'],
    ['BMW', '3-Series', 'G20'],
    ['BMW', '3-Series', 'F30'],
    ['BMW', 'X3M', 'F97'],
    ['Toyota', 'Supra', 'A90'],
    ['Porsche', 'Carrera', '992'],
    ['Ford', 'Mustang', null],
    ['Ford', 'F-150', null],
    ['Chevrolet', 'Corvette', null],
    ['Mercedes', 'C-Class', 'W205'],
    ['Range Rover', null, null],
    ['Aston Martin', null, null],
  ];
  for (const [b, m, c] of popular) {
    const n = countMatching(b!, m, c);
    const path = `${b}` + (m ? ` → ${m}` : '') + (c ? ` → ${c}` : '');
    const status = n > 0 ? '✓' : '✗';
    console.log(`  ${status} ${path.padEnd(40)} ${n}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
