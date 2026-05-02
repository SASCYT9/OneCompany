import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
import { detectAdroModels, detectAdroMakes } from '../src/lib/adroCatalog.ts';

const p = new PrismaClient();

async function main() {
  const slugs = ['adro-a14a40-1301', 'adro-a14a40-1401', 'adro-a14a50-1301', 'adro-a14a50-1401'];
  const rows = await p.shopProduct.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, sku: true, titleEn: true, titleUa: true },
  });
  for (const r of rows) {
    const title = { en: r.titleEn, ua: r.titleUa } as never;
    const product = { title, slug: r.slug } as never;
    const makes = detectAdroMakes(product);
    const models = detectAdroModels(product);
    console.log(`\n${r.sku}`);
    console.log(`  EN: ${r.titleEn}`);
    console.log(`  makes : ${makes.join(', ')}`);
    console.log(`  models: ${models.join(' | ')}`);
  }
  await p.$disconnect();
}
main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
