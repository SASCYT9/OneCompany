#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * 🌐 One Company — Mass Product Translation (EN → UA)
 * Uses local Ollama (TranslateGemma 4B GPU) to translate bodyHtmlEn → bodyHtmlUa
 * ═══════════════════════════════════════════════════════════════
 *
 * Usage:
 *   node scripts/translate-products.mjs                  # Full run (598 products)
 *   node scripts/translate-products.mjs --test           # Test mode (3 products)
 *   node scripts/translate-products.mjs --model gemma4:26b  # Use specific model
 *   node scripts/translate-products.mjs --resume         # Resume from last checkpoint
 */

import { config } from 'dotenv';
import pg from 'pg';

config(); // Load .env

// Allow ad-hoc local script runs against managed Postgres endpoints
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Config ──────────────────────────────────────────────────
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = process.argv.includes('--model')
  ? process.argv[process.argv.indexOf('--model') + 1]
  : 'translategemma:4b';
const TEST_MODE = process.argv.includes('--test');
const RESUME_MODE = process.argv.includes('--resume');
const BATCH_SIZE = 1; // Process 1 at a time (RAM-safe)
const MAX_RETRIES = 3;
const CHECKPOINT_FILE = 'scripts/.translate-checkpoint.json';

// ── Database ────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

// ── Checkpoint (resume support) ─────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'fs';

function loadCheckpoint() {
  if (!RESUME_MODE) return new Set();
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
      console.log(`📋 Resuming: ${data.translated.length} already done`);
      return new Set(data.translated);
    }
  } catch {}
  return new Set();
}

function saveCheckpoint(translatedIds) {
  writeFileSync(
    CHECKPOINT_FILE,
    JSON.stringify({ translated: [...translatedIds], updatedAt: new Date().toISOString() }),
    'utf-8'
  );
}

// ── Translation Prompt ──────────────────────────────────────
const IS_TRANSLATE_GEMMA = MODEL.startsWith('translategemma');

function buildPrompt(bodyHtmlEn, titleEn, brand) {
  if (IS_TRANSLATE_GEMMA) {
    // TranslateGemma works best with simple, direct instructions
    return `Translate the following English product description to Ukrainian.
Keep HTML tags, brand names (${brand}), model numbers, and technical specs in English.
Only translate descriptive text to Ukrainian.

${bodyHtmlEn}`;
  }
  // Full prompt for larger models (gemma4:latest, gemma4:26b)
  return `You are a professional translator for a premium Ukrainian automotive parts store.
Translate the following product description from English to Ukrainian.

CRITICAL RULES:
1. Keep ALL HTML tags exactly as they are (<p>, <ul>, <li>, <strong>, <br>, <h2>, etc.)
2. Keep brand names in English: "${brand}", model numbers, part numbers, SKUs
3. Keep technical specifications in their original form (e.g., "3.5 gallon", "76mm", "HP", "torque")
4. Keep vehicle model names in English (BMW M3, Toyota Supra, Mercedes-AMG, etc.)
5. Translate ONLY the descriptive/marketing text to natural Ukrainian
6. Do NOT add any title, brand name, headers, or commentary before/after the translation
7. Do NOT add "Brand:", "Product:", or any prefixes — output ONLY the translated HTML body
8. Use professional automotive terminology in Ukrainian
9. Output MUST start with an HTML tag (like <p> or <div>) — no plain text before it

English HTML to translate:
${bodyHtmlEn}

Ukrainian translation (raw HTML only, nothing else):`;
}

