#!/usr/bin/env node

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
  ['Front Lips', 'Передні спліттери'],
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
  ['Car Parts', 'Автокомпоненти'],
]);

function norm(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return norm(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function excerpt(text, max = 220) {
  const plain = stripHtml(text);
  if (!plain) return null;
  if (plain.length <= max) return plain;
  const sliced = plain.slice(0, max);
  const stop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('; '), sliced.lastIndexOf(', '));
  return `${(stop > 80 ? sliced.slice(0, stop) : sliced).trim()}…`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeTitle(value) {
  return norm(value).replace(/[:\s-]+$/g, '');
}

function combineVehicleBrandAndCollection(brand, collection) {
  const normalizedBrand = norm(brand);
  const normalizedCollection = norm(collection);
  if (!normalizedCollection) return null;
  if (!normalizedBrand) return normalizedCollection;
  const lowerCollection = normalizedCollection.toLowerCase();
  const lowerBrand = normalizedBrand.toLowerCase();
  if (lowerCollection.includes(lowerBrand)) return normalizedCollection;
  if (normalizedBrand === 'Land Rover' && /^Defender\b/i.test(normalizedCollection)) {
    return `Land Rover ${normalizedCollection}`;
  }
  if (normalizedBrand === 'Range Rover' && /^Sport\b/i.test(normalizedCollection)) {
    return `Range Rover ${normalizedCollection}`;
  }
  if (normalizedBrand === 'Mercedes-Benz' && /g-wagon|g-class/i.test(normalizedCollection)) {
    return `Mercedes-Benz ${normalizedCollection}`;
  }
  if (normalizedBrand === 'Rolls-Royce' && /^Cullinan|^Ghost/i.test(normalizedCollection)) {
    return `Rolls-Royce ${normalizedCollection}`;
  }
  return `${normalizedBrand} ${normalizedCollection}`;
}

function inferVehicleEn(row) {
  return (
    combineVehicleBrandAndCollection(row.brand, row.collectionEn) ||
    combineVehicleBrandAndCollection(row.brand, row.collectionUa) ||
    'the specified vehicle'
  );
}

function inferVehicleUa(row) {
  return (
    combineVehicleBrandAndCollection(row.brand, row.collectionUa) ||
    combineVehicleBrandAndCollection(row.brand, row.collectionEn) ||
    'зазначеного автомобіля'
  );
}

function inferCategoryUa(row) {
  return norm(row.categoryUa) || CATEGORY_UA_MAP.get(norm(row.categoryEn)) || 'Компонент';
}

function isPackageLike(row) {
  const haystack = `${row.categoryEn || ''} ${row.titleEn || ''}`.toLowerCase();
  return /bodykit|body kit|bundle|package|aerokit|design pack|soft kit|replacement bumper/i.test(haystack);
}

function isWheelLike(row) {
  const category = norm(row.categoryEn).toLowerCase();
  const haystack = `${row.titleEn || ''}`.toLowerCase();
  return category === 'wheels' || category === 'wheels & tyres' || /\balloy\b|\bforged\b|\btyres?\b|\bwx\b|\bucr\b|\buv\b|\buc\d\b|\bnds\b/i.test(haystack);
}

function buildHtml({ intro, details, scope, note, headings }) {
  return [
    ...intro.map((line) => `<p>${line}</p>`),
    `<h3>${headings.details}</h3>`,
    `<ul>${details.map((line) => `<li>${line}</li>`).join('')}</ul>`,
    `<h3>${headings.scope}</h3>`,
    `<ul>${scope.map((line) => `<li>${line}</li>`).join('')}</ul>`,
    `<p>${note}</p>`,
  ].join('');
}

function buildCopy(row) {
  const titleEn = sanitizeTitle(row.titleEn || row.titleUa || row.slug);
  const titleUa = sanitizeTitle(row.titleUa || row.titleEn || row.slug);
  const vehicleEn = inferVehicleEn(row);
  const vehicleUa = inferVehicleUa(row);
  const categoryEn = norm(row.categoryEn) || 'Component';
  const categoryUa = inferCategoryUa(row);
  const packageLike = isPackageLike(row);
  const wheelLike = isWheelLike(row);

  const introEn = wheelLike
    ? [
        `Official Urban Automotive wheel listing for ${vehicleEn}.`,
        `This product page covers the ${titleEn} specification from the current Urban range.`,
      ]
    : packageLike
      ? [
          `Official Urban Automotive package listing for ${vehicleEn}.`,
          `This product page covers the ${titleEn} package from the current Urban range.`,
        ]
      : [
          `Official Urban Automotive component listing for ${vehicleEn}.`,
          `This product page covers the ${titleEn} item from the current Urban range.`,
        ];

  const introUa = wheelLike
    ? [
        `Офіційна позиція Urban Automotive для колісної конфігурації ${vehicleUa}.`,
        `Ця сторінка описує специфікацію ${titleUa} з актуальної лінійки Urban.`,
      ]
    : packageLike
      ? [
          `Офіційна пакетна позиція Urban Automotive для ${vehicleUa}.`,
          `Ця сторінка описує пакет ${titleUa} з актуальної лінійки Urban.`,
        ]
      : [
          `Офіційна компонентна позиція Urban Automotive для ${vehicleUa}.`,
          `Ця сторінка описує елемент ${titleUa} з актуальної лінійки Urban.`,
        ];

  const detailsEn = [
    `Item: ${titleEn}`,
    `Vehicle / collection: ${vehicleEn}`,
    `Category: ${categoryEn}`,
    row.sku ? `SKU: ${row.sku}` : null,
  ].filter(Boolean);

  const detailsUa = [
    `Позиція: ${titleUa}`,
    `Авто / колекція: ${vehicleUa}`,
    `Категорія: ${categoryUa}`,
    row.sku ? `Артикул: ${row.sku}` : null,
  ].filter(Boolean);

  const scopeEn = wheelLike
    ? [
        'The listing covers the wheel specification named in the title.',
        'Final finish, size, PCD, ET and tyre configuration depend on the selected option.',
      ]
    : packageLike
      ? [
          'The listing covers the package named in the title.',
          'Adjacent wheels, tyres, lighting or trim items are included only when they are explicitly part of the selected configuration.',
        ]
      : [
          'The listing covers the named component only.',
          'Adjacent trim, mounting work and related body parts are included only when they are explicitly part of the selected configuration.',
        ];

  const scopeUa = wheelLike
    ? [
        'Лістинг охоплює колісну специфікацію, зазначену в назві.',
        'Фінальне оздоблення, діаметр, PCD, ET та шинна конфігурація залежать від обраної опції.',
      ]
    : packageLike
      ? [
          'Лістинг охоплює пакет, зазначений у назві.',
          'Суміжні диски, шини, освітлення або декоративні елементи входять лише тоді, коли вони прямо передбачені обраною конфігурацією.',
        ]
      : [
          'Лістинг охоплює лише названий компонент.',
          'Суміжний декор, монтажні роботи та пов’язані кузовні елементи входять лише тоді, коли вони прямо передбачені обраною конфігурацією.',
        ];

  const noteEn = packageLike
    ? 'Check the selected configuration to confirm the exact package content, finish and fitment before ordering.'
    : 'Check the selected configuration to confirm the exact finish, fitment and package scope before ordering.';
  const noteUa = packageLike
    ? 'Перед замовленням перевірте обрану конфігурацію, щоб підтвердити точний склад пакета, оздоблення та сумісність.'
    : 'Перед замовленням перевірте обрану конфігурацію, щоб підтвердити точне оздоблення, сумісність і склад поставки.';

  const htmlEn = buildHtml({
    intro: introEn,
    details: detailsEn,
    scope: scopeEn,
    note: noteEn,
    headings: { details: 'Product details', scope: 'Configuration scope' },
  });

  const htmlUa = buildHtml({
    intro: introUa.map(escapeHtml),
    details: detailsUa.map(escapeHtml),
    scope: scopeUa.map(escapeHtml),
    note: escapeHtml(noteUa),
    headings: { details: 'Деталі позиції', scope: 'Обсяг конфігурації' },
  });

  const shortDescEn = packageLike
    ? `Official Urban Automotive package listing for ${vehicleEn}. Covers ${titleEn} from the current Urban range.`
    : wheelLike
      ? `Official Urban Automotive wheel listing for ${vehicleEn}. Covers the ${titleEn} specification from the current Urban range.`
      : `Official Urban Automotive component listing for ${vehicleEn}. Covers ${titleEn} from the current Urban range.`;

  const shortDescUa = packageLike
    ? `Офіційна пакетна позиція Urban Automotive для ${vehicleUa}. Охоплює ${titleUa} з актуальної лінійки Urban.`
    : wheelLike
      ? `Офіційна колісна позиція Urban Automotive для ${vehicleUa}. Охоплює специфікацію ${titleUa} з актуальної лінійки Urban.`
      : `Офіційна компонентна позиція Urban Automotive для ${vehicleUa}. Охоплює ${titleUa} з актуальної лінійки Urban.`;

  return {
    shortDescEn: excerpt(shortDescEn, 180),
    shortDescUa: excerpt(shortDescUa, 180),
    longDescEn: stripHtml(htmlEn),
    longDescUa: stripHtml(htmlUa),
    bodyHtmlEn: htmlEn,
    bodyHtmlUa: htmlUa,
    seoDescriptionEn: excerpt(shortDescEn, 160),
    seoDescriptionUa: excerpt(shortDescUa, 160),
  };
}

function hasCyrillic(value) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(String(value ?? ''));
}

function isBadDescription(row) {
  const en = String(row.bodyHtmlEn || '');
  const ua = String(row.bodyHtmlUa || '');

  const gpStyleEn = /^<p>The\s/i.test(en) || /is engineered to|Developed for/i.test(en);
  const brokenUa =
    /\breference\b|\bpackage\b|\bstyling package\b|\bwidened stance\b|\bfinish-варіанти\b|\bcarbon package\b/i.test(
      ua
    ) || (hasCyrillic(ua) && /\b(front|rear|splitter|bonnet|arches|wheel cover|light bar|package)\b/i.test(ua));
  const emptyEn = !norm(en);
  const emptyUa = !norm(ua);

  return gpStyleEn || brokenUa || emptyEn || emptyUa;
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      vendor: { equals: 'Urban Automotive', mode: 'insensitive' },
      status: 'ACTIVE',
      isPublished: true,
    },
    orderBy: { slug: 'asc' },
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      titleUa: true,
      brand: true,
      categoryEn: true,
      categoryUa: true,
      collectionEn: true,
      collectionUa: true,
      shortDescEn: true,
      shortDescUa: true,
      longDescEn: true,
      longDescUa: true,
      bodyHtmlEn: true,
      bodyHtmlUa: true,
    },
  });

  const targets = rows.filter(isBadDescription).map((row) => ({
    row,
    data: buildCopy(row),
  }));

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        totalUrban: rows.length,
        targets: targets.length,
        sample: targets.slice(0, 30).map(({ row, data }) => ({
          slug: row.slug,
          titleEn: row.titleEn,
          shortDescEn: data.shortDescEn,
          shortDescUa: data.shortDescUa,
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

  for (const { row, data } of targets) {
    await prisma.shopProduct.update({
      where: { id: row.id },
      data,
    });
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
