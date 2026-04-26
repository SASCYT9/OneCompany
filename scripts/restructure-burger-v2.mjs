// Smarter restructure of Burger product descriptions:
// - Protects abbreviations (к.с., 1/4 milі, E85, U.S.A., etc.)
// - Splits into intro / features / fitment sections by keyword detection
// - Renders features+fitment as <ul><li>
// - Caps intro at 2-3 paragraphs

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

// Section heading variants — case-insensitive
const FEATURES_RX = /(?:Особливості(?:\s+та\s+переваги)?(?:\s+JB4)?|Особливості й переваги|Переваги|Features?(?:\s+(?:and|&|\+)\s+Benefits)?|Key features|Specifications)\s*:?/i;
const FITMENT_RX = /(?:Сумісність(?:\s+(?:з|із)\s*автомобіл[а-я]+)?|Сумісні\s+автомобіл[а-я]+|Підтримувані\s+автомобіл[а-я]+|Vehicle\s+Fitment|Compatible\s+(?:vehicles?|with)|Fitment|Підтримує)\s*:?/i;
const INCLUDED_RX = /(?:[Уу]\s+комплекті|[Вв]\s+комплекті|Що\s+(?:в\s+комплекті|входить)|Комплектація|What'?s\s+included|Includes?|Package\s+contents|Kit\s+contents)\s*:?/i;

// Strip these phrases entirely
const STRIP_PHRASES = [
  /\bMore info on\b[^.]*\./gi,
  /\b[Бб]ільше інформації на\b[^.]*\./gi,
  /\bDemo Video\b[^.\n]*/gi,
  /\bДемонстраційне відео\b[^.\n]*/gi,
  /\bJB4 Mobile\s*$/gi,
  /Replaces OEM (?:BMW )?Part #\s?[A-Z0-9]+/gi,
  /Замінює OEM[^.]*\./gi,
  // Q&A blocks
  /What is JB4\?[\s\S]*?(?=Features|Vehicle Fitment|Specifications|Often imitated|$)/gi,
  /Що таке JB4\?[\s\S]*?(?=Особливості|Сумісність|Часто|$)/gi,
  /Is JB4 a real tune\?[\s\S]*?(?=Features|Demo|Vehicle Fitment|$)/gi,
  /Чи є JB4 справжнім тюнінгом\?[\s\S]*?(?=Особливості|Демонстраційне|Сумісність|$)/gi,
  /Often imitated[^.]*\.[\s\S]*?world\./gi,
  /Часто імітований[^.]*\.[\s\S]*?світу\./gi,
  // Wireless connect block
  /Wirelessly Connect to your JB4:[\s\S]*?tuning concerns\./gi,
  /Бездротове підключення до вашого JB4:[\s\S]*?проблеми з налаштуванням\./gi,
  // Sales/contact info
  /For any (?:sales|VW\/Audi)[^.]*\.[\s\S]*?platform\./gi,
  /З будь-яких питань щодо продажів[\s\S]*?платформ[ою]+ ?VW\/Audi[^.]*\./gi,
  /George is the only[^.]*\.[\s\S]*?platform\./gi,
  /Джордж є єдиним[^.]*\./gi,
];

function stripPhrases(text) {
  let t = text;
  for (const rx of STRIP_PHRASES) t = t.replace(rx, '');
  return t.replace(/\s+/g, ' ').trim();
}

// Protect abbreviations before sentence-splitting
const ABBREVIATIONS = [
  ['к.с.', '⟦HP_UA⟧'],
  ['к. с.', '⟦HP_UA⟧'],
  ['т.д.', '⟦TD⟧'],
  ['т.п.', '⟦TP⟧'],
  ['т.д', '⟦TDX⟧'],
  ['e.g.', '⟦EG⟧'],
  ['i.e.', '⟦IE⟧'],
  ['vs.', '⟦VS⟧'],
  ['U.S.A.', '⟦USA⟧'],
  ['U.S.', '⟦US⟧'],
  ['Mr.', '⟦MR⟧'],
  ['No.', '⟦NO⟧'],
  ['Inc.', '⟦INC⟧'],
];

function protectAbbreviations(text) {
  let t = text;
  for (const [from, to] of ABBREVIATIONS) {
    t = t.split(from).join(to);
  }
  return t;
}
function unprotectAbbreviations(text) {
  let t = text;
  for (const [from, to] of ABBREVIATIONS) {
    t = t.split(to).join(from);
  }
  return t;
}

function splitSentences(text) {
  const protectedText = protectAbbreviations(text);
  // Split on . ! ? followed by space + uppercase/digit
  const parts = protectedText.split(/(?<=[.!?])\s+(?=[A-ZА-ЯІЇЄҐ\d])/g);
  return parts.map(unprotectAbbreviations).map((s) => s.trim()).filter(Boolean);
}

function isUkrainianSentence(text) {
  const cyrillic = (text.match(/[а-яіїєґА-ЯІЇЄҐ]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return cyrillic > latin || (cyrillic > 0 && latin <= 5);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Parse a stripped/clean plain-text body into sections
function parseSections(plainText, locale) {
  const isUa = locale === 'ua';

  // Find positions of section headings
  const findFirst = (rx) => {
    const m = plainText.match(rx);
    return m ? plainText.indexOf(m[0]) : -1;
  };

  const featuresIdx = findFirst(FEATURES_RX);
  const fitmentIdx = findFirst(FITMENT_RX);
  const includedIdx = findFirst(INCLUDED_RX);

  // Boundaries: pick all >0 indices in order
  const bounds = [
    { idx: featuresIdx, kind: 'features' },
    { idx: fitmentIdx, kind: 'fitment' },
    { idx: includedIdx, kind: 'included' },
  ].filter((b) => b.idx > 0).sort((a, b) => a.idx - b.idx);

  let intro = '';
  const sections = [];

  if (bounds.length === 0) {
    intro = plainText;
  } else {
    intro = plainText.slice(0, bounds[0].idx).trim();
    for (let i = 0; i < bounds.length; i++) {
      const start = bounds[i].idx;
      const end = i + 1 < bounds.length ? bounds[i + 1].idx : plainText.length;
      const slice = plainText.slice(start, end);
      // Strip the heading itself
      const headingMatch = bounds[i].kind === 'features' ? slice.match(FEATURES_RX)
                       : bounds[i].kind === 'fitment' ? slice.match(FITMENT_RX)
                       : slice.match(INCLUDED_RX);
      const body = headingMatch ? slice.slice(headingMatch[0].length).trim() : slice.trim();
      sections.push({ kind: bounds[i].kind, body });
    }
  }

  return { intro, sections };
}

const SECTION_LABELS = {
  features: { ua: 'Особливості', en: 'Features' },
  fitment: { ua: 'Сумісність', en: 'Vehicle Fitment' },
  included: { ua: 'Комплектація', en: 'In the Box' },
};

function buildHtml({ intro, sections }, locale) {
  const isUa = locale === 'ua';
  const parts = [];

  // Intro: split into ≤2 paragraphs of natural sentences, max 4 sentences total
  if (intro) {
    let sentences = splitSentences(intro);
    if (locale === 'ua') sentences = sentences.filter(isUkrainianSentence);
    sentences = sentences.slice(0, 4);
    if (sentences.length) {
      const half = Math.ceil(sentences.length / 2);
      const para1 = sentences.slice(0, half).join(' ');
      const para2 = sentences.slice(half).join(' ');
      if (para1) parts.push(`<p>${escapeHtml(para1)}</p>`);
      if (para2) parts.push(`<p>${escapeHtml(para2)}</p>`);
    }
  }

  for (const sec of sections) {
    const label = SECTION_LABELS[sec.kind][locale] || SECTION_LABELS[sec.kind].en;
    let body = sec.body;
    // Filter EN sentences from UA
    let items = splitSentences(body);
    if (locale === 'ua') items = items.filter(isUkrainianSentence);
    items = items
      .map((s) => s.replace(/^[\s•\-–—*]+/, '').trim())
      .filter((s) => s.length > 4 && s.length < 280);

    if (items.length === 0) continue;
    parts.push(`<h3>${escapeHtml(label)}</h3>`);
    if (items.length === 1) {
      parts.push(`<p>${escapeHtml(items[0])}</p>`);
    } else {
      parts.push('<ul>');
      for (const item of items.slice(0, 25)) {
        parts.push(`  <li>${escapeHtml(item.replace(/[.]$/, ''))}</li>`);
      }
      parts.push('</ul>');
    }
  }

  return parts.join('\n');
}

function restructure(htmlOrText, locale) {
  if (!htmlOrText || htmlOrText.length < 50) return htmlOrText;

  // Strip HTML, get plain text
  let text = htmlOrText
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|br|strong|em|span)[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  text = stripPhrases(text);
  const parsed = parseSections(text, locale);
  return buildHtml(parsed, locale);
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} burger products...`);

  let changedEn = 0, changedUa = 0;

  for (const p of products) {
    if (p.bodyHtmlEn) {
      const restructured = restructure(p.bodyHtmlEn, 'en');
      if (restructured && restructured !== p.bodyHtmlEn) {
        await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlEn: restructured } });
        changedEn++;
      }
    }
    if (p.bodyHtmlUa) {
      const restructured = restructure(p.bodyHtmlUa, 'ua');
      if (restructured && restructured !== p.bodyHtmlUa) {
        await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlUa: restructured } });
        changedUa++;
      }
    }
    if ((changedEn + changedUa) % 100 === 0) {
      process.stdout.write(`\r  Processed: ${changedEn} EN + ${changedUa} UA`);
    }
  }
  console.log(`\n=== DONE ===`);
  console.log(`EN changed: ${changedEn}, UA changed: ${changedUa}`);

  // Sample
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', titleEn: { contains: 'Group 11' } },
    select: { titleUa: true, bodyHtmlUa: true },
  });
  if (sample) {
    console.log('\n--- SAMPLE: Group 11 UA ---');
    console.log(sample.titleUa);
    console.log(sample.bodyHtmlUa);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
