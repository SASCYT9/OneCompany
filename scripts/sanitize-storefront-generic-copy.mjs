#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');

const SUSPICIOUS_PATTERNS = [
  /engineered to transform/i,
  /crafted for the discerning owner/i,
  /improves airflow dynamics/i,
  /premium construction/i,
  /premium performance component/i,
  /performance component manufactured in sweden/i,
];

const CATEGORY_UA_MAP = new Map([
  ['Accessories', 'Аксесуари'],
  ['Bodykits', 'Обвіси'],
  ['Bundles', 'Комплекти'],
  ['Decal and Lettering', 'Декор та літеринг'],
  ['Diffusers', 'Дифузори'],
  ['Electrics', 'Електрика'],
  ['Exterior Styling', 'Зовнішній стайлінг'],
  ['Front Bumper Add-ons', 'Елементи переднього бампера'],
  ['Front Bumpers', 'Передні бампери'],
  ['Grilles', 'Решітки'],
  ['Hoods', 'Капоти'],
  ['Logos', 'Логотипи'],
  ['Roof Lights', 'Дахові світлові модулі'],
  ['Side Steps', 'Підніжки'],
  ['Spoilers', 'Спойлери'],
  ['Vents', 'Вентиляційні елементи'],
  ['Wheels', 'Диски'],
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

function sanitizeTitle(value) {
  return norm(value).replace(/[:\s-]+$/g, '');
}

function isSuspicious(row) {
  const haystack = [
    row.shortDescEn,
    row.shortDescUa,
    row.longDescEn,
    row.longDescUa,
    row.bodyHtmlEn,
    row.bodyHtmlUa,
  ]
    .filter(Boolean)
    .join(' ');

  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(haystack));
}

function inferVehicle(row) {
  const explicit = norm(row.collectionEn || row.collectionUa);
  if (explicit) return explicit;

  const title = sanitizeTitle(row.titleEn || row.titleUa);
  const checks = [
    /Land Rover Defender 90\/110\/130\/OCTA/i,
    /Land Rover Defender 90\/110\/130/i,
    /Land Rover Defender 110 OCTA/i,
    /Land Rover Defender 110/i,
    /Land Rover Defender 90/i,
    /Land Rover Defender 130/i,
    /Land Rover Discovery 5/i,
    /Range Rover L460\/L461/i,
    /Range Rover L460/i,
    /Range Rover L461/i,
    /Range Rover L405/i,
    /Range Rover Sport L461/i,
    /Range Rover Sport L494/i,
    /Rolls Royce Cullinan Series 2/i,
    /Rolls Royce Cullinan Series 1/i,
    /Rolls Royce Cullinan/i,
    /Rolls Royce Ghost/i,
    /Mercedes W465 G-Wagon/i,
    /Mercedes G-Wagon/i,
    /Audi RS3 8Y Sedan/i,
    /Audi RS3 8Y Hatchback/i,
    /Audi RS3/i,
    /Audi RS6/i,
    /Bentley Continental GT/i,
    /Volkswagen Transporter T6\.1/i,
  ];

  for (const pattern of checks) {
    const match = title.match(pattern);
    if (match) {
      return norm(match[0].replace(/Rolls Royce/g, 'Rolls-Royce'));
    }
  }

  return 'the specified vehicle';
}

function inferVehicleUa(row, vehicleEn) {
  const explicit = norm(row.collectionUa);
  if (explicit) return explicit;

  return vehicleEn
    .replace('the specified vehicle', 'зазначений автомобіль')
    .replace('Rolls-Royce', 'Rolls-Royce')
    .replace('Range Rover Sport', 'Range Rover Sport')
    .replace('Range Rover', 'Range Rover')
    .replace('Land Rover Discovery 5', 'Land Rover Discovery 5')
    .replace('Land Rover Defender 90/110/130/OCTA', 'Land Rover Defender 90/110/130/OCTA')
    .replace('Land Rover Defender 110 OCTA', 'Land Rover Defender 110 OCTA')
    .replace('Land Rover Defender 110', 'Land Rover Defender 110')
    .replace('Land Rover Defender 90', 'Land Rover Defender 90')
    .replace('Land Rover Defender 130', 'Land Rover Defender 130')
    .replace('Bentley Continental GT', 'Bentley Continental GT')
    .replace('Mercedes W465 G-Wagon', 'Mercedes W465 G-Wagon')
    .replace('Mercedes G-Wagon', 'Mercedes G-Wagon')
    .replace('Volkswagen Transporter T6.1', 'Volkswagen Transporter T6.1');
}

function inferCategoryUa(row) {
  return norm(row.categoryUa) || CATEGORY_UA_MAP.get(norm(row.categoryEn)) || 'Компонент';
}

function isPackage(row) {
  const haystack = `${row.categoryEn || ''} ${row.titleEn || ''}`;
  return /bodykit|body kit|bundle|package|widetrack|aerokit|design pack/i.test(haystack);
}

function buildHtml({ headingIncluded, headingExcluded, headingFeatures, intro, included, excluded, features }) {
  const blocks = intro.map((paragraph) => `<p>${paragraph}</p>`);

  if (included.length) {
    blocks.push(`<h3>${headingIncluded}</h3>`);
    blocks.push(`<ul>${included.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  if (excluded.length) {
    blocks.push(`<h3>${headingExcluded}</h3>`);
    blocks.push(`<ul>${excluded.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  if (features.length) {
    blocks.push(`<h3>${headingFeatures}</h3>`);
    blocks.push(`<ul>${features.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  return blocks.join('');
}

function buildCopy(row) {
  const brand = norm(row.brand) || 'Official';
  const titleEn = sanitizeTitle(row.titleEn || row.titleUa || row.slug);
  const titleUa = sanitizeTitle(row.titleUa || row.titleEn || row.slug);
  const vehicleEn = inferVehicle(row);
  const vehicleUa = inferVehicleUa(row, vehicleEn);
  const categoryEn = norm(row.categoryEn) || 'Component';
  const categoryUa = inferCategoryUa(row);
  const packageLike = isPackage(row);

  const introEn = packageLike
    ? [
        `Official ${brand} package for ${vehicleEn}.`,
        `This listing covers the ${titleEn} package shown in the current ${brand} range for this vehicle.`,
      ]
    : [
        `Official ${brand} component for ${vehicleEn}.`,
        `This listing covers the ${titleEn} item shown in the current ${brand} range for this vehicle.`,
      ];

  const introUa = packageLike
    ? [
        `Офіційний пакет ${brand} для ${vehicleUa}.`,
        `Цей лістинг охоплює пакет ${titleUa}, який входить до актуальної лінійки ${brand} для цього автомобіля.`,
      ]
    : [
        `Офіційний компонент ${brand} для ${vehicleUa}.`,
        `Цей лістинг охоплює позицію ${titleUa}, яка входить до актуальної лінійки ${brand} для цього автомобіля.`,
      ];

  const includedEn = [titleEn];
  const includedUa = [titleUa];

  const excludedEn = packageLike
    ? [
        'Installation / fitting work',
        'Optional wheels, tyres, lighting or adjacent trim unless explicitly listed in the selected configuration',
      ]
    : [
        'Installation / fitting work',
        'Adjacent body panels, badges, wheels, lighting or exhaust parts not explicitly named in this listing',
      ];

  const excludedUa = packageLike
    ? [
        'Роботи з монтажу / встановлення',
        'Опціональні диски, шини, освітлення або суміжні елементи, якщо вони прямо не вказані в обраній конфігурації',
      ]
    : [
        'Роботи з монтажу / встановлення',
        'Суміжні кузовні елементи, логотипи, диски, освітлення або вихлопні деталі, якщо вони прямо не названі в цьому лістингу',
      ];

  const featuresEn = [
    `Vehicle / collection: ${vehicleEn}`,
    `Category: ${categoryEn}`,
    row.sku ? `SKU: ${row.sku}` : null,
  ].filter(Boolean);

  const featuresUa = [
    `Авто / колекція: ${vehicleUa}`,
    `Категорія: ${categoryUa}`,
    row.sku ? `SKU: ${row.sku}` : null,
  ].filter(Boolean);

  const htmlEn = buildHtml({
    headingIncluded: 'What is included',
    headingExcluded: 'What is not included',
    headingFeatures: 'Key features',
    intro: introEn,
    included: includedEn,
    excluded: excludedEn,
    features: featuresEn,
  });

  const htmlUa = buildHtml({
    headingIncluded: 'Що входить',
    headingExcluded: 'Що не входить',
    headingFeatures: 'Ключові характеристики',
    intro: introUa,
    included: includedUa,
    excluded: excludedUa,
    features: featuresUa,
  });

  return {
    shortDescEn: excerpt(htmlEn, 180),
    shortDescUa: excerpt(htmlUa, 180),
    longDescEn: stripHtml(htmlEn),
    longDescUa: stripHtml(htmlUa),
    bodyHtmlEn: htmlEn,
    bodyHtmlUa: htmlUa,
  };
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: { isPublished: true },
    orderBy: [{ brand: 'asc' }, { slug: 'asc' }],
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      titleEn: true,
      titleUa: true,
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

  const targets = rows.filter(isSuspicious).map((row) => ({
    row,
    data: buildCopy(row),
  }));

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        suspicious: targets.length,
        brands: targets.reduce((acc, item) => {
          acc[item.row.brand] = (acc[item.row.brand] || 0) + 1;
          return acc;
        }, {}),
        sample: targets.slice(0, 25).map(({ row }) => ({
          slug: row.slug,
          brand: row.brand,
          titleEn: sanitizeTitle(row.titleEn),
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
