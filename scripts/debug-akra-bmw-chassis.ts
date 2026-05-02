import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
import {
  extractVehicleBrands,
  extractVehicleModelNamesForBrand,
  extractChassisForBrandAndModel,
  extractVehicleModelsForBrand,
} from '../src/lib/akrapovicFilterUtils.ts';

const p = new PrismaClient();

async function main() {
const rows = await p.shopProduct.findMany({
  where: {
    isPublished: true,
    OR: [
      { brand: { contains: 'akrapovi', mode: 'insensitive' } },
      { slug: { startsWith: 'akrapovic-' } },
    ],
  },
  select: { slug: true, sku: true, titleEn: true },
});

console.log(`Total Akra rows: ${rows.length}\n`);

// Inspect: which products attribute G20 chassis under M340i model? under M3?
const buckets = {
  m340_g20: [],
  m340_g21: [],
  m3_g20_LEAK: [],
  m3_g80: [],
  m4_g82: [],
  m4_g20_LEAK: [],
  g20_no_model_filter: [],
  g80_no_model_filter: [],
  m3_chassis_set: new Set(),
  m4_chassis_set: new Set(),
  m340_chassis_set: new Set(),
};

for (const r of rows) {
  const t = r.titleEn || '';
  const brands = extractVehicleBrands(t);
  if (!brands.includes('BMW')) continue;
  const models = extractVehicleModelNamesForBrand(t, 'BMW');

  for (const m of models) {
    const ch = extractChassisForBrandAndModel(t, 'BMW', m);
    if (m === 'M340i/M340d') {
      ch.forEach((c) => buckets.m340_chassis_set.add(c));
      if (ch.includes('G20')) buckets.m340_g20.push({ sku: r.sku, slug: r.slug, t, ch });
      if (ch.includes('G21')) buckets.m340_g21.push({ sku: r.sku, slug: r.slug, t, ch });
    }
    if (m === 'M3') {
      ch.forEach((c) => buckets.m3_chassis_set.add(c));
      if (ch.includes('G20')) buckets.m3_g20_LEAK.push({ sku: r.sku, slug: r.slug, t, ch });
      if (ch.includes('G80')) buckets.m3_g80.push({ sku: r.sku, slug: r.slug, t, ch });
    }
    if (m === 'M4') {
      ch.forEach((c) => buckets.m4_chassis_set.add(c));
      if (ch.includes('G82')) buckets.m4_g82.push({ sku: r.sku, slug: r.slug, t, ch });
      if (ch.includes('G20')) buckets.m4_g20_LEAK.push({ sku: r.sku, slug: r.slug, t, ch });
    }
  }
}

console.log('--- M340i/M340d chassis distribution ---');
console.log([...buckets.m340_chassis_set]);
console.log(`G20 hits: ${buckets.m340_g20.length}`);
buckets.m340_g20.slice(0, 8).forEach((x) => console.log(`  ${x.sku}  ${x.t}  ch=${x.ch}`));

console.log('\n--- M3 chassis distribution ---');
console.log([...buckets.m3_chassis_set]);
console.log(`G80 hits: ${buckets.m3_g80.length}`);
buckets.m3_g80.slice(0, 6).forEach((x) => console.log(`  ${x.sku}  ${x.t}  ch=${x.ch}`));

console.log('\n--- M4 chassis distribution ---');
console.log([...buckets.m4_chassis_set]);
console.log(`G82 hits: ${buckets.m4_g82.length}`);
buckets.m4_g82.slice(0, 6).forEach((x) => console.log(`  ${x.sku}  ${x.t}  ch=${x.ch}`));

console.log('\n--- LEAK CHECK: M3 with G20? (should be empty) ---');
console.log(`Count: ${buckets.m3_g20_LEAK.length}`);
buckets.m3_g20_LEAK.slice(0, 12).forEach((x) =>
  console.log(`  sku=${x.sku}  ch=${x.ch}\n    title=${x.t}`)
);

console.log('\n--- LEAK CHECK: M4 with G20? (should be empty) ---');
console.log(`Count: ${buckets.m4_g20_LEAK.length}`);
buckets.m4_g20_LEAK.slice(0, 12).forEach((x) =>
  console.log(`  sku=${x.sku}  ch=${x.ch}\n    title=${x.t}`)
);

// Now: in the *body* dropdown when activeModel === 'M340i/M340d',
// availableBodies uses extractChassisForBrandAndModel — same call.
// And when filtering with body=G20 + model=M340i, products are picked
// where the chassis from that pair contains G20.
// But: the user reports filtering by G20 returns G80 products.
// Possible cause: model=all + body=G20 uses extractVehicleModelsForBrand
// which returns ALL chassis from a multi-line title, so an M2/M340i/M3
// stack with (F87/G20/G80) maps G20 to a product whose actual G80
// portion is the M3. That product would show under "BMW + chassis=G20"
// even though it's M3 hardware.

console.log('\n--- "BMW + body=G20 + model=ALL" pollution check ---');
console.log('Which products contain G20 in extractVehicleModelsForBrand(BMW)?');
let g20Pool = [];
for (const r of rows) {
  const t = r.titleEn || '';
  const brands = extractVehicleBrands(t);
  if (!brands.includes('BMW')) continue;
  const allCh = extractVehicleModelsForBrand(t, 'BMW');
  if (allCh.includes('G20')) g20Pool.push({ sku: r.sku, slug: r.slug, t, ch: allCh });
}
console.log(`Total products surfacing under chassis=G20: ${g20Pool.length}`);
g20Pool.slice(0, 25).forEach((x) =>
  console.log(`  ${x.sku.padEnd(28)} ch=${x.ch}\n    ${x.t}`)
);

await p.$disconnect();
}
main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
