#!/usr/bin/env node
/**
 * Translate scraped do88.se rich descriptions (Swedish) to bilingual
 * HTML — Ukrainian + English — via Gemini.
 *
 * Input:  scripts/do88/scraped/do88-pages-rich.json
 * Output: scripts/do88/scraped/do88-rich-translated.json
 *
 * Output entries are keyed by SKU and contain bodyHtmlUa / bodyHtmlEn
 * ready to write directly into ShopProduct.
 *
 * Usage:
 *   node scripts/do88/translate-do88-rich.mjs              # translate everything that has richChars > 200
 *   node scripts/do88/translate-do88-rich.mjs --limit 5    # first 5 only
 *   node scripts/do88/translate-do88-rich.mjs --resume     # skip SKUs already in output (default behavior; flag is a no-op kept for clarity)
 *   node scripts/do88/translate-do88-rich.mjs --force      # retranslate even if already in output
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPED_DIR = path.join(__dirname, 'scraped');
const INPUT = path.join(SCRAPED_DIR, 'do88-pages-rich.json');
const OUTPUT = path.join(SCRAPED_DIR, 'do88-rich-translated.json');
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const argVal = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const LIMIT = argVal('--limit') ? parseInt(argVal('--limit'), 10) : Infinity;
const FORCE = args.includes('--force');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in env.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

function buildPrompt(page) {
  const s = page.sections || {};
  const partsSv = [];
  if (page.headline) partsSv.push(`HEADLINE:\n${page.headline}`);
  if (s.bakgrund) partsSv.push(`BAKGRUND:\n${s.bakgrund}`);
  if (s.bullets && s.bullets.length) partsSv.push(`NYCKELEGENSKAPER:\n- ${s.bullets.join('\n- ')}`);
  else if (s.nyckelegenskaper) partsSv.push(`NYCKELEGENSKAPER:\n${s.nyckelegenskaper}`);
  if (s.overvaganden) partsSv.push(`ÖVERVÄGANDEN:\n${s.overvaganden}`);
  if (s.fardigaProdukten) partsSv.push(`DEN FÄRDIGA PRODUKTEN:\n${s.fardigaProdukten}`);
  if (s.variants && s.variants.length) partsSv.push(`VARIANTER:\n${s.variants.map((v, i) => `${i + 1}. ${v}`).join('\n')}`);
  // Capture any non-standard sections too (each product can have unique
  // headers like "Bar&Plate cellpaket", "Avancerad värmehantering" etc.)
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'string' && k.startsWith('other:')) {
      const heading = k.slice('other:'.length);
      partsSv.push(`${heading.toUpperCase()}:\n${v}`);
    }
  }
  if (page.fitment) partsSv.push(`PASSAR (FITMENT):\n${page.fitment}`);
  if (page.oeRefs && page.oeRefs.length) partsSv.push(`OE-REFERENSER:\n${page.oeRefs.join(', ')}`);

  const swedish = partsSv.join('\n\n');

  return `You are a senior automotive copywriter translating a do88 (Swedish performance cooling brand) product page into Ukrainian and English.

Convert the Swedish source below into TWO complete HTML descriptions — one Ukrainian (bodyHtmlUa) and one English (bodyHtmlEn). Render with this exact structure:

  <p><strong>{headline}</strong></p>
  <h3>{section heading}</h3>
  <p>{paragraph}</p>
  <ul><li>{bullet}</li>...</ul>     ← only for the key-features section
  <p><strong>Підходить для:</strong> {fitment}</p>   ← only if fitment is present
  <p><strong>OE-референси:</strong> {oe refs}</p>     ← only if OE refs are present

Section headings (use these EXACT translations for the standard sections; for non-standard headings like "Bar&Plate cellpaket" or "Avancerad värmehantering" or "Utmaningar med originalkomponenterna", translate the heading naturally and keep it as <h3>):
  BAKGRUND     → UA "Передумова"            EN "Background"
  NYCKELEGENSKAPER → UA "Ключові характеристики" EN "Key features"
  ÖVERVÄGANDEN → UA "Чому це важливо"        EN "Considerations"
  DEN FÄRDIGA PRODUKTEN → UA "Готовий продукт" EN "The finished product"
  VARIANTER    → UA "Варіанти комплектації"  EN "Configurations"
  PASSAR       → render as <p><strong>Підходить для:</strong> ...</p> (UA) / <p><strong>Fits:</strong> ...</p> (EN)
  OE-REFERENSER → render as <p><strong>OE-референси:</strong> ...</p> (UA) / <p><strong>OE references:</strong> ...</p> (EN)

Translation requirements:
  - Use professional automotive Ukrainian terminology: "інтеркулер" (not "проміжний охолоджувач"), "пайпінг" (not "труби"), "впускні пайпи" (not "впускні шланги"), "теплообмінник", "патрубки наддуву", "наддув", "Вакуумне інфузування", "карбонове волокно", "силіконовий патрубок", "BMC конічний фільтр", "CFD-аналіз", "флоубенч". Match the technical register of the Swedish original — do NOT dumb it down.
  - Convert numeric units faithfully (CFM, bar, psi, mm, mil → keep as-is; "mil" is Swedish miles = 10 km, so "2000–2500 mil" → "20 000–25 000 км" in UA, "20,000–25,000 km" in EN).
  - Keep brand names verbatim (do88, Garrett, BMC, Setrab, OEM/OE).
  - Do NOT invent specs. Do NOT add disclaimers. Do NOT mention prices, availability, or warranty unless present in the source.
  - The HTML must be valid: only <p>, <h3>, <ul>, <li>, <strong>, <em>, <br>. No inline styles, no classes, no script.
  - Preserve all bullet items from NYCKELEGENSKAPER as <li> elements verbatim in the target language. Same for VARIANTER (also as <ul>/<li>, with the "Configurations" / "Варіанти комплектації" heading).
  - For the variants list, render as <h3>{heading}</h3><ul><li>...</li>...</ul>.
  - If a section is empty in the source, omit it entirely from the output.

SKU: ${page.sku || '?'}
Title: ${page.title || '?'}

SWEDISH SOURCE:
${swedish}

Respond ONLY with raw JSON in this exact shape (no markdown fences, no explanation):
{
  "bodyHtmlUa": "<p>...</p><h3>...</h3>...",
  "bodyHtmlEn": "<p>...</p><h3>...</h3>..."
}`;
}

async function translateOne(page, retries = 3) {
  const prompt = buildPrompt(page);
  try {
    const r = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });
    let raw = r.response.text().trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
    }
    const obj = JSON.parse(raw);
    if (!obj.bodyHtmlUa || !obj.bodyHtmlEn) throw new Error('missing fields');
    return obj;
  } catch (err) {
    if (retries > 0) {
      const wait = err.message?.includes('429') ? 10000 : 3000;
      await new Promise((r) => setTimeout(r, wait));
      return translateOne(page, retries - 1);
    }
    return { error: err.message };
  }
}

async function loadOutput() {
  try {
    return JSON.parse(await fs.readFile(OUTPUT, 'utf8'));
  } catch {
    return { translatedAt: null, bySku: {} };
  }
}

async function main() {
  const inp = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  const out = await loadOutput();

  const targets = inp.pages.filter(
    (p) => p.sku && p.richChars > 200 && (FORCE || !out.bySku[p.sku.toUpperCase()])
  );
  const limited = targets.slice(0, LIMIT);

  console.log(`[translate] ${limited.length} pages to translate (skipping ${inp.pages.length - limited.length} that lack content or are already done)`);

  const limit = pLimit(CONCURRENCY);
  let done = 0;
  const promises = limited.map((page) =>
    limit(async () => {
      const t0 = Date.now();
      const result = await translateOne(page);
      const sku = page.sku.toUpperCase();
      out.bySku[sku] = {
        ...(result.error ? { error: result.error } : { bodyHtmlUa: result.bodyHtmlUa, bodyHtmlEn: result.bodyHtmlEn }),
        title: page.title,
        sourceUrl: page.url,
        sourceChars: page.richChars,
        translatedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
      };
      done++;
      const mark = result.error ? `ERR ${result.error.slice(0, 60)}` : `${result.bodyHtmlUa.length} chars UA / ${result.bodyHtmlEn.length} chars EN`;
      process.stdout.write(`\r[${done}/${limited.length}] ${sku.padEnd(20)} ${mark}`.padEnd(110));
      // Persist every 5 to be safe under failures.
      if (done % 5 === 0 || done === limited.length) {
        out.translatedAt = new Date().toISOString();
        await fs.writeFile(OUTPUT, JSON.stringify(out, null, 2));
      }
      // Soft pacing
      await new Promise((r) => setTimeout(r, 200));
    })
  );
  await Promise.all(promises);
  process.stdout.write('\n');
  out.translatedAt = new Date().toISOString();
  await fs.writeFile(OUTPUT, JSON.stringify(out, null, 2));
  console.log(`[write] ${OUTPUT}`);

  // Summary
  const errors = Object.entries(out.bySku).filter(([_, v]) => v.error).map(([k, v]) => `${k}: ${v.error}`);
  if (errors.length) {
    console.log(`[errors] ${errors.length}:\n  ${errors.slice(0, 10).join('\n  ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
