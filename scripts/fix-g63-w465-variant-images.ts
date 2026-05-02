/**
 * iPE didn't ship per-variant featured_image for the G63 W465 — the importer
 * sequentially mapped each variant to gallery[N], so the "Non-Downpipe"
 * variant ended up bound to image03.jpg (a tips closeup) instead of the main
 * system shot. Pin all 3 variants to the primary image so toggling between
 * downpipe options doesn't suddenly show a tips photo.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

(async () => {
  const product = await prisma.shopProduct.findFirst({
    where: { slug: 'ipe-mercedes-benz-amg-g63-w465-exhaust-system' },
    include: { variants: true, media: { orderBy: { position: 'asc' } } },
  });
  if (!product) {
    console.log('not found');
    await prisma.$disconnect();
    return;
  }
  const main = product.media[0]?.src ?? product.image;
  if (!main) {
    console.log('no main image');
    await prisma.$disconnect();
    return;
  }
  for (const v of product.variants) {
    const current = v.image?.split('/').pop();
    const target = main.split('/').pop();
    const tag = current === target ? 'unchanged' : 'CHANGE';
    console.log(`  [${tag}] ${v.option1Value} / ${v.option2Value}  ${current ?? '?'} -> ${target}`);
    if (APPLY && current !== target) {
      await prisma.shopProductVariant.update({
        where: { id: v.id },
        data: { image: main },
      });
    }
  }
  console.log(APPLY ? '\n(applied)' : '\n(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
