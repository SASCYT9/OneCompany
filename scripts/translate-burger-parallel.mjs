/**
 * Burger Motorsports — PARALLEL Translation via TranslateGemma 4B
 * Uses 3 concurrent workers to maximize GPU utilization
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const OLLAMA = 'http://localhost:11434/api/generate';
const MODEL = 'translategemma:4b';
const MAX_DESC_CHARS = 3000;
const TIMEOUT_MS = 120_000;
const CONCURRENCY = 3;

async function translate(text, retries = 2) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        prompt: `Translate the following English text to Ukrainian. Output ONLY the Ukrainian translation, nothing else. No explanations, no alternatives.\n\n${text}`,
        stream: false,
        options: { temperature: 0.1, num_predict: 4096 },
      }),
    });

    clearTimeout(timer);
    const data = await resp.json();
    let result = data.response?.trim() || '';
    result = result.replace(/^(Один з варіантів перекладу:|Переклад:|Ось переклад:|Translation:)\s*/i, '');
    result = result.replace(/\n\n\*\*Інші можливі варіанти.*/s, '');
    result = result.replace(/\n\nNote:.*/s, '');
    return result;
  } catch (err) {
    clearTimeout(timer);
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return translate(text, retries - 1);
    }
    return null;
  }
}

function postProcess(text) {
  if (!text) return text;
  return text
    .replace(/Бургер Моторспортс?/gi, 'Burger Motorsports')
    .replace(/Бі-Ем-Ес\b/gi, 'BMS')
    .replace(/Ф'юел-Іт!/gi, 'Fuel-It!')
    .replace(/Паливо-Це!/gi, 'Fuel-It!')
    .replace(/ДжейБі4/gi, 'JB4')
    .replace(/ДжейБі\+/gi, 'JB+')
    .replace(/підключи (та|і) грай/gi, 'підключи і працюй')
    .replace(/Зроблено в США/gi, 'Виробництво США')
    .replace(/вироблено в США/gi, 'Виробництво США');
}

async function translateProduct(product) {
  const titleUa = await translate(product.titleEn);
  const descEn = product.bodyHtmlEn.slice(0, MAX_DESC_CHARS);
  const descUa = descEn.length > 10 ? await translate(descEn) : '';

  if (titleUa) {
    await prisma.shopProduct.update({
      where: { id: product.id },
      data: {
        titleUa: postProcess(titleUa),
        bodyHtmlUa: postProcess(descUa || ''),
      },
    });
    return true;
  }
  return false;
}

async function main() {
  console.log('🍔🇺🇦 Burger Motorsports — PARALLEL Translation');
  console.log(`   Model: TranslateGemma 4B | Workers: ${CONCURRENCY}`);
  console.log('='.repeat(55));

  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: '' },
    select: { id: true, titleEn: true, bodyHtmlEn: true },
    orderBy: { priceUsd: 'desc' },
  });

  console.log(`\n📦 Remaining: ${products.length}\n`);
  if (products.length === 0) {
    console.log('✅ All done!');
    await prisma.$disconnect();
    return;
  }

  // Warm up
  console.log('🔥 Warming up...');
  await translate('Hello');
  console.log('   Ready!\n');

  let done = 0;
  let errors = 0;
  const startTime = Date.now();

  // Process with concurrency using a simple pool
  let idx = 0;

  async function worker(workerId) {
    while (idx < products.length) {
      const myIdx = idx++;
      const product = products[myIdx];
      try {
        const ok = await translateProduct(product);
        if (ok) done++;
        else errors++;
      } catch (err) {
        errors++;
      }

      const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const avgPerItem = (Date.now() - startTime) / (done + errors) / 1000;
      const remaining = ((products.length - done - errors) * avgPerItem / 60 / CONCURRENCY).toFixed(0);
      
      if ((done + errors) % 5 === 0 || (done + errors) <= CONCURRENCY) {
        process.stdout.write(
          `\r  ✅ ${done}/${products.length} | ❌ ${errors} | ${totalElapsed}min | ~${remaining}min left | W${workerId}    `
        );
      }
    }
  }

  // Launch workers
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker(w + 1));
  }
  await Promise.all(workers);

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n\n${'='.repeat(55)}`);
  console.log(`✅ Done: ${done} | ❌ Errors: ${errors} | ⏱️ ${totalMin} min`);

  // Final count
  const translated = await prisma.shopProduct.count({ where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } } });
  const remaining = await prisma.shopProduct.count({ where: { brand: 'Burger Motorsports', bodyHtmlUa: '' } });
  console.log(`📊 Total translated: ${translated}/606 | Remaining: ${remaining}`);

  // Samples
  const samples = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { not: '' } },
    select: { titleEn: true, titleUa: true, bodyHtmlUa: true },
    take: 3,
    orderBy: { updatedAt: 'desc' },
  });
  console.log('\n=== LATEST SAMPLES ===');
  for (const s of samples) {
    console.log(`  EN: ${s.titleEn}`);
    console.log(`  UA: ${s.titleUa}`);
    console.log(`  Desc: ${s.bodyHtmlUa.slice(0, 120)}...\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
