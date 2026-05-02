/**
 * Rewrite the W465 G63's catalog tag from `AMG W465 G63` to
 * `AMG G63 (W465)` so the iPE hero filter groups it under the same
 * "AMG G63" model node as the W463 product (which already uses the
 * `AMG G63 (W463)` shape).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SLUG = 'ipe-mercedes-benz-amg-g63-w465-exhaust-system';
const OLD = 'AMG W465 G63';
const NEW = 'AMG G63 (W465)';

(async () => {
  const product = await prisma.shopProduct.findFirst({ where: { slug: SLUG } });
  if (!product) {
    console.log(`SKIP ${SLUG} — not in DB`);
    return;
  }
  const tags = (product.tags ?? []).map(String);
  if (!tags.includes(OLD)) {
    console.log(`SKIP ${SLUG} — tag '${OLD}' already absent. Current tags:`);
    console.log(`  ${tags.join(' | ')}`);
    return;
  }
  const next = tags.map((t) => (t === OLD ? NEW : t));
  console.log(`${SLUG}`);
  console.log(`  - ${OLD}`);
  console.log(`  + ${NEW}`);
  if (APPLY) {
    await prisma.shopProduct.update({ where: { id: product.id }, data: { tags: next } });
    console.log('  applied');
  } else {
    console.log('  (dry-run — pass --apply)');
  }
  await prisma.$disconnect();
})();