// ── Ollama API Call ─────────────────────────────────────────
async function translateWithOllama(prompt, retries = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min timeout

    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.2, // Low temp = more deterministic translation
          top_p: 0.9,
          num_ctx: IS_TRANSLATE_GEMMA ? 4096 : 8192, // Smaller ctx = faster for small models
          num_predict: IS_TRANSLATE_GEMMA ? 2048 : 4096, // Max output tokens
          repeat_penalty: 1.1,
          num_gpu: 99, // Force all layers to GPU
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    let translation = data.response?.trim() || '';

    // Clean up: remove markdown fences if model wraps in ```html ... ```
    translation = translation.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Remove any "Brand: ...", "Product: ...", or title lines before HTML
    translation = translation
      .replace(/^.*?Brand:\s*.+$/gm, '')
      .replace(/^.*?Product:\s*.+$/gm, '')
      .replace(/^.*?Бренд:\s*.+$/gm, '')
      .replace(/^.*?Продукт:\s*.+$/gm, '')
      .trim();

    // If there's plain text before the first HTML tag, strip it
    const firstTagIndex = translation.indexOf('<');
    if (firstTagIndex > 0 && firstTagIndex < 100) {
      translation = translation.substring(firstTagIndex).trim();
    }

    // Validate: must contain some HTML or at least some Ukrainian chars
    const hasUkrainian = /[а-яіїєґ]/i.test(translation);
    const hasContent = translation.length > 20;

    if (!hasUkrainian || !hasContent) {
      throw new Error('Translation appears invalid (no Ukrainian content)');
    }

    return translation;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = (retries + 1) * 5000;
      console.log(`   ⚠️  Retry ${retries + 1}/${MAX_RETRIES} in ${delay / 1000}s: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return translateWithOllama(prompt, retries + 1);
    }
    throw err;
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🌐 One Company — Product Translation Engine');
  console.log(`  Model: ${MODEL} | Mode: ${TEST_MODE ? 'TEST (3 items)' : 'FULL'}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // 1. Check Ollama is alive
  try {
    const health = await fetch('http://localhost:11434/api/tags');
    if (!health.ok) throw new Error('Not OK');
    console.log('✅ Ollama is running');
  } catch {
    console.error('❌ Ollama is not running! Start it with: ollama serve');
    process.exit(1);
  }

  // 2. Fetch products to translate
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
    console.log('🎉 All products already translated!');
    await pool.end();
    return;
  }

  console.log(`📦 Found ${products.length} products to translate`);
  console.log('');

  // 3. Load checkpoint
  const doneIds = loadCheckpoint();
  const remaining = products.filter((p) => !doneIds.has(p.id));
  console.log(`🔄 Remaining: ${remaining.length} (${doneIds.size} already done)`);
  console.log('');

  // 4. Translate
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < remaining.length; i++) {
    const product = remaining[i];
    const idx = i + 1;
    const total = remaining.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const avg = successCount > 0 ? ((Date.now() - startTime) / successCount / 1000).toFixed(1) : '?';

    console.log(
      `[${idx}/${total}] 🔄 Translating: ${product.brand} — ${(product.titleEn || '').substring(0, 60)}...`
    );
    console.log(`   ⏱  Elapsed: ${elapsed}s | Avg: ${avg}s/item | ETA: ${avg !== '?' ? ((total - idx) * avg / 60).toFixed(1) : '?'} min`);

    try {
      const bodyLen = (product.bodyHtmlEn || '').length;
      if (bodyLen > 15000) {
        console.log(`   ⚠️  Very long body (${bodyLen} chars) — may take a while`);
      }

      const prompt = buildPrompt(product.bodyHtmlEn, product.titleEn, product.brand || 'Unknown');
      const translation = await translateWithOllama(prompt);

      // Save to DB
      await pool.query(
        `UPDATE "ShopProduct" SET "bodyHtmlUa" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [translation, product.id]
      );

      doneIds.add(product.id);
      successCount++;

      // Save checkpoint every 5 items
      if (successCount % 5 === 0) {
        saveCheckpoint(doneIds);
      }

      console.log(`   ✅ Done (${translation.length} chars)`);
    } catch (err) {
      errorCount++;
      console.log(`   ❌ FAILED: ${err.message}`);
    }

    console.log('');
  }

  // 5. Final checkpoint
  saveCheckpoint(doneIds);

  // 6. Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ Translated: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  ⏱  Total time: ${totalTime}s (~${(totalTime / 60).toFixed(1)} min)`);
  console.log('═══════════════════════════════════════════════════════════');

  await pool.end();
}

main().catch((err) => {
  console.error('💀 Fatal error:', err);
  process.exit(1);
});
