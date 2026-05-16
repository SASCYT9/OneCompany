import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const SKUS = ["465-234-00", "464-234-00", "464-234-35", "465-800-FSB-99"];
const products = await p.shopProduct.findMany({
  where: { sku: { in: SKUS } },
  select: { sku: true, slug: true, titleEn: true, image: true, gallery: true },
});
for (const x of products) {
  console.log(`\n=== ${x.sku} | ${(x.titleEn || "").slice(0, 90)} ===`);
  console.log(`  slug: ${x.slug}`);
  console.log(`  image: ${x.image}`);
  console.log(`  gallery (${(x.gallery || []).length}):`);
  for (const u of x.gallery || []) console.log(`    ${u}`);
}
await p.$disconnect();
