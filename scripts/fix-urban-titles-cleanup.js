/**
 * Urban Automotive — Fix remaining 32 broken + 25 untranslated titles
 * Uses Ollama Gemma with smaller batches (5) to avoid JSON errors
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:12b';
const BATCH_SIZE = 5; // smaller to prevent JSON failures

async function translateUA_to_EN(items) {
  const prompt = `Translate these Ukrainian product titles to English. Keep brand/model names. British English. Output ONLY a valid JSON array with "slug" and "en" fields, nothing else.

${JSON.stringify(items.map(i => ({ slug: i.slug, ua: i.titleUa || i.titleEn })))}`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.1, num_predict: 2048 } }),
  });
  const data = await response.json();
  const match = data.response.trim().match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON');
  return JSON.parse(match[0]);
}

async function translateEN_to_UA(items) {
  const prompt = `Translate these English automotive product titles to Ukrainian. Keep brand/model names. Output ONLY a valid JSON array with "slug" and "ua" fields, nothing else.

${JSON.stringify(items.map(i => ({ slug: i.slug, en: i.titleEn })))}`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.1, num_predict: 2048 } }),
  });
  const data = await response.json();
  const match = data.response.trim().match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON');
  return JSON.parse(match[0]);
}

async function main() {
  console.log('🔧 Urban — Fixing remaining titles\n');

  const allProducts = await prisma.shopProduct.findMany({
    where: { OR: [{vendor:{contains:'urban',mode:'insensitive'}},{brand:{contains:'urban',mode:'insensitive'}}] },
    select: { id: true, slug: true, titleEn: true, titleUa: true },
    orderBy: { slug: 'asc' },
  });

  // Still broken EN (has Cyrillic)
  const brokenEN = allProducts.filter(p => p.titleEn && /[а-яіїєґА-ЯІЇЄҐ]/.test(p.titleEn));
  // UA = EN, both English
  const missingUA = allProducts.filter(p => p.titleEn === p.titleUa && !/[а-яіїєґА-ЯІЇЄҐ]/.test(p.titleEn));

  console.log(`🔴 Still broken EN: ${brokenEN.length}`);
  console.log(`🟡 Missing UA: ${missingUA.length}\n`);

  let fixed = 0;

  // Fix broken EN
  for (let i = 0; i < brokenEN.length; i += BATCH_SIZE) {
    const batch = brokenEN.slice(i, i + BATCH_SIZE);
    try {
      const translations = await translateUA_to_EN(batch);
      for (const t of translations) {
        const orig = batch.find(b => b.slug === t.slug);
        if (!orig || !t.en || /[а-яіїєґ]{3,}/i.test(t.en)) continue;
        await prisma.shopProduct.update({ where: { id: orig.id }, data: { titleEn: t.en } });
        console.log(`  ✅ EN: ${t.slug}: "${t.en}"`);
        fixed++;
      }
    } catch (e) { console.error(`  ❌ EN batch: ${e.message}`); }
  }

  // Fix missing UA
  for (let i = 0; i < missingUA.length; i += BATCH_SIZE) {
    const batch = missingUA.slice(i, i + BATCH_SIZE);
    try {
      const translations = await translateEN_to_UA(batch);
      for (const t of translations) {
        const orig = batch.find(b => b.slug === t.slug);
        if (!orig || !t.ua) continue;
        await prisma.shopProduct.update({ where: { id: orig.id }, data: { titleUa: t.ua } });
        console.log(`  ✅ UA: ${t.slug}: "${t.ua}"`);
        fixed++;
      }
    } catch (e) { console.error(`  ❌ UA batch: ${e.message}`); }
  }

  console.log(`\n=== DONE: ${fixed} fixed ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
