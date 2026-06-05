import fs from 'node:fs';
import path from 'node:path';
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

  let output = `Total Urban Products: ${products.length}\n\n`;
  
  const l461Products = products.filter(p => {
    const hay = (p.sku + ' ' + p.slug + ' ' + p.titleEn).toLowerCase();
    return hay.includes('l461') || hay.includes('l460') || hay.includes('range rover sport 202') || hay.includes('range rover sport l461');
  });

  output += `L461/L460 Urban Products in DB (${l461Products.length}):\n`;
  l461Products.forEach(p => {
    output += `- SKU: ${p.sku} | Slug: ${p.slug}\n  Title: ${p.titleEn}\n  Image: ${p.image}\n  Gallery: ${JSON.stringify(p.gallery)}\n`;
  });

  fs.writeFileSync(path.resolve(process.cwd(), 'archive', 'scratch', 'db-products-list.txt'), output, 'utf8');
  console.log('Saved db-products-list.txt successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
