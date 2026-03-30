/**
 * Burger Motorsports — Ollama Translation Preview
 * Test translation quality with Gemma 3 12B before full batch
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const OLLAMA_URL = 'http://localhost:11434/api/generate';

const SYSTEM_PROMPT = `You are a professional Ukrainian translator for an automotive performance parts e-commerce store. Translate the given English text to Ukrainian following these rules:

1. Use natural Ukrainian, not machine translation.
2. Keep brand names UNTRANSLATED: JB4, BMS, Fuel-It!, JB+, CANflex, JB4PRO, Burger Motorsports, Dragy
3. Keep engine/model codes UNTRANSLATED: N54, B58, S58, B48, S55, etc.
4. Keep vehicle names in original: BMW 335i, Kia Stinger, Audi RS6, etc.
5. HP → "к.с.", torque → "крутний момент", plug & play → "підключи і працюй"
6. "Vehicle Fitment" → "Сумісні автомобілі"
7. "Made in USA" → "Виробництво США"
8. Keep technical units (psi, whp, tq) unchanged
9. Respond with ONLY the Ukrainian translation, nothing else. No explanations.`;

async function translateWithOllama(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  
  const resp = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: 'gemma3:4b',
      prompt: `Translate this to Ukrainian:\n\n${text}`,
      system: SYSTEM_PROMPT,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 4096,
      },
    }),
  });
  
  clearTimeout(timeout);

  const data = await resp.json();
  return data.response?.trim() || '';
}

async function main() {
  console.log('🍔🇺🇦 Ollama Translation Preview (Gemma 3 12B)\n');

  const samples = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlEn: true, productType: true, priceUsd: true },
    orderBy: { priceUsd: 'desc' },
  });

  const picks = [
    samples.find(s => s.productType === 'JB4 Tuners' && s.bodyHtmlEn.length > 1000 && s.bodyHtmlEn.length < 3000),
    samples.find(s => s.productType === 'Intakes' && s.bodyHtmlEn.length > 500),
    samples.find(s => s.bodyHtmlEn.length < 100 && s.bodyHtmlEn.length > 30),
  ].filter(Boolean);

  for (const product of picks) {
    console.log('━'.repeat(80));
    console.log(`📦 [${product.productType}] ${product.titleEn}`);
    console.log(`   $${product.priceUsd} | ${product.bodyHtmlEn.length} chars\n`);

    // Translate title
    const t0 = Date.now();
    const titleUa = await translateWithOllama(product.titleEn);
    console.log('🔤 TITLE:');
    console.log(`   EN: ${product.titleEn}`);
    console.log(`   UA: ${titleUa}`);

    // Translate description (truncate for preview)
    const descEn = product.bodyHtmlEn.slice(0, 1500);
    const descUa = await translateWithOllama(descEn);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`\n📝 DESCRIPTION (${elapsed}s):`);
    console.log(`   EN: ${descEn.slice(0, 200)}...`);
    console.log(`   UA: ${descUa.slice(0, 300)}...`);
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
