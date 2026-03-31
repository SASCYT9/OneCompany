import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const OLLAMA = 'http://localhost:11434/api/generate';

async function translateTG(text, langCode) {
  const reqBody = {
    model: 'translategemma:4b',
    prompt: `<2${langCode}> ${text}`,
    stream: false,
    options: { temperature: 0.1, num_predict: 256 },
  };

  try {
    const resp = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    
    if (!resp.ok) return null;
    const data = await resp.json();
    let res = data.response?.trim();
    // translategemma sometimes leaves the prefix <2en> or similar, strip it
    if (res?.startsWith(`<2`)) {
       res = res.replace(/^<2[a-z]{2}>\s*/, '');
    }
    return res;
  } catch (err) {
    return null;
  }
}

async function fixDo88() {
  console.log('🚀 Starting DO88 Title Fix with local TranslateGemma 4B...\n');

  // Fetch all DO88 products
  const products = await prisma.shopProduct.findMany({
    where: { vendor: 'DO88' },
    select: { id: true, sku: true, titleEn: true, titleUa: true },
  });

  console.log(`📦 Found ${products.length} DO88 products.`);

  let updatedCount = 0;
  
  // List of known Swedish fragments that were left behind in my regex script
  const swedishWords = /\b(kolfiber|modellanpassat|insugsk[åa]pa|insugssystem|pysventil|k[åa]pa|anslutning|r[öo]r|slang|f[öo]r|med|och|tryckr[öo]r|tryckslang)\b/i;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    
    // Check if titleEn or titleUa has Swedish words OR "Для авто Повітряний фільтр" syntax
    const hasSwedish = swedishWords.test(p.titleEn) || swedishWords.test(p.titleUa);
    const hasBadSyntax = p.titleUa.includes('Для авто ');

    if (!hasSwedish && !hasBadSyntax) {
      continue; // Skip if it looks fine
    }

    // 1. Clean up the EN title first
    const cleanEn = await translateTG(p.titleEn, 'en');
    
    if (!cleanEn) continue;

    // 2. Generate perfect UA title from the clean EN title
    const cleanUa = await translateTG(cleanEn, 'uk');
    
    if (!cleanUa) continue;

    const finalEn = cleanEn.replace('Do88', 'do88'); // Fix casing
    let finalUa = cleanUa.replace('Do88', 'do88');

    // Update DB
    await prisma.shopProduct.update({
      where: { id: p.id },
      data: {
        titleEn: finalEn,
        titleUa: finalUa,
      }
    });

    updatedCount++;
    console.log(`✅ [${updatedCount}] Fixed ${p.sku}`);
    console.log(`   EN: ${p.titleEn} -> ${finalEn}`);
    console.log(`   UA: ${p.titleUa} -> ${finalUa}\n`);
  }

  console.log(`\n🎉 Finished! Fixed ${updatedCount} products using your MAX RESOURCES!`);
  await prisma.$disconnect();
}

fixDo88().catch(console.error);
