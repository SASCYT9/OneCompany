/**
 * Burger Motorsports — DeepL Translator
 * Translates EN titles + descriptions → Ukrainian
 * Post-processes to preserve brand names, engine codes, etc.
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
import * as deepl from 'deepl-node';

const DEEPL_KEY = process.env.DEEPL_AUTH_KEY;
if (!DEEPL_KEY) { console.error('Missing DEEPL_AUTH_KEY in .env.local'); process.exit(1); }

const translator = new deepl.Translator(DEEPL_KEY);
const prisma = new PrismaClient();

// ── Batch size for DeepL (max 50 texts per request) ──
const BATCH_SIZE = 40;
const DELAY_MS = 300; // Rate limit safety

// ── Post-processing: fix common DeepL Ukrainian issues ──
function postProcess(text) {
  if (!text) return text;
  let t = text;

  // Fix common DeepL mistranslations for automotive domain
  t = t.replace(/Бургер Моторспортс?/gi, 'Burger Motorsports');
  t = t.replace(/Бі-Ем-Ес/gi, 'BMS');
  t = t.replace(/Паливо-Це!/gi, 'Fuel-It!');
  t = t.replace(/Ф'юел-Іт!/gi, 'Fuel-It!');
  t = t.replace(/Драгі/gi, 'Dragy');
  
  // Keep JB4/JB+ untranslated
  t = t.replace(/ДжейБі4/gi, 'JB4');
  t = t.replace(/ДжейБі\+/gi, 'JB+');
  t = t.replace(/Джей-Бі 4/gi, 'JB4');
  
  // "Vehicle Fitment" → "Сумісні автомобілі" (if DeepL uses something weird)
  t = t.replace(/Встановлення на транспортні засоби?/gi, 'Сумісні автомобілі');
  t = t.replace(/Підходить для транспортних засобів/gi, 'Сумісні автомобілі');
  
  // "Plug and play" consistency
  t = t.replace(/підключи (та|і) грай/gi, 'підключи і працюй');
  t = t.replace(/підключив (і|та) працюй/gi, 'підключи і працюй');
  
  // "Made in USA" / "Виробництво США"
  t = t.replace(/Зроблено в США/gi, 'Виробництво США');
  t = t.replace(/вироблено в США/gi, 'Виробництво США');
  
  // "Warranty" → "Гарантія виробника"
  t = t.replace(/(\d+)[- ]?річна гарантія/gi, 'Гарантія виробника');
  
  return t;
}

async function translateBatch(texts) {
  const results = await translator.translateText(texts, 'en', 'uk', {
    formality: 'default',
    tagHandling: 'html',
  });
  
  // DeepL returns array for batch, single object for single text
  if (Array.isArray(results)) {
    return results.map(r => postProcess(r.text));
  }
  return [postProcess(results.text)];
}

async function main() {
  console.log('🍔🇺🇦 Burger Motorsports DeepL Translation Engine');
  console.log('='.repeat(50));

  // Check usage
  const usage = await translator.getUsage();
  console.log(`DeepL Usage: ${usage.character?.count?.toLocaleString() || '?'} / ${usage.character?.limit?.toLocaleString() || '?'} chars`);

  // Get products needing translation
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: 'Burger Motorsports',
      bodyHtmlUa: '',
    },
    select: { id: true, titleEn: true, bodyHtmlEn: true },
    orderBy: { priceUsd: 'desc' },
  });

  console.log(`Products needing translation: ${products.length}\n`);

  if (products.length === 0) {
    console.log('✅ All products already translated!');
    await prisma.$disconnect();
    return;
  }

  // Estimate characters
  const totalChars = products.reduce((sum, p) => sum + (p.titleEn?.length || 0) + (p.bodyHtmlEn?.length || 0), 0);
  console.log(`Total characters to translate: ${totalChars.toLocaleString()}`);
  console.log(`Estimated batches: ${Math.ceil(products.length / BATCH_SIZE)}\n`);

  let translated = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    
    try {
      // Translate titles
      const titles = batch.map(p => p.titleEn || '');
      const translatedTitles = await translateBatch(titles);

      // Translate descriptions
      const descriptions = batch.map(p => p.bodyHtmlEn || '');
      const translatedDescs = await translateBatch(descriptions);

      // Update DB
      for (let j = 0; j < batch.length; j++) {
        await prisma.shopProduct.update({
          where: { id: batch[j].id },
          data: {
            titleUa: translatedTitles[j] || batch[j].titleEn,
            bodyHtmlUa: translatedDescs[j] || '',
          },
        });
        translated++;
      }

      process.stdout.write(`\r  ✅ Translated: ${translated}/${products.length} | Errors: ${errors}`);
    } catch (err) {
      console.error(`\n  ❌ Batch ${i}-${i + batch.length} error: ${err.message}`);
      
      // If quota exceeded, stop
      if (err.message?.includes('Quota') || err.message?.includes('456')) {
        console.error('\n⚠️ DeepL quota exceeded. Stopping.');
        break;
      }
      
      errors += batch.length;
      
      // Wait longer on error
      await new Promise(r => setTimeout(r, 5000));
    }

    // Rate limit delay
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n\n${'='.repeat(50)}`);
  console.log(`✅ Translated: ${translated}`);
  console.log(`❌ Errors: ${errors}`);

  // Show samples
  const samples = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } },
    select: { titleEn: true, titleUa: true, bodyHtmlUa: true },
    take: 3,
    orderBy: { priceUsd: 'desc' },
  });

  console.log('\n=== Translation samples ===');
  for (const s of samples) {
    console.log(`\n  EN: ${s.titleEn}`);
    console.log(`  UA: ${s.titleUa}`);
    console.log(`  Desc preview: ${s.bodyHtmlUa.slice(0, 150)}...`);
  }

  // Final usage
  const usageAfter = await translator.getUsage();
  console.log(`\nDeepL Usage after: ${usageAfter.character?.count?.toLocaleString() || '?'} / ${usageAfter.character?.limit?.toLocaleString() || '?'} chars`);

  await prisma.$disconnect();
}

main().catch(console.error);
