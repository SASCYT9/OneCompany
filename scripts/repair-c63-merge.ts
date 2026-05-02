/**
 * Merge the two AMG C63 products under one filter model with two body chips.
 *
 * Before:
 *   ipe-mercedes-benz-c63-w204-c204-x204-3-exhaust   tag: "C63 (W204/C204/S204)"
 *   ipe-mercedes-benz-c63-c63s-w205-c205-titanium    tag: "AMG C63 / C63S (C205/W205)"
 *
 * The tree builder groups by base name (the part before parens), so these
 * appeared as two unrelated entries — "C63" (no AMG prefix, sorting after
 * all the AMG-prefixed siblings) and "AMG C63 / C63S".
 *
 * After: both share base "AMG C63", merging into one model with bodies
 * [C205/W205, W204/C204/S204]. Filter accuracy is preserved — the C63S
 * info is implied by the W205 chassis chip, and customers shopping for
 * Mercedes C63 parts now find both generations under one model node.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const RENAMES: Array<{ slug: string; from: string; to: string }> = [
  {
    slug: 'ipe-mercedes-benz-c63-w204-c204-x204-3-exhaust',
    from: 'C63 (W204/C204/S204)',
    to: 'AMG C63 (W204/C204/S204)',
  },
  {
    slug: 'ipe-mercedes-benz-c63-c63s-w205-c205-titanium',
    from: 'AMG C63 / C63S (C205/W205)',
    to: 'AMG C63 (C205/W205)',
  },
];

(async () => {
  for (const { slug, from, to } of RENAMES) {
    const product = await prisma.shopProduct.findFirst({ where: { slug } });
    if (!product) {
      console.log(`SKIP ${slug} — not in DB`);
      continue;
    }
    const tags = (product.tags ?? []).map(String);
    if (!tags.includes(from)) {
      console.log(`SKIP ${slug} — tag '${from}' already absent`);
      continue;
    }
    const next = tags.map((t) => (t === from ? to : t));
    console.log(`${slug}`);
    console.log(`  - ${from}`);
    console.log(`  + ${to}`);
    if (APPLY) {
      await prisma.shopProduct.update({ where: { id: product.id }, data: { tags: next } });
      console.log('  applied');
    }
  }
  if (!APPLY) console.log('\n(dry-run — pass --apply)');
  await prisma.$disconnect();
})();
