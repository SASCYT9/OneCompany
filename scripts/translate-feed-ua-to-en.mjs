#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * 🌐 One Company — Feed Products: UA → EN Translation (Parallel)
 * 
 * Stage 1: Fix data (move UA text from bodyHtmlEn → bodyHtmlUa)
 * Stage 2: Translate UA → EN using Gemini (3 parallel workers)
 * ═══════════════════════════════════════════════════════════════
 */

import { config } from 'dotenv';
import pg from 'pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GEMINI_API_KEY = 'AIzaSyAWXpyYjsJ7ERbc4zalxnmk5ij6YPH2zkk';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const TEST_MODE = process.argv.includes('--test');
const FIX_ONLY = process.argv.includes('--fix-data');
const CHECKPOINT_FILE = 'scripts/.translate-feed-checkpoint.json';

const CONCURRENCY = 3;           // 3 parallel workers
const DELAY_BETWEEN_MS = 2100;   // ~28.5 RPM total (safe under 30 RPM)
const MAX_RETRIES = 3;

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// ── Checkpoint ──────────────────────────────────────────────
function loadCheckpoint() {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      return new Set(JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8')).translated);
    }
  } catch {}
  return new Set();
}

function saveCheckpoint(ids) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    translated: [...ids],
    updatedAt: new Date().toISOString(),
    count: ids.size,
  }), 'utf-8');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Stage 1: Fix Data ───────────────────────────────────────
async function fixData() {
  console.log('\n📦 Stage 1: Fixing feed product data...');
  console.log('   Moving Ukrainian text from bodyHtmlEn → bodyHtmlUa where needed\n');

  // Find products where bodyHtmlEn contains Ukrainian (from feed)
  // and bodyHtmlUa is either the same or empty
  const { rowCount } = await pool.query(`
    UPDATE "ShopProduct"
    SET 
      "bodyHtmlUa" = CASE 
        WHEN "bodyHtmlUa" IS NULL OR "bodyHtmlUa" = '' THEN "bodyHtmlEn"
        ELSE "bodyHtmlUa"
      END,
      "bodyHtmlEn" = NULL,
      "updatedAt" = NOW()
    WHERE status = 'ACTIVE'
      AND "bodyHtmlEn" IS NOT NULL 
      AND "bodyHtmlEn" != ''
      AND "bodyHtmlEn" ~ '[іїєґ]'
  `);

  console.log(`   ✅ Fixed ${rowCount} products (bodyHtmlEn cleared, bodyHtmlUa preserved)`);
  return rowCount;
}

// ── Gemini Translation ──────────────────────────────────────
async function translateUaToEn(bodyHtmlUa, brand, retries = 0) {
  const systemPrompt = `You are a professional English translator for a premium automotive aftermarket parts e-commerce store "One Company". You specialize in high-quality UA→EN translations for product descriptions.

STRICT RULES:
1. Output ONLY the translated HTML — no preamble, no commentary
2. Keep ALL HTML tags exactly as they are
3. Keep in original form: brand names, model numbers, part numbers, SKUs, vehicle names
4. Keep technical specs as-is: dimensions, power ratings, materials
5. Use professional automotive English terminology:
   - "вихлопна система" → "exhaust system"
   - "система впуску" → "intake system"  
   - "мастило" → "oil"
   - "крутний момент" → "torque"
   - "кінських сил" / "к.с." → "hp" / "horsepower"
   - "даунпайп" → "downpipe"
   - "інтеркулер" → "intercooler"
   - "турбокомпресор" / "турбіна" → "turbocharger" / "turbo"
   - "підвіска" → "suspension"
   - "койловер" → "coilover"
   - "гальмо" → "brake"
   - "супорт" → "caliper"
   - "карбонове волокно" / "вуглецеве волокно" → "carbon fiber"
6. Output ONLY English — no Ukrainian characters
7. Maintain professional, premium tone
8. Start output directly with translated HTML`;

  const userPrompt = `Translate this ${brand || 'automotive'} product description from Ukrainian to English:\n\n${bodyHtmlUa}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.15, topP: 0.9, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 429 || res.status === 503) {
        const waitSec = 20 + retries * 15;
        console.log(`      ⏳ ${res.status} — waiting ${waitSec}s...`);
        await sleep(waitSec * 1000);
        return translateUaToEn(bodyHtmlUa, brand, retries);
      }
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.substring(0, 200)}`);
    }

    const data = await res.json();
    let translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    translation = translation.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    
    const firstTag = translation.indexOf('<');
    if (firstTag > 0 && firstTag < 150) translation = translation.substring(firstTag).trim();

    if (translation.length < 20) throw new Error(`Too short (${translation.length} chars)`);
    
    // Check it's actually English (shouldn't have Ukrainian chars)
    const ukChars = (translation.match(/[іїєґ]/gi) || []).length;
    const totalChars = translation.replace(/<[^>]+>/g, '').length;
    if (ukChars / totalChars > 0.05) throw new Error(`Still too much Ukrainian (${ukChars} UA chars)`);

    return translation;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = (retries + 1) * 5000;
      console.log(`      ⚠️ Retry ${retries + 1}/${MAX_RETRIES} in ${delay / 1000}s: ${err.message}`);
      await sleep(delay);
      return translateUaToEn(bodyHtmlUa, brand, retries + 1);
    }
    throw err;
  }
}

