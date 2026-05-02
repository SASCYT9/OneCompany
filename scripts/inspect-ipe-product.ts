import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  if (!slug) {
    console.log('usage: npx tsx scripts/inspect-ipe-product.ts <slug>');
    process.exit(1);
  }
  const r = await p.shopProduct.findFirst({
    where: { slug },
    include: {
      variants: { orderBy: [{ option1Value: 'asc' }, { option2Value: 'asc' }, { option3Value: 'asc' }] },
      media: { orderBy: { position: 'asc' } },
      metafields: true,
    },
  });
  if (!r) {
    console.log('not found');
    process.exit(1);
  }
  console.log(`# ${r.slug}`);
  console.log(`title: ${r.title}`);
  console.log(`\n## Gallery (${r.media.length})`);
  for (const [i, m] of r.media.entries()) {
    const file = m.src.split('/').pop()?.split('?')[0] ?? m.src;
    console.log(`  ${String(i + 1).padStart(2, '0')}: ${file}  (alt: ${m.altText ?? '-'})`);
  }
  console.log(`\n## Variants (${r.variants.length})`);
  for (const v of r.variants) {
    const img = v.image?.split('/').pop()?.split('?')[0] ?? '-';
    const price = v.priceUsd ?? '-';
    console.log(`  [${v.option1Value} | ${v.option2Value} | ${v.option3Value ?? ''}]  $${price}  → ${img}`);
  }
  const mf = r.metafields.find((m) => m.key === 'gallery_image_materials');
  if (mf) console.log(`\nmetafield gallery_image_materials: ${mf.value}`);
  await p.$disconnect();
})();
