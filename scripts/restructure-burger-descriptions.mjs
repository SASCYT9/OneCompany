// Restructures Burger product descriptions:
// - Strips generic Q&A blocks ("What is JB4?", "Часто імітований...")
// - Strips contact info ("contact George at...", "more info on")
// - Strips empty/dangling references ("Демонстраційне відео")
// - Splits walls of text into <p> paragraphs at sentence boundaries
// - Auto-detects "Features and Benefits / Особливості та переваги / Vehicle Fitment / Сумісність" sections
//   and wraps them in <h3> + <ul><li>
// - Caps overall length to ~1500 chars (most products), keeping fitment list

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

// Patterns to STRIP entirely (whole paragraph/block)
const STRIP_BLOCKS_UA = [
  // Q&A about JB4 in general
  /Що таке JB4\?[\s\S]*?(?=Особливості|Сумісність|Часто|Чи є JB4|$)/gi,
  /Чи є JB4 справжнім тюнінгом\?[\s\S]*?(?=Демонстраційне|Особливості|Сумісність|Часто|$)/gi,
  /Часто імітований[^.]*\.[\s\S]*?світу\./gi,
  // Wireless connect / app marketing block (keep only first sentence)
  /Бездротове підключення до вашого JB4:[\s\S]*?проблеми з налаштуванням\./gi,
  // Promo / contact lines
  /З будь-яких питань щодо продажів[\s\S]*?(?=Що таке|Особливості|Сумісність|$)/gi,
  /Джордж є єдиним[^.]*\./gi,
  /[Бб]ільше інформації на[^.]*(?:\.|$)/gi,
  /Демонстраційне відео[^\n]*/gi,
  /JB4 Mobile\s*$/gi,
  // Bundle / save promotions
  /Замовте зараз[^.!?]*[.!?]?/gi,
  /Заощадь[^.!?]*[.!?]?/gi,
  /[Бб]езкоштовна доставка[^.!?]*[.!?]?/gi,
  // Trailing dangling refs
  /\s*Більше інформації на\s*$/gi,
];

const STRIP_BLOCKS_EN = [
  /What is JB4\?[\s\S]*?(?=Features|Vehicle Fitment|Often|Is JB4|$)/gi,
  /Is JB4 a real tune\?[\s\S]*?(?=Features|Demo Video|Vehicle Fitment|Often|$)/gi,
  /Often imitated[^.]*\.[\s\S]*?world\./gi,
  /Wirelessly Connect to your JB4:[\s\S]*?tuning concerns\./gi,
  /For any [^.]*VW\/Audi[^.]*\.[\s\S]*?VW\/Audi platform\./gi,
  /George is[^.]*\.[\s\S]*?platform\./gi,
  /more info on[^.]*\./gi,
  /Demo Video[^\n]*/gi,
  /JB4 Mobile\s*$/gi,
];

// Section heading patterns — wrap text following these in <h3>
const SECTION_HEADINGS = [
  // UA
  { rx: /\bОсобливості та переваги(?:\s+JB4)?:?/g, kind: 'features', label: { ua: 'Особливості та переваги', en: 'Features & Benefits' } },
  { rx: /\bСумісність(?:\s+з)?\s*автомобіл[а-я]+:?/g, kind: 'fitment', label: { ua: 'Сумісність з автомобілями', en: 'Vehicle Fitment' } },
  // EN
  { rx: /\bFeatures and Benefits(?:\s+JB4)?:?/g, kind: 'features', label: { ua: 'Особливості та переваги', en: 'Features & Benefits' } },
  { rx: /\bVehicle Fitment:?/g, kind: 'fitment', label: { ua: 'Сумісність з автомобілями', en: 'Vehicle Fitment' } },
];

function stripBlocks(text, isUa) {
  let t = text;
  const patterns = isUa ? STRIP_BLOCKS_UA : STRIP_BLOCKS_EN;
  for (const rx of patterns) t = t.replace(rx, '');
  // Collapse whitespace
  return t.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}

