#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * 🌐 One Company — Mass Product Translation via Gemini API
 * Translates bodyHtmlEn → bodyHtmlUa using Google Gemini 2.5 Flash Lite
 * ═══════════════════════════════════════════════════════════════
 *
 * Usage:
 *   node scripts/translate-gemini.mjs                # Full run
 *   node scripts/translate-gemini.mjs --test         # Test (3 items)
 *   node scripts/translate-gemini.mjs --rollback     # Rollback bad Ollama translations
 *   node scripts/translate-gemini.mjs --check        # Check a few translated samples
 */

import { config } from 'dotenv';
import pg from 'pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Config ──────────────────────────────────────────────────
const GEMINI_API_KEY = process.argv.includes('--key')
  ? process.argv[process.argv.indexOf('--key') + 1]
  : 'AIzaSyAWXpyYjsJ7ERbc4zalxnmk5ij6YPH2zkk';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const TEST_MODE = process.argv.includes('--test');
const ROLLBACK_MODE = process.argv.includes('--rollback');
const CHECK_MODE = process.argv.includes('--check');
const CHECKPOINT_FILE = 'scripts/.translate-gemini-checkpoint.json';

// Rate limiting: Free tier = 30 RPM for flash-lite
const DELAY_BETWEEN_REQUESTS_MS = 2200; // ~27 RPM, safe margin
const MAX_RETRIES = 3;

// ── Database ────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

// ── Checkpoint ──────────────────────────────────────────────
function loadCheckpoint() {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
      return new Set(data.translated);
    }
  } catch {}
  return new Set();
}

function saveCheckpoint(translatedIds) {
  writeFileSync(
    CHECKPOINT_FILE,
    JSON.stringify({
      translated: [...translatedIds],
      updatedAt: new Date().toISOString(),
      count: translatedIds.size,
    }),
    'utf-8'
  );
}

// ── Gemini Translation ──────────────────────────────────────
async function translateWithGemini(bodyHtmlEn, brand, retries = 0) {
  const systemPrompt = `You are a professional Ukrainian translator for a premium automotive aftermarket parts e-commerce store "One Company" (onecompany.com.ua). You specialize in high-quality EN→UA translations for product descriptions.

STRICT RULES:
1. Output ONLY the translated HTML — no preamble, no "Here is the translation:", no commentary
2. Keep ALL HTML tags exactly as they are (<p>, <ul>, <li>, <strong>, <br>, <h2>, <h3>, <span>, <div>, etc.)
3. Keep in English: brand names, model numbers, part numbers, SKUs, vehicle names (BMW M3, Toyota Supra, etc.)
4. Keep technical specs in original form: dimensions (76mm, 3.5"), power (HP, kW, Nm), materials (T304, Inconel)
5. Use NATURAL professional Ukrainian automotive terminology:
   - "exhaust" → "вихлопна система" (NOT "вихлоп")
   - "intake" → "система впуску" (NOT "впуск")
   - "oil" → "мастило" (NOT "олія" when referring to engine/mechanical oil)
   - "performance" → "продуктивність" or "характеристики"
   - "torque" → "крутний момент"
   - "horsepower" → "к.с." or "кінських сил"
   - "downpipe" → "даунпайп"
   - "intercooler" → "інтеркулер"  
   - "turbocharger" → "турбокомпресор" or "турбіна"
   - "supercharger" → "компресор"
   - "suspension" → "підвіска"
   - "coilover" → "койловер"
   - "brake" → "гальмо/гальмівний"
   - "rotor" → "ротор/гальмівний диск"
   - "caliper" → "супорт"
   - "fitment" → "посадка" or "сумісність"
6. NEVER output Russian — only Ukrainian (і, ї, є, ґ are Ukrainian; ы, э, ё are Russian)
7. Maintain professional, premium tone matching a luxury automotive parts store
8. If the source text has line breaks or paragraph structure, preserve it
9. Start output directly with translated HTML content`;

  const userPrompt = `Translate this ${brand || 'automotive'} product description from English to Ukrainian:

${bodyHtmlEn}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.15,
          topP: 0.9,
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 429) {
        // Rate limit — wait and retry
        const waitSec = 30 + retries * 15;
        console.log(`   ⏳ Rate limited. Waiting ${waitSec}s...`);
        await sleep(waitSec * 1000);
        return translateWithGemini(bodyHtmlEn, brand, retries);
      }
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.substring(0, 200)}`);
    }

    const data = await res.json();
    let translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Clean up markdown fences
    translation = translation.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Remove any preamble before first HTML tag
    const firstTagIndex = translation.indexOf('<');
    if (firstTagIndex > 0 && firstTagIndex < 150) {
      translation = translation.substring(firstTagIndex).trim();
    }

    // Validate
    const hasUkrainian = /[іїєґ]/i.test(translation);
    const hasRussian = /[ыэё]/i.test(translation);
    const hasContent = translation.length > 20;

    if (hasRussian) {
      throw new Error('Translation contains Russian characters (ы, э, ё) — rejected');
    }
    if (!hasUkrainian || !hasContent) {
      throw new Error(`Translation appears invalid (ua=${hasUkrainian}, len=${translation.length})`);
    }

    return translation;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = (retries + 1) * 5000;
      console.log(`   ⚠️  Retry ${retries + 1}/${MAX_RETRIES} in ${delay / 1000}s: ${err.message}`);
      await sleep(delay);
      return translateWithGemini(bodyHtmlEn, brand, retries + 1);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Rollback Bad Ollama Translations ────────────────────────
