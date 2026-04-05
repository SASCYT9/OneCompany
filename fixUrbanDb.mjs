import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const REPLACE_MAP = [
  { pattern: /захисник/gi, replace: 'Defender' },
  { pattern: /крейсер/gi, replace: 'Cruiser' },
  { pattern: /\(кольоровий\/автомобільний\/pcd\)/gi, replace: '(Color / Vehicle / PCD)' },
  { pattern: /\(колір\/транспортний засіб\/pcd\)/gi, replace: '(Color / Vehicle / PCD)' },
  { pattern: /\(колір\/автомобіль\/pcd\)/gi, replace: '(Color / Vehicle / PCD)' },
  { pattern: /Зображення скоро з\'явиться/gi, replace: 'Image Coming Soon' },
  { pattern: /Модульна сталь/gi, replace: 'Modular Steel' },
  { pattern: /Комплект розширювачів крил/gi, replace: 'Widetrack Arch Kit' },
  { pattern: /Вентиляційний отвір/gi, replace: 'Bonnet Vent' },
  { pattern: /оталь/gi, replace: 'сталь' }, // 18" Модульна оталь -> сталь
];

function sanitize(text) {
  if (!text) return text;
  let newText = text;
  for (const rule of REPLACE_MAP) {
    newText = newText.replace(rule.pattern, rule.replace);
  }
  return newText;
}

async function main() {
  console.log('Fetching Urban products...');
  const products = await prisma.shopProduct.findMany({
    where: { slug: { startsWith: 'urban-' } }
  });

  console.log(`Found ${products.length} products. Updating taxonomy and translations...`);

  let updatedCount = 0;
  for (const product of products) {
    const newTitleUa = sanitize(product.titleUa);
    const newTitleEn = sanitize(product.titleEn);
    const newShortUa = sanitize(product.shortDescUa);
    const newShortEn = sanitize(product.shortDescEn);

    // Also update Category if it's messed up
    const newCategoryUa = sanitize(product.categoryUa);
    const newCategoryEn = sanitize(product.categoryEn);

    await prisma.shopProduct.update({
      where: { id: product.id },
      data: {
        brand: 'Urban Automotive',
        vendor: 'Urban Automotive',
        titleUa: newTitleUa,
        titleEn: newTitleEn,
        shortDescUa: newShortUa,
        shortDescEn: newShortEn,
        categoryUa: newCategoryUa,
        categoryEn: newCategoryEn,
      }
    });

    updatedCount++;
    if (updatedCount % 50 === 0) {
      console.log(`Updated ${updatedCount}...`);
    }
  }

  console.log(`Success! Updated ${updatedCount} products.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
