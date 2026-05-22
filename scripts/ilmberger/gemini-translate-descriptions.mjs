/**
 * Translate Ilmberger EN product descriptions (bodyHtmlEn) → UA via Gemini.
 *
 * Goes through each product in the input JSON, sends the raw EN description
 * HTML to Gemini, asks for a natural Ukrainian translation that PRESERVES
 * HTML tags + technical terms (ABE/TÜV/ISO 9001/prepreg/autoclave/Formula 1).
 *
 * Rate-limited to ~2 requests/sec to stay under the free Gemini quota.
 * Resumable: writes JSON after each row, so re-running picks up where it
 * stopped if interrupted.
 *
 * Run:
 *   node scripts/ilmberger/gemini-translate-descriptions.mjs --in tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json
 *   node scripts/ilmberger/gemini-translate-descriptions.mjs --in tmp/ilmberger-ducati-panigale-v4-2022.json --limit 1
 */
import { readFileSync, writeFileSync } from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

const argv = process.argv.slice(2);
const inFlag = argv.indexOf("--in");
if (inFlag < 0) {
  console.error("Usage: node gemini-translate-descriptions.mjs --in <json>");
  process.exit(1);
}
const JSON_PATH = argv[inFlag + 1];
const limitFlag = argv.indexOf("--limit");
const LIMIT = limitFlag >= 0 ? parseInt(argv[limitFlag + 1], 10) : Infinity;
const FORCE = argv.includes("--force"); // re-translate even if already translated

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not set. Add it to .env.local.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
});

const PROMPT_TEMPLATE = (
  titleUa,
  htmlEn
) => `Translate this Ilmberger Carbon product description from English to Ukrainian.

STRICT REQUIREMENTS:
1. PRESERVE all HTML tags exactly (h2, h3, h4, ul, li, p, span, em, strong, a). Tags must appear in the SAME ORDER. Don't add or remove tags.
2. KEEP these technical terms in original form: ABE, TÜV, ISO 9001, prepreg, autoclave, Formula 1, UV, OEM, ABS.
3. KEEP bike model names exactly: BMW, S 1000 RR, M 1000 RR, Ducati, Panigale V4, Streetfighter V4, V4 S, V4 R.
4. Replace any product title inside <h2> with: "${titleUa}"
5. Translate naturally — NOT word-by-word. Should read like a native Ukrainian copywriter wrote it.
6. Keep punctuation style (em-dashes, colons).
7. Use "карбон" not "вуглець".
8. Use "ручна укладка" / "ручна ламінація" for "hand-laid" / "hand laminated".
9. Output ONLY the translated HTML. No markdown fences, no commentary, no explanation.

EN HTML:
${htmlEn}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateOne(htmlEn, titleUa) {
  const prompt = PROMPT_TEMPLATE(titleUa, htmlEn);
  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  // Strip ``` markdown fences if Gemini wraps the response
  text = text
    .replace(/^```(?:html)?\s*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return text;
}

const products = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
console.log(`📥 Loaded ${products.length} products from ${JSON_PATH}`);
console.log(`   LIMIT=${LIMIT === Infinity ? "none" : LIMIT}, FORCE=${FORCE}\n`);

let translated = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < products.length; i++) {
  if (translated >= LIMIT) break;
  const p = products[i];
  if (!p.descriptionHtmlEn || p.descriptionHtmlEn.length < 50) {
    console.log(`  ⏭ [${i + 1}/${products.length}] ${p.sku} — no EN description`);
    skipped++;
    continue;
  }
  // Skip if already has a Gemini-translated description (length > 200 + contains Ukrainian chars + NOT from template)
  if (!FORCE && p.descriptionHtmlUaGemini) {
    console.log(`  ⏭ [${i + 1}/${products.length}] ${p.sku} — already Gemini-translated`);
    skipped++;
    continue;
  }
  try {
    process.stdout.write(`  [${i + 1}/${products.length}] ${p.sku} ... `);
    const ua = await translateOne(p.descriptionHtmlEn, p.titleUa ?? p.titleEn);
    p.descriptionHtmlUa = ua;
    p.descriptionHtmlUaGemini = true; // mark as Gemini-translated so we don't redo on next run
    writeFileSync(JSON_PATH, JSON.stringify(products, null, 2)); // checkpoint after each
    console.log(`✓ (${ua.length} chars)`);
    translated++;
    await sleep(500); // ~2 req/sec
  } catch (e) {
    console.log(`✗ ${e.message}`);
    failed++;
    await sleep(2000); // back off on error
  }
}

console.log(
  `\n✅ Translated ${translated}, skipped ${skipped}, failed ${failed} of ${products.length}.`
);
