// Final polish pass for Burger UA descriptions:
// - Removes "с." abbreviation artifacts at sentence start
// - Bulletizes long feature-list paragraphs (sentences glued together with no punctuation)
// - Caps total length to ~1200 chars
// - Final cleanup of empty tags

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

// Phrases that ALWAYS start a new bullet (feature-list joiner words in middle of run-on text)
const BULLET_TRIGGERS_UA = [
  'Покращує',
  'Попередньо завантажений',
  'Карти налаштування',
  'Можливість',
  'Перегляд',
  'Тиск наддуву',
  'Сумісний',
  'Швидке встановлення',
  'Інтеграція',
  'Покращена продуктивність',
  'Працює так само',
  'Витрата палива',
  'Для отримання',
  'Не прив',
  'Включає міцний',
  'Розроблено',
  'Plug',
  'Бездротове',
  'Інтуїтивно',
  '5-річна',
];
const BULLET_TRIGGERS_EN = [
  'Improves',
  'Pre-loaded',
  'Tuning maps',
  'Ability',
  'View',
  'Boost levels',
  'Compatible',
  'Quick',
  'CANbus',
  'Integration',
  'Improved performance',
  'Fuel economy',
  'For gains',
  'Not VIN',
  'Includes',
  'Designed',
];

function bulletizeLong(text, locale) {
  const triggers = locale === 'ua' ? BULLET_TRIGGERS_UA : BULLET_TRIGGERS_EN;
  // If text contains 3+ triggers, split at each trigger
  let count = 0;
  for (const t of triggers) {
    if (text.includes(t)) count++;
  }
  if (count < 3) return null;

  // Build regex with all triggers
  const pattern = new RegExp(`(?=\\b(?:${triggers.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b)`, 'g');
  const items = text.split(pattern).map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 280);
  if (items.length < 3) return null;
  return items;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripText(text) {
  return text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function cleanArtifacts(text) {
  return text
    // Remove standalone "с." or "к." that's clearly an abbrev artifact
    .replace(/(?<=[.!?]\s)[ск]\.\s+/g, '')
    .replace(/^[ск]\.\s+/g, '')
    // Remove leftover broken refs
    .replace(/\bMore info on\s*$/gi, '')
    .replace(/\bБільше інформації на\s*$/gi, '')
    // Collapse periods
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function polish(html, locale) {
  if (!html) return html;
  // For each <p>, attempt to bulletize if it's a long features-list run-on
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (match, content) => {
    let cleaned = cleanArtifacts(content);
    if (!cleaned) return '';
    // Try to bulletize
    const items = bulletizeLong(cleaned, locale);
    if (items) {
      const lis = items.map((i) => `  <li>${escapeHtml(i.replace(/[.]\s*$/, ''))}</li>`).join('\n');
      return `<ul>\n${lis}\n</ul>`;
    }
    return `<p>${escapeHtml(cleaned)}</p>`;
  });
}

function capLength(html, maxChars = 1500) {
  if (html.length <= maxChars) return html;
  // Find last </p> or </ul> before maxChars
  const upTo = html.slice(0, maxChars);
  const lastP = upTo.lastIndexOf('</p>');
  const lastUl = upTo.lastIndexOf('</ul>');
  const cut = Math.max(lastP, lastUl);
  if (cut > 0) return html.slice(0, cut + (cut === lastP ? '</p>'.length : '</ul>'.length));
  return upTo;
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, bodyHtmlEn: true, bodyHtmlUa: true },
  });

  let changedEn = 0, changedUa = 0;
  for (const p of products) {
    if (p.bodyHtmlEn) {
      const polished = capLength(polish(p.bodyHtmlEn, 'en'));
      if (polished !== p.bodyHtmlEn) {
        await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlEn: polished } });
        changedEn++;
      }
    }
    if (p.bodyHtmlUa) {
      const polished = capLength(polish(p.bodyHtmlUa, 'ua'));
      if (polished !== p.bodyHtmlUa) {
        await prisma.shopProduct.update({ where: { id: p.id }, data: { bodyHtmlUa: polished } });
        changedUa++;
      }
    }
    if ((changedEn + changedUa) % 100 === 0) {
      process.stdout.write(`\r  Polished: ${changedEn} EN + ${changedUa} UA`);
    }
  }
  console.log(`\nDONE: EN ${changedEn}, UA ${changedUa}`);

  // Sample
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', titleEn: { contains: 'Group 11' } },
    select: { titleUa: true, bodyHtmlUa: true },
  });
  if (sample) {
    console.log('\n--- Group 11 UA ---');
    console.log(sample.titleUa);
    console.log(sample.bodyHtmlUa);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
