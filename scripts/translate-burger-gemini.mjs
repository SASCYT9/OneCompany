/**
 * Burger Motorsports — Ollama Translation (replaces translate-burger-gemini stub)
 *
 * Reads Burger products from DB, translates titleEn → titleUa and
 * bodyHtmlEn → bodyHtmlUa via local Ollama, writes back to DB.
 *
 * Idempotent: skips products where titleUa already differs from titleEn
 * AND bodyHtmlUa is non-empty.
 *
 * Usage:
 *   node scripts/translate-burger-gemini.mjs                       # process all
 *   node scripts/translate-burger-gemini.mjs --limit 5             # only 5 products
 *   node scripts/translate-burger-gemini.mjs --slug burger-s58-jb4-for-g8x-bmw-m2-m3-m4
 *   node scripts/translate-burger-gemini.mjs --model gemma3:12b    # default; "translategemma:4b" is faster
 *   node scripts/translate-burger-gemini.mjs --dry-run             # print samples without writing
 *
 * Why Ollama: Gemini Cloud API is 403 Forbidden on this project (API not
 * enabled). Local Ollama with gemma3 produces high-quality EN→UA translation
 * that matches/exceeds the prior translategemma:4b pipeline.
 */

import dotenv from 'dotenv';
dotenv.config({ override: true }); // override system env (system has stale GEMINI_API_KEY)
import pLimit from 'p-limit';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();

// ── CLI args ──
const args = process.argv.slice(2);
const getArg = (name, dflt = null) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : dflt;
};
const LIMIT = parseInt(getArg('--limit', '0'), 10) || 0;
const SLUG = getArg('--slug', null);
const MODEL_NAME = getArg('--model', 'gemini-2.5-flash');
const CONCURRENCY = parseInt(getArg('--concurrency', '4'), 10) || 4;
const TIMEOUT_MS = parseInt(getArg('--timeout', '120000'), 10) || 120000;
const DRY_RUN = args.includes('--dry-run');

// Gemini SDK
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || !apiKey.startsWith('AIza')) {
  console.error('Missing or invalid GEMINI_API_KEY (must start with AIza). Got tail:', apiKey?.slice(-6));
  process.exit(1);
}
const { GoogleGenerativeAI } = await import('@google/generative-ai');
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// ── Domain terms that MUST stay untranslated (case-insensitive matching, exact form output) ──
const KEEP_VERBATIM = [
  // Brand names
  'Burger Motorsports', 'BMS', 'JB4', 'JB+', 'JB1', 'JBPRO', 'JB4PRO',
  'Fuel-It!', 'Fuel-It', 'BMS Elite', 'Dragy', 'CANflex', 'CANbus', 'CANfuel',
  'AEM', 'Aquatec', 'NGK', 'Brisk', 'Bosch', 'Walbro', 'DDP',
  // Common brands/models referenced
  'BMW', 'Toyota', 'Ford', 'Porsche', 'Mercedes', 'Mercedes-Benz', 'AMG',
  'Mazda', 'Lexus', 'Subaru', 'Audi', 'VW', 'Volkswagen', 'Honda', 'Acura',
  'Dodge', 'RAM', 'Jeep', 'GMC', 'Chevrolet', 'Chevy', 'Cadillac',
  'Mini', 'Aston Martin', 'Range Rover', 'Land Rover',
  'Hyundai', 'Kia', 'Genesis', 'Nissan', 'Infiniti',
  // Models — keep exact form
  'M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM',
  'X3M', 'X4M', 'X5M', 'X6M', 'Z4', 'Z3', 'i3', 'i4', 'i7', 'i8', 'iX',
  'GR Supra', 'Mustang', 'F-150', 'Bronco', 'Raptor', 'Charger', 'Challenger',
  'Stinger', 'Camaro', 'Corvette', 'Wagoneer', 'Gladiator', 'Wrangler',
  // Engine codes
  'S14', 'S38', 'S50', 'S52', 'S54', 'S55', 'S58', 'S62', 'S63', 'S65', 'S68', 'S85',
  'B38', 'B46', 'B48', 'B58', 'B57', 'N20', 'N26', 'N51', 'N52', 'N53', 'N54', 'N55',
  'N57', 'N63', 'N73', 'N74', 'M50', 'M52', 'M54', 'M62',
  '2JZ', '1JZ', '1UR', '2UR', 'V35A', 'T24A', 'EA113', 'EA888', 'EA839', 'EA211',
  'M133', 'M139', 'M156', 'M157', 'M177', 'M178', 'M256', 'M260', 'M264',
  // Fuel/octane terms
  'E85', 'E50', 'WMI', 'AFR', 'OBDII', 'DME', 'ECU', 'TMAP', 'MAF', 'MAP',
  'OEM', 'CNC', 'NPT', 'AN',
];

