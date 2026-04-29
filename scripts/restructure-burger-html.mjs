/**
 * Burger Motorsports — restructure UA + EN bodies into clean readable HTML.
 *
 * Splits flat translated text into:
 *   - Lead paragraphs (intro before first section heading) — chunked into
 *     <p> blocks of 2-3 sentences each. NOT truncated.
 *   - <h3>Особливості</h3> + <ul><li>… for the feature/benefits section.
 *   - <h3>Сумісність</h3> + <ul><li>… for the vehicle fitment section.
 *     Splits on bullet markers like "BMW M2•" / "• 2023+" / "Toyota Supra•".
 *   - <h3>Комплектація</h3> + <ul><li>… for what's-included section.
 *
 * Idempotent. Run with --dry-run first to preview.
 *
 * Usage:
 *   node scripts/restructure-burger-html.mjs --dry-run --slug burger-...
 *   node scripts/restructure-burger-html.mjs --dry-run --limit 5
 *   node scripts/restructure-burger-html.mjs                # apply to all
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (name, dflt = null) => {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : dflt;
};
const SLUG = getArg('--slug', null);
const LIMIT = parseInt(getArg('--limit', '0'), 10) || 0;
const DRY_RUN = args.includes('--dry-run');
const SAMPLES = parseInt(getArg('--samples', '3'), 10) || 3;

// ── Section heading patterns (UA + EN, case-insensitive) ──
// We look for the heading TEXT and split there. The heading itself is removed
// from the section body (we add a clean <h3>Label</h3> instead).
//
// Be CONSERVATIVE — these patterns must match section HEADINGS only, not
// the same words appearing inline elsewhere.
const SECTION_PATTERNS = [
  {
    kind: 'features',
    label: { ua: 'Особливості та переваги', en: 'Features & Benefits' },
    // UA: "S58 JB4 Особливості & Переваги" / "Особливості та переваги" headings.
    // EN: "Features & Benefits" / "Features and Benefits" / "S58 JB4 Features & Benefits".
    // Skip plain "Features" (too common inline).
    rx: /(?:S\d{2}\s+)?JB4\s+(?:Особливост[іи]|Функції)(?:\s+(?:та|й|&)\s+Переваг[иі])?|(?:Особливост[іи]|Функції)\s+(?:та|й|&)\s+Переваг[иі]|(?:S\d{2}\s+)?JB4\s+Features?\s+(?:and|&|\+)\s+Benefits?|Features?\s+(?:and|&|\+)\s+Benefits?|Key Features|Технічні характеристики/i,
  },
  {
    kind: 'fitment',
    label: { ua: 'Сумісність', en: 'Vehicle Fitment' },
    // UA/EN: must be a real heading. "Compatible with" alone matches "compatible
    // with all driving modes" (a feature) — restrict to "Compatible vehicles".
    rx: /(?:S\d{2}\s+)?JB4\s+Сумісність(?:\s+(?:з|із)\s*автомобіл[а-яї]+)?|Сумісність\s+(?:з|із)\s*автомобіл[а-яї]+|Підтримув[а-яї]+\s+автомобіл[а-яї]+|(?:S\d{2}\s+)?JB4\s+Vehicle\s+Fitment|Vehicle\s+Fitment|Compatible\s+vehicles?/i,
  },
  {
    kind: 'included',
    label: { ua: 'Комплектація', en: "What's Included" },
    // EN: only match true "What's Included"/"Package Contents"/"In the Box" headings.
    // "Includes" alone has too many false positives in lead/feature text.
    rx: /[Уу]\s+комплекті|[Вв]\s+комплекті|Що\s+(?:в\s+комплекті|входить)|Комплектація|What'?s\s+Included|Package\s+Contents|In\s+the\s+Box/i,
  },
];

// Sentence splitter that preserves decimals + abbrevs
const DOT_PH = '«D»';
function protectDots(s) {
  return s
    .replace(/(\d)\.(\d)/g, `$1${DOT_PH}$2`)
    .replace(/\b(к\.с|т\.д|т\.п|i\.e|e\.g|U\.S|Mr|Mrs|Inc|No|vs|Dr|St)\./gi, `$1${DOT_PH}`);
}
function unprotectDots(s) {
  return s.replace(new RegExp(DOT_PH, 'g'), '.');
}
function splitSentences(text) {
  const protected_ = protectDots(text);
  const parts = protected_.split(/(?<=[.!?])\s+(?=[A-ZА-ЯІЇЄҐ0-9])|\n{2,}/);
  return parts.map(unprotectDots).map((s) => s.trim()).filter(Boolean);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isUkrainianSentence(text) {
  const cyr = (text.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || []).length;
  const lat = (text.match(/[a-zA-Z]/g) || []).length;
  if (text.length < 10) return true; // too short to judge
  return cyr >= lat * 0.3; // tolerate verbatim brand+chassis (mostly latin) inside UA sentences
}

// Strip HTML and decode common entities
function toPlainText(html) {
  return html
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|br|strong|em|span|i|b|a)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;bull;|&bull;|&#8226;/g, '•')
    .replace(/&amp;middot;|&middot;|&#183;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse text into { intro, sections: [{kind, body}, ...] }
function parseSections(text) {
  // Find earliest match for each pattern
  const found = SECTION_PATTERNS.map((p) => {
    const m = text.match(p.rx);
    return m ? { kind: p.kind, label: p.label, idx: m.index, len: m[0].length } : null;
  })
    .filter(Boolean)
    .sort((a, b) => a.idx - b.idx);

  if (found.length === 0) return { intro: text, sections: [] };

  const intro = text.slice(0, found[0].idx).trim();
  const sections = [];
  for (let i = 0; i < found.length; i++) {
    const start = found[i].idx + found[i].len;
    const end = i + 1 < found.length ? found[i + 1].idx : text.length;
    const body = text.slice(start, end).trim();
    sections.push({ kind: found[i].kind, label: found[i].label, body });
  }
  return { intro, sections };
}

// Junk sentences left over from upstream cleanup that should be dropped.
const JUNK_SENTENCE_RX = [
  /^Доступно тут\.?$/i,
  /^Available(?:\s+here)?\.?$/i,
  /^Click(?:\s+here)?\.?$/i,
  /^See\s+below\.?$/i,
  /^Сumлок\s+здесь\.?$/i,
];

// Group sentences into <p> paragraphs of 2-3 sentences each
function paragraphsFromIntro(intro, locale) {
  let sentences = splitSentences(intro);
  if (locale === 'ua') sentences = sentences.filter(isUkrainianSentence);
  // Drop junk sentences
  sentences = sentences.filter((s) => !JUNK_SENTENCE_RX.some((rx) => rx.test(s.trim())));
  if (sentences.length === 0) return '';
  const paras = [];
  let current = [];
  for (const s of sentences) {
    current.push(s);
    if (current.length >= 2 && current.join(' ').length > 200) {
      paras.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) paras.push(current.join(' '));
  return paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
}

// Split fitment-section body into per-vehicle bullets.
// Source format examples (after HTML strip + entity decode):
//   "BMW M2• 2023+ S58 G87 BMW M2 BMW M3• 2021-2026 S58 G80 BMW M3 ..."
//   "• 2023+ S58 G87 BMW M2"
// Strategy: split on •, strip each, filter very short items.
function splitFitmentBullets(body) {
  return body
    .split(/[•·]/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 4 && s.length < 200);
}

// Feature-list trigger words — Cyrillic/Latin words that start a feature bullet.
// Only words that GUARANTEED start a new feature item (no inline-occurrences in
// other features). Avoid technical terms (CANbus, OBDII, PNP, Plug) — they
// appear inside features, causing false splits.
const FEATURE_TRIGGERS_UA = [
  'Приріст', 'Покращує', 'Покращена', 'Попередньо', 'Карти',
  'Здатність', 'Можливість', 'Перегляд', 'Перегляньте',
  'Сумісний', 'Сумісно',
  'Швидка', 'Швидке', 'Інтеграція', 'Працює',
  'Економія', 'Не прив', 'Не VIN',
  'Розроблено', 'Розроблений', 'Зібрано', 'Виробництво',
  '5 років', '5-річна', 'Гарантія',
  'Включає', 'Включений',
  'Запис', 'Записує', 'Зчитує', 'Видаляє',
  'Бездротово', 'Bездротово',
  'Пропонує', 'Допомагає', 'Дозволяє',
  'Наддув за передачами',
  'Паливо 91', 'Паливо 93',
];
const FEATURE_TRIGGERS_EN = [
  'Gains', 'Improves', 'Improved', 'Pre-?loaded', 'Tuning maps',
  'Ethanol', 'Ability', 'Able to', 'View', 'Boost by',
  'Compatible', 'Compatibility', 'Quick', 'Integration',
  'Runs', 'Fuel economy', 'Not VIN', 'Designed', 'Made in',
  '5 ?year', '5-?year', 'Wireless',
  'Records?', 'Reads?', 'Deletes?', 'Offers',
];

function bulletizeRunOnFeatures(body, locale) {
  const triggers = locale === 'ua' ? FEATURE_TRIGGERS_UA : FEATURE_TRIGGERS_EN;
  // Sort triggers by length desc to prefer longer match (e.g. "Не прив" before "Не")
  const sorted = [...triggers].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // JS \b is ASCII-only — doesn't fire on Cyrillic. Use explicit
  // negative lookbehind for any letter (Cyrillic or Latin) to ensure
  // we're at the start of a word.
  const LETTER = '[а-яіїєґА-ЯІЇЄҐa-zA-Z]';
  const pattern = new RegExp(`(?<!${LETTER})(?=(?:${escaped.join('|')})(?!${LETTER}))`, 'g');
  const parts = body.split(pattern).map((s) => s.trim()).filter(Boolean);
  return parts;
}

// Split feature/included body into bullets.
function splitFeatureBullets(body, locale) {
  // Try splitting on bullet markers first
  if (/[•·]/.test(body)) {
    return body
      .split(/[•·]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 4);
  }

  // Try sentence-based split
  const sentences = splitSentences(body);
  let items = sentences;
  if (locale === 'ua') items = items.filter(isUkrainianSentence);

  // If sentence split produced 1-2 huge items (run-on text), use trigger-word split
  if (items.length <= 2 && body.length > 400) {
    const bulletized = bulletizeRunOnFeatures(body, locale);
    if (bulletized.length >= 3) items = bulletized;
  }

  return items
    .map((s) => s.replace(/^[\s\-–—*•]+/, '').trim())
    .filter((s) => s.length > 4);
}

function buildSectionHtml(section, locale) {
  const label = section.label[locale] || section.label.en;
  let items;
  if (section.kind === 'fitment') {
    items = splitFitmentBullets(section.body);
  } else {
    items = splitFeatureBullets(section.body, locale);
  }
  items = items
    .map((s) => s.replace(/[.,:;]+$/, '').trim())
    .filter((s) => s.length > 4 && s.length < 320)
    .slice(0, 40);
  if (items.length === 0) return '';
  if (items.length === 1) {
    return `<h3>${escapeHtml(label)}</h3>\n<p>${escapeHtml(items[0])}</p>`;
  }
  const lis = items.map((i) => `  <li>${escapeHtml(i)}</li>`).join('\n');
  return `<h3>${escapeHtml(label)}</h3>\n<ul>\n${lis}\n</ul>`;
}

function restructure(htmlOrText, locale) {
  if (!htmlOrText || htmlOrText.length < 60) return htmlOrText;
  const text = toPlainText(htmlOrText);
  const { intro, sections } = parseSections(text);
  const parts = [];
  const introHtml = paragraphsFromIntro(intro, locale);
  if (introHtml) parts.push(introHtml);
  for (const s of sections) {
    // Skip features section — it duplicates content already in the intro
    // paragraphs and bloats the visible description. (User-requested.)
    if (s.kind === 'features') continue;
    const h = buildSectionHtml(s, locale);
    if (h) parts.push(h);
  }
  return parts.join('\n');
}

async function main() {
  console.log(`📐 Burger restructure ${DRY_RUN ? '(DRY RUN)' : '(WRITING)'}`);
  console.log('='.repeat(60));

  const where = { brand: 'Burger Motorsports' };
  if (SLUG) where.slug = SLUG;

  const products = await prisma.shopProduct.findMany({
    where,
    select: { id: true, slug: true, titleEn: true, bodyHtmlEn: true, bodyHtmlUa: true },
    orderBy: { priceUsd: 'desc' },
  });
  const queue = LIMIT > 0 ? products.slice(0, LIMIT) : products;
  console.log(`Total: ${products.length} | this run: ${queue.length}`);

  let changedEn = 0;
  let changedUa = 0;
  const samples = [];

  for (const p of queue) {
    const newEn = restructure(p.bodyHtmlEn || '', 'en');
    const newUa = restructure(p.bodyHtmlUa || '', 'ua');
    let diffEn = newEn !== p.bodyHtmlEn && newEn.length > 30;
    let diffUa = newUa !== p.bodyHtmlUa && newUa.length > 30;
    if (samples.length < SAMPLES && (diffEn || diffUa)) {
      samples.push({
        slug: p.slug,
        title: p.titleEn,
        beforeEn: p.bodyHtmlEn,
        afterEn: newEn,
        beforeUa: p.bodyHtmlUa,
        afterUa: newUa,
      });
    }
    if (!DRY_RUN) {
      const data = {};
      if (diffEn) data.bodyHtmlEn = newEn;
      if (diffUa) data.bodyHtmlUa = newUa;
      if (Object.keys(data).length > 0) {
        await prisma.shopProduct.update({ where: { id: p.id }, data });
      }
    }
    if (diffEn) changedEn++;
    if (diffUa) changedUa++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Changed EN: ${changedEn}, Changed UA: ${changedUa}`);

  for (const s of samples) {
    console.log(`\n--- ${s.slug} ---`);
    console.log(`title: ${s.title?.slice(0, 80)}`);
    console.log(`\nUA BEFORE [${s.beforeUa?.length || 0}c]:`);
    console.log(s.beforeUa?.slice(0, 600) + '…');
    console.log(`\nUA AFTER [${s.afterUa?.length || 0}c]:`);
    console.log(s.afterUa);
  }
}

const invokedDirectly = process.argv[1]?.endsWith('restructure-burger-html.mjs');
if (invokedDirectly) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
