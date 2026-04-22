#!/usr/bin/env node
/**
 * Backfill missing Urban Automotive content with deterministic factual copy.
 *
 * Why:
 * - Official House of Urban sync already filled imagery and a large part of EN content.
 * - A subset of Urban rows still has no EN/UA descriptions at all, mostly wheel SKUs and
 *   several legacy collection products without category labels.
 *
 * What this script does:
 * - infers missing Urban categories for legacy rows
 * - generates factual EN/UA fallback HTML for rows with empty descriptions
 * - derives short/long descriptions from the generated HTML
 *
 * The script only writes into rows that are still empty. Existing content is preserved.
 *
 * Usage:
 *   node scripts/backfill-urban-fallback-content.mjs --dry-run
 *   node scripts/backfill-urban-fallback-content.mjs --commit
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');

const CATEGORY_UA_MAP = new Map([
  ['Accessories', 'Аксесуари'],
  ['Additional Options', 'Додаткові опції'],
  ['Arches', 'Арки'],
  ['Bodykits', 'Обвіси'],
  ['Bundles', 'Комплекти'],
  ['Canard Packs', 'Комплекти канардів'],
  ['Covers', 'Накладки'],
  ['Decal and Lettering', 'Декор та літеринг'],
  ['Diffusers', 'Дифузори'],
  ['Door Inserts', 'Вставки дверей'],
  ['Electrics', 'Електрика'],
  ['Exhaust', 'Вихлоп'],
  ['Exhaust Systems', 'Вихлопні системи'],
  ['Exterior Styling', 'Зовнішній стайлінг'],
  ['Front Bumper Add-ons', 'Елементи переднього бампера'],
  ['Front Bumpers', 'Передні бампери'],
  ['Front Lips', 'Передні губи'],
  ['Grilles', 'Решітки'],
  ['Hoods', 'Капоти'],
  ['Interior', "Інтер'єр"],
  ['Interior Kit', "Інтер'єрний комплект"],
  ['Logos', 'Логотипи'],
  ['Mirror Caps', 'Накладки дзеркал'],
  ['Mudguards', 'Бризковики'],
  ['Number Plate Kits', 'Комплекти номерної рамки'],
  ['Rear Bumpers', 'Задні бампери'],
  ['Roof Lights', 'Дахові світлові модулі'],
  ['Roofs', 'Дахи'],
  ['Side Panels', 'Бокові панелі'],
  ['Side Skirts', 'Пороги'],
  ['Side Steps', 'Підніжки'],
  ['Sills', 'Пороги'],
  ['Spoilers', 'Спойлери'],
  ['Splitters', 'Спліттери'],
  ['Tailgates', 'Кришки багажника'],
  ['Tailgates trim', 'Оздоблення кришки багажника'],
  ['Tailpipes', 'Насадки вихлопу'],
  ['Trims', 'Оздоблення'],
  ['Vents', 'Вентиляційні елементи'],
  ['Wheel Arches', 'Колісні арки'],
  ['Wheels', 'Диски'],
  ['Wheels & Tyres', 'Диски та шини'],
  ['Widebody Kits', 'Widebody комплекти'],
]);

function normText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isBlank(value) {
  return !normText(value);
}

function stripHtml(value) {
  return normText(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function excerpt(text, max = 220) {
  const plain = stripHtml(text);
  if (!plain) return null;
  if (plain.length <= max) return plain;
  const sliced = plain.slice(0, max);
  const stop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('; '), sliced.lastIndexOf(', '));
  return `${(stop > 80 ? sliced.slice(0, stop) : sliced).trim()}…`;
}

function extractSize(text) {
  return String(text ?? '').match(/\b(19|20|21|22|23|24|25)"/)?.[0] || null;
}

function extractPcd(text) {
  return String(text ?? '').match(/\b\d+x\d+\b/i)?.[0]?.toUpperCase() || null;
}

function extractEt(text) {
  const match = String(text ?? '').match(/\bET\s?(-?\d+)\b/i);
  return match ? `ET${match[1]}` : null;
}

function extractVehicle(text) {
  const fromParens = String(text ?? '').match(/\(([^)]+)\)/)?.[1];
  if (fromParens) return normText(fromParens);
  const source = normText(text);
  if (/defender/i.test(source)) return source.match(/Defender[^,;]*/i)?.[0] || 'Land Rover Defender';
  if (/range rover sport/i.test(source)) return source.match(/Range Rover Sport[^,;]*/i)?.[0] || 'Range Rover Sport';
  if (/range rover/i.test(source)) return source.match(/Range Rover[^,;]*/i)?.[0] || 'Range Rover';
  if (/g-wagon|g-class/i.test(source)) return source.match(/(G-Wagon|G-Class)[^,;]*/i)?.[0] || 'Mercedes-Benz G-Class';
  if (/golf r/i.test(source)) return 'Volkswagen Golf R';
  if (/t6\.1|transporter/i.test(source)) return 'Volkswagen T6.1';
  if (/rsq8/i.test(source)) return 'Audi RSQ8';
  if (/q8/i.test(source)) return 'Audi Q8';
  if (/rs6/i.test(source)) return 'Audi RS6';
  if (/urus/i.test(source)) return 'Lamborghini Urus';
  if (/cullinan/i.test(source)) return 'Rolls-Royce Cullinan';
  return null;
}