function structureDescription(rawText, locale) {
  if (!rawText || rawText.length < 50) return rawText;
  const isUa = locale === 'ua';

  // 1. Strip any HTML (we'll regenerate)
  let text = rawText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

  // 2. Strip blocks (Q&A, contacts, fluff)
  text = stripBlocks(text, isUa);

  // 3. Split by section headings
  const sections = []; // { kind, label, text }
  let remainingIntro = text;

  for (const sec of SECTION_HEADINGS) {
    const m = sec.rx.exec(text);
    if (m) {
      // Cut intro at first heading occurrence
      if (remainingIntro.length === text.length) {
        remainingIntro = text.slice(0, m.index).trim();
      }
      // Find next heading after this one
      const start = m.index + m[0].length;
      let end = text.length;
      for (const sec2 of SECTION_HEADINGS) {
        sec2.rx.lastIndex = start;
        const m2 = sec2.rx.exec(text);
        if (m2 && m2.index < end) end = m2.index;
      }
      const body = text.slice(start, end).trim();
      if (body) sections.push({ kind: sec.kind, label: sec.label[locale] || sec.label.en, body });
    }
  }

  // 4. Build HTML
  const parts = [];

  if (remainingIntro) {
    // Split intro into paragraphs at sentence boundaries (respecting ~250 char chunks)
    const sentences = remainingIntro.match(/[^.!?]+[.!?]+/g) || [remainingIntro];
    let currentPara = '';
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      if ((currentPara + ' ' + trimmed).length > 320 && currentPara) {
        parts.push(`<p>${escapeHtml(currentPara.trim())}</p>`);
        currentPara = trimmed;
      } else {
        currentPara = (currentPara + ' ' + trimmed).trim();
      }
    }
    if (currentPara) parts.push(`<p>${escapeHtml(currentPara.trim())}</p>`);
  }

  for (const sec of sections) {
    parts.push(`<h3>${escapeHtml(sec.label)}</h3>`);
    if (sec.kind === 'features' || sec.kind === 'fitment') {
      // Convert to bullet list. Detect items separated by sentences or newlines.
      const items = sec.body
        .split(/(?<=[.])\s+(?=[A-ZА-ЯІЇЄ\d])/)
        .map((s) => s.replace(/^[\s•\-–—*]+/, '').trim())
        .filter((s) => s.length > 3 && s.length < 250);
      if (items.length > 1) {
        parts.push('<ul>');
        for (const item of items) {
          parts.push(`  <li>${escapeHtml(item.replace(/[.]$/, ''))}</li>`);
        }
        parts.push('</ul>');
      } else {
        parts.push(`<p>${escapeHtml(sec.body)}</p>`);
      }
    } else {
      parts.push(`<p>${escapeHtml(sec.body)}</p>`);
    }
  }

  return parts.join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });
  console.log(`Processing ${products.length} burger products...`);

  let changedEn = 0, changedUa = 0;
  let removedEn = 0, removedUa = 0;

  for (const p of products) {
    if (p.bodyHtmlEn) {
      const before = p.bodyHtmlEn.length;
      const restructured = structureDescription(p.bodyHtmlEn, 'en');
      if (restructured && restructured !== p.bodyHtmlEn) {
        await prisma.shopProduct.update({
          where: { id: p.id },
          data: { bodyHtmlEn: restructured },
        });
        changedEn++;
        removedEn += before - restructured.length;
      }
    }
    if (p.bodyHtmlUa) {
      const before = p.bodyHtmlUa.length;
      const restructured = structureDescription(p.bodyHtmlUa, 'ua');
      if (restructured && restructured !== p.bodyHtmlUa) {
        await prisma.shopProduct.update({
          where: { id: p.id },
          data: { bodyHtmlUa: restructured },
        });
        changedUa++;
        removedUa += before - restructured.length;
      }
    }
    if ((changedEn + changedUa) % 50 === 0) {
      process.stdout.write(`\r  Processed: ${changedEn} EN + ${changedUa} UA`);
    }
  }
  console.log(`\n\n=== DONE ===`);
  console.log(`EN changed: ${changedEn}, removed ${removedEn.toLocaleString()} chars`);
  console.log(`UA changed: ${changedUa}, removed ${removedUa.toLocaleString()} chars`);

  // Show one sample
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', bodyHtmlUa: { contains: '<h3>' } },
    select: { titleUa: true, bodyHtmlUa: true },
  });
  if (sample) {
    console.log('\n--- SAMPLE UA ---');
    console.log(sample.titleUa);
    console.log(sample.bodyHtmlUa.slice(0, 1500));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
