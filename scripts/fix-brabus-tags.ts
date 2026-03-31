import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const INPUT_FILE = path.join(process.cwd(), 'brabus-seo-catalog-cleaned.json');

// Super unga-bunga concurrency
async function promiseAllLimit<T>(limit: number, items: any[], fn: (item: any) => Promise<T>): Promise<T[]> {
  const result: T[] = [];
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    result.push(p as any);
    const e = p.then(() => { executing.splice(executing.indexOf(e), 1); });
    executing.push(e);
    if (executing.length >= limit) await Promise.race(executing);
  }
  return Promise.all(result);
}

async function main() {
  const allProducts = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  let updated = 0;

  console.log('Fetching existing Brabus products...');
  const existingProducts = await prisma.shopProduct.findMany({
    where: { brand: 'Brabus' },
    select: { id: true, slug: true, tags: true },
  });
  const dbProductMap = new Map(existingProducts.map(p => [p.slug, p]));

  await promiseAllLimit(20, allProducts, async (p) => {
    const title = (p.titleEn || p.title || '').toLowerCase();
    const url = (p.sourceUrlDe || '').toLowerCase();
    const newTags: string[] = [];

    if (url.includes('mercedes') || title.includes('mercedes')) newTags.push('Mercedes');
    else if (url.includes('porsche') || title.includes('porsche')) newTags.push('Porsche');
    else if (url.includes('rolls-royce') || title.includes('rolls-royce') || url.includes('rolls') || title.includes('rolls')) newTags.push('Rolls-Royce');
    else if (url.includes('bentley') || title.includes('bentley')) newTags.push('Bentley');
    else if (url.includes('lamborghini') || title.includes('lamborghini')) newTags.push('Lamborghini');
    else if (url.includes('range-rover') || title.includes('range rover')) newTags.push('Range Rover');
    else if (url.includes('smart') || title.includes('smart')) newTags.push('smart');

    if (url.includes('g-klasse') || title.includes('g-class')) newTags.push('G-Klasse');
    if (url.includes('a-klasse') || title.includes('a-class')) newTags.push('A-Klasse');
    if (url.includes('c-klasse') || title.includes('c-class')) newTags.push('C-Klasse');
    if (url.includes('cls-klasse') || title.includes('cls-class')) newTags.push('CLS-Klasse');
    if (url.includes('e-klasse') || title.includes('e-class')) newTags.push('E-Klasse');
    if (url.includes('/eqc/') || title.includes('eqc')) newTags.push('EQC');
    if (url.includes('eqs-suv') || title.includes('eqs suv')) newTags.push('EQS SUV');
    if (url.includes('glb-klasse') || title.includes('glb-class')) newTags.push('GLB-Klasse');
    if (url.includes('glc-klasse') || title.includes('glc-class')) newTags.push('GLC-Klasse');
    if (url.includes('gle-klasse') || title.includes('gle-class')) newTags.push('GLE-Klasse');
    if (url.includes('gls-klasse') || title.includes('gls-class')) newTags.push('GLS-Klasse');
    if (url.includes('amg-gt') || title.includes('amg gt') || title.includes('gt-class')) newTags.push('GT-Klasse');
    if (url.includes('s-klasse') || title.includes('s-class')) newTags.push('S-Klasse');
    if (url.includes('sl-klasse') || title.includes('sl-class')) newTags.push('SL-Klasse');
    if (url.includes('v-klasse') || title.includes('v-class')) newTags.push('V-Klasse');
    if (url.includes('x-klasse') || title.includes('x-class')) newTags.push('X-Klasse');

    if (url.includes('911') || title.includes('911')) newTags.push('Porsche 911 Turbo');
    if (url.includes('taycan') || title.includes('taycan')) newTags.push('Porsche Taycan');

    if (url.includes('ghost') || title.includes('ghost')) newTags.push('Rolls-Royce Ghost');
    if (url.includes('cullinan') || title.includes('cullinan')) newTags.push('Rolls-Royce Cullinan');

    if (title.includes('continental gt speed') || url.includes('continental-gt-speed')) newTags.push('Bentley Continental GT Speed');
    if (title.includes('continental gtc speed') || url.includes('continental-gtc-speed')) newTags.push('Bentley Continental GTC Speed');

    if (url.includes('urus') || title.includes('urus')) newTags.push('Lamborghini Urus SE');
    if (url.includes('p530') || title.includes('p530')) newTags.push('P530');
    if (url.includes('smart-1') || title.includes('#1')) newTags.push('smart #1');
    if (url.includes('smart-3') || title.includes('#3')) newTags.push('smart #3');

    if (newTags.length > 0) {
      const slug = `brabus-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
      const dbProduct = dbProductMap.get(slug);

      if (dbProduct) {
        const existingTags = dbProduct.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
        
        // Only update if there's a real difference
        if (mergedTags.length !== existingTags.length) {
          await prisma.shopProduct.update({
            where: { id: dbProduct.id },
            data: { tags: mergedTags }
          });
          updated++;
        }
      }
    }
  });

  console.log(`\nUpdated tags for ${updated} products.`);
}

main().finally(() => prisma.$disconnect());