function extractWheelCode(text) {
  const match = String(text ?? '').match(/\b(UC|WX|UV|UF|UCR|NDS)[ -]?(\dR?)(?!\d)\b/i);
  return match ? `${match[1].toUpperCase()}-${match[2].toUpperCase()}` : null;
}

function inferCategory(row) {
  if (row.categoryEn && CATEGORY_UA_MAP.has(row.categoryEn)) {
    return { categoryEn: row.categoryEn, categoryUa: CATEGORY_UA_MAP.get(row.categoryEn) };
  }

  const source = [row.slug, row.titleEn, row.titleUa].filter(Boolean).join(' ').toLowerCase();

  if (/aerokit|widetrack|bodykit|body kit/.test(source)) {
    return { categoryEn: 'Bodykits', categoryUa: 'Обвіси' };
  }
  if (/roof light|lightbar/.test(source)) {
    return { categoryEn: 'Roof Lights', categoryUa: 'Дахові світлові модулі' };
  }
  if (/wide arches|wheel arch|arch/.test(source)) {
    return { categoryEn: 'Wheel Arches', categoryUa: 'Колісні арки' };
  }
  if (/wheel|alloy|ucr|uc4|uv|wx|nds/.test(source)) {
    return { categoryEn: 'Wheels', categoryUa: 'Диски' };
  }
  if (/vent/.test(source)) {
    return { categoryEn: 'Vents', categoryUa: 'Вентиляційні елементи' };
  }
  if (/spoiler/.test(source)) {
    return { categoryEn: 'Spoilers', categoryUa: 'Спойлери' };
  }
  if (/tailpipe|exhaust/.test(source)) {
    return { categoryEn: 'Tailpipes', categoryUa: 'Насадки вихлопу' };
  }
  if (/side tube|side panel/.test(source)) {
    return { categoryEn: 'Side Panels', categoryUa: 'Бокові панелі' };
  }

  return {
    categoryEn: row.categoryEn || null,
    categoryUa: row.categoryUa || null,
  };
}

