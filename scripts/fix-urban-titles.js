/**
 * Urban Automotive — Fix EN titles using LOCAL Gemma (Ollama)
 * Translates via localhost:11434 Ollama API directly
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:12b';
const BATCH_SIZE = 15;

async function translateBatch(items) {
  const prompt = `You are a professional automotive parts translator. Translate these Ukrainian product titles to English.

CRITICAL RULES:
- Keep ALL brand/model names EXACTLY: Urban, URBAN, Widetrack, Range Rover, Land Rover, Defender, Bentley, Rolls-Royce, Audi, BMW, Mercedes, Porsche, VW, Volkswagen, Lamborghini, Golf, RSQ8, G-Wagon, etc.
- Use British English: "Bonnet" (not "Hood"), "Carbon Fibre" (not "Carbon Fiber"), "Colour" etc. 
- Output ONLY a valid JSON array. No explanations.

Common translations:
- "Карбоновий" → "Carbon Fibre"
- "Обвіс" → "Bodykit"
- "Капот" → "Bonnet"
- "Спойлер" → "Spoiler"
- "Дифузор" → "Diffuser"
- "Дзеркала" → "Mirrors"
- "Ковані диски" → "Forged Alloy Wheels"
- "Литі диски" → "Cast Alloy Wheels"
- "Бризковики" → "Mudflaps"
- "Фаркоп" → "Towbar"
- "Вихлопна система" → "Exhaust System"
- "Накінечники вихлопу" → "Exhaust Tips"
- "Повітрозабірники" → "Air Intakes"
- "Антикрило" → "Rear Wing"
- "Решітка" → "Grille"
- "Підніжки" → "Side Steps"
- "Фартух" → "Apron"
- "Молдинги" → "Mouldings"
- "Вставки" → "Inserts"
- "дюймові/дюймових" → just the number + inch mark (")
- "на замовлення" → "Custom"

Input (JSON array with slug and titleUa):
${JSON.stringify(items.map(i => ({ slug: i.slug, ua: i.titleUa })))}

Output a JSON array with "slug" and "en" fields. ONLY JSON, nothing else:`;

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 4096 },
    }),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  
  const data = await response.json();
  const text = data.response.trim();
  
  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array in response: ${text.substring(0, 300)}`);
  
  return JSON.parse(match[0]);
}

async function main() {
  console.log('🔧 Urban Automotive — Local Gemma EN Title Fix\n');

  // Check Ollama is running
  try {
    const healthCheck = await fetch('http://localhost:11434/api/tags');
    if (!healthCheck.ok) throw new Error('Not OK');
    const tags = await healthCheck.json();
    const models = tags.models?.map(m => m.name) || [];
    console.log(`✅ Ollama running. Models: ${models.join(', ')}`);
    
    if (!models.some(m => m.includes('gemma'))) {
      console.log(`⚠️  No gemma model found. Available: ${models.join(', ')}`);
      console.log('   Will try gemma3:12b anyway...');
    }
  } catch (e) {
    console.error('❌ Ollama is not running at localhost:11434');
    console.error('   Start it with: ollama serve');
    process.exit(1);
  }

  // Get broken products
  const allProducts = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { vendor: { contains: 'urban', mode: 'insensitive' } },
        { brand: { contains: 'urban', mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, titleEn: true, titleUa: true },
    orderBy: { slug: 'asc' },
  });

  const broken = allProducts.filter(p => 
    p.titleEn && /[а-яіїєґА-ЯІЇЄҐ]/.test(p.titleEn)
  );

  console.log(`\n📊 Total: ${allProducts.length}, Still broken: ${broken.length}\n`);

  let updated = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < broken.length; i += BATCH_SIZE) {
    const batch = broken.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(broken.length / BATCH_SIZE);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${elapsed}s elapsed)...`);
    
    try {
      const translations = await translateBatch(batch);
      
      for (const t of translations) {
        const orig = batch.find(b => b.slug === t.slug);
        if (!orig || !t.en || t.en.length < 5) continue;
        
        // Verify it's actually English now
        if (/[а-яіїєґА-ЯІЇЄҐ]{3,}/.test(t.en)) {
          console.log(`  ⚠️  Still Cyrillic: ${t.slug}: "${t.en}"`);
          errors++;
          continue;
        }
        
        await prisma.shopProduct.update({
          where: { id: orig.id },
          data: { titleEn: t.en },
        });
        
        console.log(`  ✅ ${t.slug}: "${t.en}"`);
        updated++;
      }
    } catch (err) {
      console.error(`  ❌ Batch failed: ${err.message}`);
      errors += batch.length;
    }
  }

  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n\n=== DONE in ${totalSeconds}s ===`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Errors: ${errors}`);
}

main()
  .catch(err => console.error('Fatal:', err))
  .finally(() => prisma.$disconnect());
