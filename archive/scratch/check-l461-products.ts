import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { sku: { startsWith: 'URB-' } },
        { slug: { startsWith: 'urb-' } }
      ]
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      titleEn: true,
      image: true,
      gallery: true
    }
  });

  console.log(`Found ${products.length} Urban products in DB:`);
  for (const p of products) {
    if (p.slug.includes('l461') || p.slug.includes('l460') || p.titleEn.includes('L461') || p.titleEn.includes('L460')) {
      console.log(`- SKU: ${p.sku}, Slug: ${p.slug}\n  Title: ${p.titleEn}\n  Image: ${p.image}\n  Gallery: ${JSON.stringify(p.gallery)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
