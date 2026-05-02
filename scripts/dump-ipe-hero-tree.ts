import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
import { buildIpeHeroVehicleTree } from '@/lib/ipeHeroCatalog';

const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: 'iPE', mode: 'insensitive' } },
    include: { variants: true, metafields: true },
  });
  const tree = buildIpeHeroVehicleTree(products as any);
  console.log(`Total brands in tree: ${tree.length}`);
  for (const brand of tree) {
    console.log(`\n${brand.key} (${brand.models.length} models)`);
    for (const m of brand.models) {
      const bodies = m.bodies.map((b) => b.label).join(', ');
      console.log(`  ${m.label}  [${bodies}]  lines=${m.lines.join('|') || '-'}`);
    }
  }
  await p.$disconnect();
})();
