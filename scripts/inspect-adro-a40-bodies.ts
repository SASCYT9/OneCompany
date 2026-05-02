import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

async function main() {
  const rows = await p.shopProduct.findMany({
    where: { slug: { in: ['adro-a14a40-1301', 'adro-a14a40-1401'] } },
    select: { slug: true, sku: true, shortDescEn: true, shortDescUa: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  for (const r of rows) {
    console.log(`\n========== ${r.sku} (${r.slug}) ==========`);
    console.log('--- shortDescEn ---'); console.log(r.shortDescEn ?? '(null)');
    console.log('--- shortDescUa ---'); console.log(r.shortDescUa ?? '(null)');
    console.log('--- bodyHtmlEn ---'); console.log(r.bodyHtmlEn ?? '(null)');
    console.log('--- bodyHtmlUa ---'); console.log(r.bodyHtmlUa ?? '(null)');
  }
  await p.$disconnect();
}
main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
