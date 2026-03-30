import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const triggerPhrases = [
  '<p>This item will be installed',
  '<p>Цей товар буде встановлено',
  '<p>This item requires extensive consultation',
  '<p>Цей товар вимагає детальної консультації',
  '<p>We use cookies',
  '<p>Ми використовуємо файли cookie',
  '<p>Please note: The purchase and installation',
  '<p>Зверніть увагу: придбання та встановлення',
  '<p>Please note: The installation must be performed',
  '<p>Зверніть увагу: монтаж повинен виконуватися',
  '<p>After internal verification',
  '<p>Після внутрішньої перевірки',
];

function cleanHtml(html) {
  if (!html) return html;
  
  let earliestIndex = html.length;
  for (const phrase of triggerPhrases) {
    const idx = html.indexOf(phrase);
    if (idx !== -1 && idx < earliestIndex) {
      earliestIndex = idx;
    }
  }

  return earliestIndex !== html.length ? html.substring(0, earliestIndex).trim() : html;
}

async function main() {
  console.log('🧹 Cleaning Brabus Descriptions in DB...');

  // Get all brabus products
  const products = await prisma.shopProduct.findMany({
    where: { vendor: 'Brabus' }
  });

  let updatedCount = 0;

  for (const p of products) {
    let updated = false;
    const updateData: any = {};

    const fieldsToClean = [
      'seoDescriptionEn', 'seoDescriptionUa',
      'bodyHtmlEn', 'bodyHtmlUa',
      'longDescEn', 'longDescUa',
      'shortDescEn', 'shortDescUa'
    ];

    for (const field of fieldsToClean) {
      const val = (p as any)[field];
      if (val) {
        const cleaned = cleanHtml(val as string);
        if (cleaned !== val) {
          updateData[field] = cleaned;
          updated = true;
        }
      }
    }
        
    if (updated) {
      await prisma.shopProduct.update({
         where: { id: p.id },
         data: updateData
      });
      updatedCount++;
    }
  }

  console.log(`✅ Cleaned up ${updatedCount} ShopProducts!`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