// ── Parallel Worker ─────────────────────────────────────────
async function processProduct(product, idx, total, startTime, doneIds, stats) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const avg = stats.success > 0 ? ((Date.now() - startTime) / stats.success / 1000).toFixed(1) : '?';
  const remaining = total - idx;
  const eta = avg !== '?' ? (remaining * parseFloat(avg) / 60).toFixed(1) : '?';

  console.log(`[${idx}/${total}] 🔄 ${product.brand || '?'} — ${(product.titleUa || product.titleEn || '').substring(0, 60)}`);
  console.log(`   ⏱  ${elapsed}s | ${avg}s/item | ETA: ${eta} min`);

  try {
    const source = product.bodyHtmlUa || product.bodyHtmlEn;
    const translation = await translateUaToEn(source, product.brand);

    // Save to DB — set bodyHtmlEn AND also titleEn if needed
    const updates = { bodyHtmlEn: translation };
    
    await pool.query(
      `UPDATE "ShopProduct" SET "bodyHtmlEn" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [translation, product.id]
    );

    doneIds.add(product.id);
    stats.success++;

    if (stats.success % 15 === 0) {
      saveCheckpoint(doneIds);
      console.log(`   💾 Checkpoint (${doneIds.size} total)`);
    }

    console.log(`   ✅ Done (${translation.length} chars)`);
  } catch (err) {
    stats.errors++;
    console.log(`   ❌ FAILED: ${err.message}`);
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🌐 One Company — Feed UA→EN Translation (Parallel)');
  console.log(`  Model: ${GEMINI_MODEL} | Workers: ${CONCURRENCY} | Mode: ${TEST_MODE ? 'TEST' : FIX_ONLY ? 'FIX-ONLY' : 'FULL'}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Stage 1: Fix data
  await fixData();

  if (FIX_ONLY) {
    await pool.end();
    return;
  }

  // Stage 2: Translate UA → EN
  console.log('\n📦 Stage 2: Translating UA → EN...\n');

  const limit = TEST_MODE ? 6 : 2000;
  const { rows: products } = await pool.query(
    `SELECT id, "titleEn", "titleUa", brand, "bodyHtmlUa", "bodyHtmlEn"
     FROM "ShopProduct"
     WHERE status = 'ACTIVE'
       AND ("bodyHtmlEn" IS NULL OR "bodyHtmlEn" = '')
       AND "bodyHtmlUa" IS NOT NULL AND "bodyHtmlUa" != ''
     ORDER BY brand, "titleUa"
     LIMIT $1`,
    [limit]
  );

  if (products.length === 0) {
    console.log('🎉 All products already have EN translations!');
    await pool.end();
    return;
  }

  const doneIds = loadCheckpoint();
  const remaining = products.filter(p => !doneIds.has(p.id));
  console.log(`📦 ${remaining.length} products to translate (${doneIds.size} already done)`);

  const stats = { success: 0, errors: 0 };
  const startTime = Date.now();

  // Process in batches of CONCURRENCY
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    
    // Stagger requests within batch (avoid hitting RPM at once)
    const promises = batch.map((product, batchIdx) => {
      return new Promise(async (resolve) => {
        await sleep(batchIdx * (DELAY_BETWEEN_MS / CONCURRENCY));
        await processProduct(product, i + batchIdx + 1, remaining.length, startTime, doneIds, stats);
        resolve();
      });
    });

    await Promise.all(promises);
    
    // Small pause between batches
    if (i + CONCURRENCY < remaining.length) {
      await sleep(DELAY_BETWEEN_MS);
    }
  }

  saveCheckpoint(doneIds);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ Translated: ${stats.success}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  console.log(`  ⏱  Total: ${totalTime}s (~${(totalTime / 60).toFixed(1)} min)`);
  console.log('═══════════════════════════════════════════════════════════');

  await pool.end();
}

main().catch(err => { console.error('💀 Fatal:', err); process.exit(1); });