// Build chassis-code matcher: E12-E93, F01-F98, G01-G99, U06-U25, I01-I22, R5x-R6x, etc.
const CHASSIS_RX = /\b([EFG]\d{2}|U\d{2}|I\d{2}|R[56]\d|F[56]\d|J0\d|W\d{3}|C\d{3}|X\d{3}|S2\d{2}|99[1-2]|981|982|718|95[78]|97[01]|992)\b/g;

const SYSTEM_PROMPT = `You are a top-tier automotive copywriter and translator working for a Ukrainian-Brabus performance shop.
You translate Burger Motorsports product titles and descriptions from English to Ukrainian.

CRITICAL RULES:
1. PRESERVE ALL HTML TAGS exactly as they appear in input. Do not remove, add, or reorder tags.
2. KEEP UNTRANSLATED (verbatim, in original Latin form): brand names (Burger Motorsports, BMS, JB4, JB+, Fuel-It!, Bosch, NGK, Walbro, AEM, Brisk, Dragy, etc.), car brands (BMW, Toyota, Ford, Porsche, Mercedes, Audi, VW, Mazda, Lexus, Subaru, Honda, Acura, Dodge, RAM, Jeep, Chevrolet, GMC, Cadillac, Mini, Aston Martin, Range Rover, Hyundai, Kia, Genesis, Nissan, Infiniti, Maserati, Lotus), car models (M3, M4, M5, X3M, GR Supra, Mustang, F-150, etc.), chassis codes (E36, E46, E92, F30, F80, G20, G80, G87, F87, F97, F98, etc.), engine codes (S58, S55, B58, B48, N54, N55, N63, S65, S68, etc.), fuel/octane (E85, E50, 91 octane, 93 octane), tech acronyms (CANbus, OBDII, DME, ECU, AFR, WMI, MAF, MAP, TMAP, OEM, CNC, AN, NPT, GPM, PSI, HP, WHP, TQ, WTQ).
3. USE PROFESSIONAL UKRAINIAN AUTOMOTIVE TERMINOLOGY:
   - "boost" → "наддув"
   - "horsepower" / "hp" / "whp" → keep "к.с." or "WHP" if abbreviation
   - "torque" / "wtq" → "крутний момент"
   - "tuning" → "тюнінг" (NOT "налаштування" alone)
   - "tuner" → "тюнер" or "чіп-тюнер" (context-dependent)
   - "ECU reflash" → "перепрошивка ECU"
   - "plug and play" → "plug & play" (keep) or "підключи і працюй"
   - "fitment" → "сумісність"
   - "warranty" → "гарантія"
   - "Made in USA" → "Виробництво США"
   - "billet" → "цілофрезерований" or "billet" (keep if technical)
   - "intake" → "впуск" (or "впускний колектор" for manifold)
   - "spacers" → "проставки"
   - "downpipe" → "downpipe" (keep)
   - "charge pipe" → "charge pipe" (keep)
   - "intercooler" → "інтеркулер"
   - "wheel spacer" → "колісна проставка"
   - "lug bolts" → "колісні болти"
   - "bushings" → "втулки"
   - "blow-off valve" / "BOV" → "BOV" (keep)
   - "flex fuel" → "flex fuel" or "адаптивне паливо"
   - "wastegate" → "wastegate" (keep)
   - "manifold" → "колектор"
   - "billet aluminum" → "цілофрезерований алюміній"
   - "anodized" → "анодований"
   - "factory" → "заводський" or "штатний"
   - "stock" → "стоковий"
   - "tune" → "тюнінг" or "прошивка" (context)
4. DO NOT INVENT facts or specs. Translate what's given. Preserve numbers, units, and percentages exactly.
5. KEEP capitalization style of original (e.g. headings stay capitalized).
6. For bullet-list-like sentences glued together, KEEP them glued — do not fabricate bullets.
7. Output ONLY raw JSON in the exact schema below. No markdown blocks, no \`\`\`json, no explanations.`;