async function rollbackOllamaTranslations() {
  const checkpointFile = 'scripts/.translate-checkpoint.json';
  if (!existsSync(checkpointFile)) {
    console.log('❌ No Ollama checkpoint found');
    return;
  }

  const data = JSON.parse(readFileSync(checkpointFile, 'utf-8'));
  const ids = data.translated;
  console.log(`🔄 Rolling back ${ids.length} Ollama translations...`);

  const { rowCount } = await pool.query(
    `UPDATE "ShopProduct" SET "bodyHtmlUa" = NULL, "updatedAt" = NOW() WHERE id = ANY($1::text[])`,
    [ids]
  );

  console.log(`✅ Rolled back ${rowCount} products to bodyHtmlUa = NULL`);
}

// ── Check Translation Quality ───────────────────────────────
async function checkTranslations() {
  const { rows } = await pool.query(`
    SELECT id, "titleEn", brand, 
           LEFT("bodyHtmlEn", 200) as en_preview, 
           LEFT("bodyHtmlUa", 200) as ua_preview
    FROM "ShopProduct" 
    WHERE status='ACTIVE' 
      AND "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != ''
      AND "bodyHtmlUa" IS NOT NULL AND "bodyHtmlUa" != ''
    ORDER BY "updatedAt" DESC
    LIMIT 5
  `);

  for (const r of rows) {
    console.log(`\n━━━ ${r.brand} — ${r.titleEn} ━━━`);
    console.log(`EN: ${r.en_preview}...`);
    console.log(`UA: ${r.ua_preview}...`);
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🌐 One Company — Gemini Product Translation Engine');
  console.log(`  Model: ${GEMINI_MODEL} | Mode: ${TEST_MODE ? 'TEST' : ROLLBACK_MODE ? 'ROLLBACK' : CHECK_MODE ? 'CHECK' : 'FULL'}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Rollback mode
  if (ROLLBACK_MODE) {
    await rollbackOllamaTranslations();
    await pool.end();
    return;
  }

  // Check mode
  if (CHECK_MODE) {
    await checkTranslations();
    await pool.end();
    return;
  }

  // Verify API key works
  try {
    const testRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}?key=${GEMINI_API_KEY}`
    );
    if (!testRes.ok) throw new Error(`HTTP ${testRes.status}`);
    console.log('✅ Gemini API key verified');
  } catch (err) {
    console.error(`❌ Gemini API key invalid: ${err.message}`);
    process.exit(1);
  }

  // Fetch products to translate
  const limit = TEST_MODE ? 3 : 1000;
  const { rows: products } = await pool.query(
    `SELECT id, "titleEn", "titleUa", brand, "bodyHtmlEn"
     FROM "ShopProduct"
     WHERE status = 'ACTIVE'
       AND "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != ''
       AND ("bodyHtmlUa" IS NULL OR "bodyHtmlUa" = '')
     ORDER BY brand, "titleEn"
     LIMIT $1`,
    [limit]
  );

  if (products.length === 0) {
    console.log('🎉 All products already have UA translations!');
    await pool.end();
    return;
  }

  console.log(`📦 Found ${products.length} products to translate`);

  // Load checkpoint
  const doneIds = loadCheckpoint();
  const remaining = products.filter((p) => !doneIds.has(p.id));
  if (doneIds.size > 0) {
    console.log(`📋 Resuming: ${doneIds.size} already done, ${remaining.length} remaining`);
  }
  console.log('');

  // Translate
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < remaining.length; i++) {
    const product = remaining[i];
    const idx = i + 1;
    const total = remaining.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const avg = successCount > 0 ? ((Date.now() - startTime) / successCount / 1000).toFixed(1) : '?';
    const eta = avg !== '?' ? ((total - idx) * parseFloat(avg) / 60).toFixed(1) : '?';

    console.log(`[${idx}/${total}] 🔄 ${product.brand || '?'} — ${(product.titleEn || '').substring(0, 65)}`);
    console.log(`   ⏱  ${elapsed}s elapsed | ${avg}s/item | ETA: ${eta} min`);

    try {
      const translation = await translateWithGemini(product.bodyHtmlEn, product.brand);

      // Save to DB
      await pool.query(
        `UPDATE "ShopProduct" SET "bodyHtmlUa" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [translation, product.id]
      );

      doneIds.add(product.id);
      successCount++;

      // Checkpoint every 10 items
      if (successCount % 10 === 0) {
        saveCheckpoint(doneIds);
        console.log(`   💾 Checkpoint saved (${doneIds.size} total)`);
      }

      console.log(`   ✅ Done (${translation.length} chars)`);
    } catch (err) {
      errorCount++;
      console.log(`   ❌ FAILED: ${err.message}`);
    }

    // Rate limiting delay
    if (i < remaining.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Final
  saveCheckpoint(doneIds);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ Translated: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  ⏱  Total: ${totalTime}s (~${(totalTime / 60).toFixed(1)} min)`);
  console.log('═══════════════════════════════════════════════════════════');

  await pool.end();
}

main().catch((err) => {
  console.error('💀 Fatal:', err);
  process.exit(1);
});