function makeWheelHtmlEn(row) {
  const title = normText(row.titleEn);
  const details = [
    extractWheelCode(title),
    extractSize(title),
    extractPcd(title),
    extractEt(title),
    extractVehicle(title) || row.collectionEn || null,
  ].filter(Boolean);

  return [
    `<p>Official Urban Automotive wheel specification.</p>`,
    `<p><strong>Configuration:</strong> ${title}.</p>`,
    details.length
      ? `<ul>${details.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '',
    `<p>Please select the required finish, vehicle fitment and PCD configuration according to the official Urban catalogue.</p>`,
  ]
    .filter(Boolean)
    .join('');
}

function makeWheelHtmlUa(row) {
  const title = normText(row.titleUa || row.titleEn);
  const details = [
    extractWheelCode(row.titleEn || title),
    extractSize(row.titleEn || title),
    extractPcd(row.titleEn || title),
    extractEt(row.titleEn || title),
    row.collectionUa || extractVehicle(row.titleEn || title) || row.collectionEn || null,
  ].filter(Boolean);

  return [
    `<p>Офіційна конфігурація диска Urban Automotive.</p>`,
    `<p><strong>Специфікація:</strong> ${title}.</p>`,
    details.length
      ? `<ul>${details.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '',
    `<p>Колір, посадка під авто та PCD обираються згідно з офіційним каталогом Urban.</p>`,
  ]
    .filter(Boolean)
    .join('');
}

function makeGenericHtmlEn(row, inferred) {
  const title = normText(row.titleEn);
  const points = [
    row.collectionEn ? `Vehicle / collection: ${row.collectionEn}` : null,
    inferred.categoryEn ? `Category: ${inferred.categoryEn}` : null,
    row.sku ? `SKU: ${row.sku}` : null,
  ].filter(Boolean);

  return [
    `<p>Official ${title} from Urban Automotive.</p>`,
    points.length ? `<ul>${points.map((item) => `<li>${item}</li>`).join('')}</ul>` : '',
    `<p>The final finish, scope and fitment depend on the official Urban listing and the selected configuration.</p>`,
  ]
    .filter(Boolean)
    .join('');
}

function makeGenericHtmlUa(row, inferred) {
  const title = normText(row.titleUa || row.titleEn);
  const points = [
    row.collectionUa || row.collectionEn ? `Авто / колекція: ${row.collectionUa || row.collectionEn}` : null,
    inferred.categoryUa ? `Категорія: ${inferred.categoryUa}` : null,
    row.sku ? `SKU: ${row.sku}` : null,
  ].filter(Boolean);

  return [
    `<p>Офіційна позиція Urban Automotive: ${title}.</p>`,
    points.length ? `<ul>${points.map((item) => `<li>${item}</li>`).join('')}</ul>` : '',
    `<p>Фінальна комплектація, оздоблення та сумісність залежать від офіційної конфігурації Urban для конкретного автомобіля.</p>`,
  ]
    .filter(Boolean)
    .join('');
}

function buildFallbackEn(row, inferred) {
  if ((inferred.categoryEn || row.categoryEn) === 'Wheels') {
    return makeWheelHtmlEn(row);
  }
  return makeGenericHtmlEn(row, inferred);
}

function buildFallbackUa(row, inferred) {
  if ((inferred.categoryEn || row.categoryEn) === 'Wheels') {
    return makeWheelHtmlUa(row);
  }
  return makeGenericHtmlUa(row, inferred);
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      vendor: { equals: 'Urban Automotive', mode: 'insensitive' },
    },
    orderBy: { slug: 'asc' },
    select: {
      id: true,
      sku: true,
      slug: true,
      titleUa: true,
      titleEn: true,
      categoryUa: true,
      categoryEn: true,
      shortDescUa: true,
      shortDescEn: true,
      longDescUa: true,
      longDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      collectionUa: true,
      collectionEn: true,
    },
  });

  const updates = [];

  for (const row of rows) {
    const inferred = inferCategory(row);
    const data = {};

    if (!row.categoryEn && inferred.categoryEn) data.categoryEn = inferred.categoryEn;
    if (!row.categoryUa && inferred.categoryUa) data.categoryUa = inferred.categoryUa;

    const hasEnBody = !isBlank(row.bodyHtmlEn);
    const hasUaBody = !isBlank(row.bodyHtmlUa);
    const hasEnSummary = !isBlank(row.longDescEn) || !isBlank(row.shortDescEn);
    const hasUaSummary = !isBlank(row.longDescUa) || !isBlank(row.shortDescUa);
    const hasEnDetail = !isBlank(row.longDescEn) || !isBlank(row.bodyHtmlEn);
    const hasUaDetail = !isBlank(row.longDescUa) || !isBlank(row.bodyHtmlUa);

    if (!hasEnBody && !hasEnSummary) {
      const htmlEn = buildFallbackEn(row, inferred);
      data.bodyHtmlEn = htmlEn;
      data.longDescEn = stripHtml(htmlEn) || null;
      data.shortDescEn = excerpt(htmlEn, 240);
    } else if (!hasEnDetail) {
      const htmlEn = buildFallbackEn(row, inferred);
      data.bodyHtmlEn = htmlEn;
      data.longDescEn = stripHtml(htmlEn) || null;
      if (isBlank(row.shortDescEn)) data.shortDescEn = excerpt(htmlEn, 240);
    } else if (hasEnBody) {
      if (isBlank(row.longDescEn)) data.longDescEn = stripHtml(row.bodyHtmlEn) || null;
      if (isBlank(row.shortDescEn)) data.shortDescEn = excerpt(row.bodyHtmlEn, 240);
    }

    if (!hasUaBody && !hasUaSummary) {
      const htmlUa = buildFallbackUa(row, inferred);
      data.bodyHtmlUa = htmlUa;
      data.longDescUa = stripHtml(htmlUa) || null;
      data.shortDescUa = excerpt(htmlUa, 240);
    } else if (!hasUaDetail) {
      const htmlUa = buildFallbackUa(row, inferred);
      data.bodyHtmlUa = htmlUa;
      data.longDescUa = stripHtml(htmlUa) || null;
      if (isBlank(row.shortDescUa)) data.shortDescUa = excerpt(htmlUa, 240);
    } else if (hasUaBody) {
      if (isBlank(row.longDescUa)) data.longDescUa = stripHtml(row.bodyHtmlUa) || null;
      if (isBlank(row.shortDescUa)) data.shortDescUa = excerpt(row.bodyHtmlUa, 240);
    }

    if (Object.keys(data).length) {
      updates.push({
        id: row.id,
        slug: row.slug,
        data,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        totalUrban: rows.length,
        updates: updates.length,
        sample: updates.slice(0, 25).map((item) => ({
          slug: item.slug,
          keys: Object.keys(item.data),
        })),
      },
      null,
      2
    )
  );

  if (DRY_RUN) {
    await prisma.$disconnect();
    return;
  }

  for (const entry of updates) {
    await prisma.shopProduct.update({
      where: { id: entry.id },
      data: entry.data,
    });
    console.log(`[updated] ${entry.slug}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