const userPromptFor = (titleEn, bodyHtmlEn) => `Translate the following Burger Motorsports product to Ukrainian, following ALL rules from the system prompt.

EN TITLE:
${titleEn}

EN DESCRIPTION:
${bodyHtmlEn || '(empty)'}

Return JSON in this exact schema (no extra keys, no markdown):
{
  "titleUa": "...",
  "bodyHtmlUa": "..."
}`;

// ── Post-process: enforce verbatim-keep terms ──
function enforceVerbatim(uaText) {
  if (!uaText) return uaText;
  let t = uaText;

  // Reverse common Cyrillic→Latin transliteration patterns where Gemini might
  // accidentally Cyrillicize a brand name even with explicit instructions.
  const fixes = [
    [/Бургер\s+Моторспортс?/gi, 'Burger Motorsports'],
    [/Б[іi]-?\s?Е?м-?\s?Е?с\b/gi, 'BMS'],
    [/Бі-?Ем-?Ес\b/gi, 'BMS'],
    [/ДжейБі\s?4\b/gi, 'JB4'],
    [/Джей[-\s]?Бі\s?4\b/gi, 'JB4'],
    [/ДжейБі\s?\+/gi, 'JB+'],
    [/ДжейБі\s?ПРО\b/gi, 'JB4PRO'],
    [/Ф'?юел-?\s?[Іi]т!?/gi, 'Fuel-It!'],
    [/Паливо-?Це!?/gi, 'Fuel-It!'],
    [/Драгі\b/gi, 'Dragy'],
    [/Уолбро\b/gi, 'Walbro'],
    [/Босх\b/gi, 'Bosch'],
    [/Бі[ -]?ЕмВі\b/gi, 'BMW'],
    [/Ауді\b/gi, 'Audi'],
    [/Тойота\b/gi, 'Toyota'],
    [/Мерседес\b/gi, 'Mercedes'],
    [/Порше\b/gi, 'Porsche'],
    [/Форд\b/gi, 'Ford'],
    [/Мустанг\b/gi, 'Mustang'],
    [/Ягуар\b/gi, 'Jaguar'],
    [/Хонда\b/gi, 'Honda'],
    [/Ніссан\b/gi, 'Nissan'],
    [/Інфініті\b/gi, 'Infiniti'],
    [/Лексус\b/gi, 'Lexus'],
    [/Шевроле\b/gi, 'Chevrolet'],
    [/Шеві\b/gi, 'Chevy'],
    [/Кадилак\b/gi, 'Cadillac'],
    [/Доджа?\b/gi, 'Dodge'],
    [/Джип\b/gi, 'Jeep'],
    [/Рейндж[-\s]?Ровер/gi, 'Range Rover'],
    [/Астон[-\s]?Мартін/gi, 'Aston Martin'],
    [/Хюндай|Хундай|Гюндай/gi, 'Hyundai'],
    [/Кіа\b/gi, 'Kia'],
    [/Дженезіс|Генезис/gi, 'Genesis'],
    [/Стінгер\b/gi, 'Stinger'],
    [/Супра\b/gi, 'Supra'],
    [/Тундра\b/gi, 'Tundra'],
    [/Секвоя\b/gi, 'Sequoia'],
    [/Такома\b/gi, 'Tacoma'],
    [/Бронко\b/gi, 'Bronco'],
    [/Раптор\b/gi, 'Raptor'],
    [/Ф-?150\b/gi, 'F-150'],
    [/Зроблено в США/gi, 'Виробництво США'],
    [/підключ(?:и|іть)\s+(?:та|і)\s+гра[йє]/gi, 'plug & play'],
    // Fix common "(пусто)" placeholder if Gemini echoed it
    [/^\(пусто\)$/m, ''],
  ];
  for (const [rx, repl] of fixes) t = t.replace(rx, repl);

  // Restore any chassis/engine codes if they got Cyrillicized
  // (Гемі could write G80 as "Г80" — fix that)
  t = t.replace(/\bГ(\d{2})\b/g, 'G$1');
  t = t.replace(/\bЕ(\d{2})\b/g, 'E$1');
  t = t.replace(/\bФ(\d{2})\b/g, 'F$1');
  t = t.replace(/\bБ(\d{2})\b/g, 'B$1');
  t = t.replace(/\bН(\d{2})\b/g, 'N$1');
  t = t.replace(/\bС(\d{2})\b/g, 'S$1'); // S58, S55 etc

  return t;
}

// ── Validate translation: critical phrases preserved ──
function validateTranslation(en, ua, isTitle = false) {
  if (!ua || !ua.trim()) return { ok: false, reason: 'empty translation' };

  // Check verbatim keeps that should appear in EN→UA
  const mustKeepIfPresent = ['JB4', 'BMS', 'BMW', 'S58', 'S55', 'B58', 'N54', 'N55', 'G80', 'F80', 'F87', 'G87', 'F97', 'F98', 'M3', 'M4', 'X3M', 'X4M'];
  const errs = [];
  for (const term of mustKeepIfPresent) {
    const enRx = new RegExp(`\\b${term}\\b`, 'i');
    if (enRx.test(en) && !ua.includes(term)) {
      errs.push(`missing "${term}" in UA`);
    }
  }

  // Cyrillic ratio check — only for body (titles often dominated by verbatim brand/chassis codes)
  if (!isTitle && en.length > 200) {
    const cyrillic = (ua.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || []).length;
    const latin = (ua.match(/[a-zA-Z]/g) || []).length;
    if (cyrillic < 20 || cyrillic < latin * 0.4) {
      errs.push(`insufficient Cyrillic (${cyrillic} cyr vs ${latin} lat)`);
    }
  }

  return { ok: errs.length === 0, errs };
}

// ── Extract JSON from Gemini response (strip optional markdown fences) ──
function extractJson(rawText) {
  let t = rawText.trim();
  // Strip ```json ... ``` or ``` ... ```
  t = t.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return JSON.parse(t);
}

async function geminiGenerate(prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });
    return resp.response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function translateOne(p, attempt = 1) {
  const titleEn = (p.titleEn || '').trim();
  const bodyHtmlEn = (p.bodyHtmlEn || '').trim();
  if (!titleEn && !bodyHtmlEn) return { skipped: 'empty source' };

  try {
    const prompt = SYSTEM_PROMPT + '\n\n' + userPromptFor(titleEn, bodyHtmlEn);
    const raw = await geminiGenerate(prompt);
    let parsed;
    try {
      parsed = extractJson(raw);
    } catch (parseErr) {
      throw new Error(`JSON parse failed: ${parseErr.message}; raw head: ${raw.slice(0, 200)}`);
    }

    let titleUa = enforceVerbatim((parsed.titleUa || '').trim());
    let bodyHtmlUa = enforceVerbatim((parsed.bodyHtmlUa || '').trim());

    const titleVal = validateTranslation(titleEn, titleUa, true);
    const bodyVal = bodyHtmlEn ? validateTranslation(bodyHtmlEn, bodyHtmlUa, false) : { ok: true, errs: [] };

    if (!titleVal.ok || !bodyVal.ok) {
      const errs = [...(titleVal.errs || []), ...(bodyVal.errs || [])];
      if (attempt < 2) {
        // One soft retry with a hint added to prompt — but for now just retry as-is
        return translateOne(p, attempt + 1);
      }
      return { ok: true, titleUa, bodyHtmlUa, warnings: errs };
    }

    return { ok: true, titleUa, bodyHtmlUa, warnings: [] };
  } catch (err) {
    const msg = err.message || String(err);
    const is429 = msg.includes('429') || /rate.?limit/i.test(msg);
    const is5xx = /5\d\d/.test(msg);
    if (attempt < 4 && (is429 || is5xx || /timed?\s?out|abort/i.test(msg))) {
      const wait = is429 ? 15000 * attempt : 3000 * attempt;
      console.warn(`  ⚠ ${p.slug}: ${msg.slice(0, 100)} — retry ${attempt + 1} in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      return translateOne(p, attempt + 1);
    }
    return { error: msg };
  }
}

async function main() {
  console.log('🍔🇺🇦 Burger Motorsports — Gemini Translator');
  console.log(`   Model: ${MODEL_NAME} | Concurrency: ${CONCURRENCY} | Limit: ${LIMIT || 'all'} | Slug: ${SLUG || 'any'} | Key tail: ...${apiKey.slice(-6)}`);
  console.log('='.repeat(70));

  const where = { brand: 'Burger Motorsports' };
  if (SLUG) where.slug = SLUG;

  const all = await prisma.shopProduct.findMany({
    where,
    select: { id: true, slug: true, titleEn: true, titleUa: true, bodyHtmlEn: true, bodyHtmlUa: true },
    orderBy: { priceUsd: 'desc' },
  });

  // Skip already-translated unless --slug or --dry-run
  const toProcess = all.filter((p) => {
    if (SLUG) return true;
    const sameTitle = (p.titleEn || '').trim() === (p.titleUa || '').trim();
    const emptyBody = !(p.bodyHtmlUa || '').trim();
    return sameTitle || emptyBody;
  });

  const queue = LIMIT > 0 ? toProcess.slice(0, LIMIT) : toProcess;
  console.log(`Total Burger products: ${all.length} | needing translation: ${toProcess.length} | this run: ${queue.length}\n`);

  if (queue.length === 0) {
    console.log('✓ Nothing to translate.');
    return;
  }

  const limit = pLimit(CONCURRENCY);
  let done = 0, ok = 0, withWarnings = 0, errors = 0;
  const errList = [];

  await Promise.all(
    queue.map((p, i) =>
      limit(async () => {
        const r = await translateOne(p);
        done++;
        if (r.error) {
          errors++;
          errList.push(`${p.slug}: ${r.error.slice(0, 200)}`);
        } else if (r.ok) {
          if (r.warnings && r.warnings.length > 0) {
            withWarnings++;
            console.log(`⚠ ${p.slug}: ${r.warnings.join('; ')}`);
          }
          if (!DRY_RUN) {
            await prisma.shopProduct.update({
              where: { id: p.id },
              data: { titleUa: r.titleUa, bodyHtmlUa: r.bodyHtmlUa },
            });
          } else {
            // Print sample for dry-run
            if (i < 3) {
              console.log(`\n--- DRY-RUN sample [${i + 1}] ${p.slug} ---`);
              console.log(`titleEn: ${p.titleEn?.slice(0, 80)}`);
              console.log(`titleUa: ${r.titleUa?.slice(0, 80)}`);
              console.log(`bodyHtmlEn (first 200): ${(p.bodyHtmlEn || '').slice(0, 200)}`);
              console.log(`bodyHtmlUa (first 400): ${(r.bodyHtmlUa || '').slice(0, 400)}`);
            }
          }
          ok++;
        }
        if (done % 5 === 0 || done === queue.length) {
          process.stdout.write(`\r  Progress: ${done}/${queue.length} (ok=${ok}, warn=${withWarnings}, err=${errors})  `);
        }
      })
    )
  );

  console.log(`\n\n=== Summary ===`);
  console.log(`Processed: ${done}, OK: ${ok}, With warnings: ${withWarnings}, Errors: ${errors}`);
  if (errList.length > 0) {
    console.log(`\nErrors (first 10):`);
    errList.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
