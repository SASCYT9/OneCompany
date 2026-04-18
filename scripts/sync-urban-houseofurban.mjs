#!/usr/bin/env node
/**
 * Sync Urban Automotive product content from the official House of Urban store.
 *
 * What it does:
 * - Fetches official Shopify products from https://houseofurban.co.uk/products.json
 * - Matches local Urban products to official products using part numbers, wheel family,
 *   vehicle fitment, and component kind heuristics
 * - Replaces broken / generic content with official imagery and cleaned official descriptions
 * - Normalizes Urban categoryUa labels to Ukrainian
 * - Optionally translates refreshed EN HTML to UA using Gemini
 *
 * Usage:
 *   node scripts/sync-urban-houseofurban.mjs --dry-run
 *   node scripts/sync-urban-houseofurban.mjs --commit
 *   node scripts/sync-urban-houseofurban.mjs --commit --translate-ua
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

const OFFICIAL_BASE = 'https://houseofurban.co.uk';
const BACKUP_DIR = path.join(process.cwd(), 'backups', 'urban-houseofurban');
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  : '';

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');
const TRANSLATE_UA = args.has('--translate-ua');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1] || 0) || 0 : 0;

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

const VEHICLE_PATTERNS = [
  { key: 'defender-110-octa', rx: /\bdefender\b.*\bocta\b|\bocta\b.*\bdefender\b/i, label: 'Land Rover Defender OCTA' },
  { key: 'defender-130', rx: /\bdefender\b.*\b130\b|\b130\b.*\bdefender\b/i, label: 'Land Rover Defender 130' },
  { key: 'defender-110', rx: /\bdefender\b.*\b110\b|\b110\b.*\bdefender\b/i, label: 'Land Rover Defender 110' },
  { key: 'defender-90', rx: /\bdefender\b.*\b90\b|\b90\b.*\bdefender\b/i, label: 'Land Rover Defender 90' },
  { key: 'defender-l663', rx: /\bl663\b|\bdefender\b/i, label: 'Land Rover Defender L663' },
  { key: 'discovery-55', rx: /\bdiscovery\b.*\b5\.5\b|\b5\.5\b.*\bdiscovery\b/i, label: 'Land Rover Discovery 5.5' },
  { key: 'discovery-5', rx: /\bdiscovery\b.*\b5\b|\bl462\b/i, label: 'Land Rover Discovery 5' },
  { key: 'range-rover-sport-l494', rx: /\bl494\b|\bsvr\b/i, label: 'Range Rover Sport L494' },
  { key: 'range-rover-l405', rx: /\bl405\b/i, label: 'Range Rover L405' },
  { key: 'g-wagon-w463a', rx: /\bw463a\b/i, label: 'Mercedes G-Wagon W463A' },
  { key: 'range-rover-sport-l461', rx: /\bl461\b/i, label: 'Range Rover Sport L461' },
  { key: 'range-rover-l460', rx: /\bl460\b/i, label: 'Range Rover L460' },
  { key: 'g-wagon-w465', rx: /\bw465\b|\bg-wagon\b|\bg class\b|\bg-class\b/i, label: 'Mercedes G-Wagon W465' },
  { key: 'urus', rx: /\burus\b/i, label: 'Lamborghini Urus' },
  { key: 'rsq8', rx: /\brsq8\b/i, label: 'Audi RSQ8' },
  { key: 'q8', rx: /\b q8\b|\bq8\b/i, label: 'Audi Q8' },
  { key: 'golf-r-mk8', rx: /\bgolf r\b|\bmk ?8\b/i, label: 'Volkswagen Golf R Mk8' },
  { key: 'transporter-t61', rx: /\bt6\.1\b|\btransporter\b/i, label: 'Volkswagen Transporter T6.1' },
  { key: 'eqc', rx: /\beqc\b/i, label: 'Mercedes EQC' },
  { key: 'continental-gt', rx: /\bcontinental gt\b|\bcontinental gtc\b/i, label: 'Bentley Continental GT / GTC' },
  { key: 'cullinan-series-ii', rx: /\bcullinan\b.*\bseries ii\b|\bseries ii\b.*\bcullinan\b/i, label: 'Rolls-Royce Cullinan Series II' },
  { key: 'cullinan', rx: /\bcullinan\b/i, label: 'Rolls-Royce Cullinan' },
  { key: 'grenadier', rx: /\bgrenadier\b/i, label: 'INEOS Grenadier' },
  { key: 'rs6', rx: /\brs6\b/i, label: 'Audi RS6' },
];

const KIND_PATTERNS = [
  ['wheel-cover', /\bwheel cover\b/i],
  ['arch-kit', /\barch kit\b|\bwidetrack arch\b|\bwheel arch\b/i],
  ['side-steps', /\bside step\b|\bblack shadow\b/i],
  ['rear-spoiler', /\brear spoiler\b|\bdesign spoiler\b/i],
  ['front-splitter', /\bfront splitter\b|\baero splitter\b/i],
  ['front-canards', /\bcanard\b|\baero blade\b/i],
  ['rear-diffuser', /\brear diffuser\b/i],
  ['grille', /\bgrille\b|\bgrill\b/i],
  ['mirror-covers', /\bmirror\b/i],
  ['side-vent', /\bside vent\b/i],
  ['bonnet-vent', /\bbonnet vent\b|\bhood vent\b/i],
  ['mudflaps', /\bmudflap\b|\bmud flap\b|\bmudguard\b/i],
  ['drl', /\bdrl\b|\bdaytime running light\b|\bnolden\b/i],
  ['light-bar', /\blight bar\b|\broof light\b|\blazer\b/i],
  ['number-plate-kit', /\bnumber plate\b|\bcentralisation\b/i],
  ['rear-lights', /\brear light\b|\bsmoked rear light\b/i],
  ['tuning-forks', /\btuning fork\b/i],
  ['seat-backs', /\bseat back\b/i],
  ['seat-conversion', /\bseat conversion\b/i],
  ['branding-package', /\bbranding package\b/i],
  ['bodykit', /\bbodykit\b|\bbody kit\b|\bwidetrack\b|\bdesign pack\b|\baerodynamic\b|\baerokit\b/i],
  ['door-trim', /\bdoor trim\b/i],
  ['headlight-trim', /\bheadlight trim\b/i],
  ['bonnet', /\bbonnet\b|\bhood\b/i],
  ['vents', /\bvent\b/i],
  ['tailpipes', /\btailpipe\b|\bexhaust pipe adjuster\b/i],
  ['exhaust', /\bexhaust\b/i],
  ['interior', /\binterior\b|\bfloor mat\b|\bseat\b/i],
  ['wheel', /\b(?:uc|wx|uv|uf|ucr)[ -]?\d+r?\b|\balloy\b|\bwheel\b/i],
];

const WHEEL_CODE_RX = /\b(UC|WX|UV|UF|UCR)[ -]?(\dR?)(?!\d)\b/i;
const SIZE_RX = /\b(19|20|21|22|23|24|25)\"/;

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function normText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
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

function normalizeHandleText(text) {
  return normText(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text) {
  return new Set(
    normalizeHandleText(text)
      .split(' ')
      .filter(Boolean)
      .filter((token) => !['urban', 'automotive', 'for', 'and', 'the', 'new', 'of', 'set', 'pair'].includes(token))
  );
}

function tokenScore(left, right) {
  const a = tokenize(left);
  const b = tokenize(right);
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const token of a) {
    if (b.has(token)) matches += 1;
  }
  return matches / Math.max(a.size, b.size);
}

function pickImageUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image.startsWith('//') ? `https:${image}` : image;
  const src = image.src || image.url || image.originalSrc || null;
  return typeof src === 'string' ? (src.startsWith('//') ? `https:${src}` : src) : null;
}

function isBrokenImage(image) {
  const value = String(image ?? '').toLowerCase();
  if (!value) return true;
  return value.includes('/flags/') || value.endsWith('.svg') || value.includes('uk.svg');
}

function normalizeHtml(html) {
  let value = String(html ?? '').trim();
  if (!value) return '';

  value = value
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(\/?)(div|span)([^>]*)>/gi, '<$1$2>')
    .replace(/\u00a0/g, ' ')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p>\s*&nbsp;\s*<\/p>/gi, '')
    .replace(/<p>\s*_{5,}\s*<\/p>/gi, '')
    .replace(/<p>\s*[-_]{5,}\s*<\/p>/gi, '');

  const junkPatterns = [
    /price is for supply only/i,
    /if you require fitting/i,
    /shipping information/i,
    /for orders outside the uk/i,
    /free uk shipping/i,
    /next working day/i,
    /returns?/i,
    /refund/i,
    /ask a question/i,
    /contact us/i,
    /customercare@/i,
    /info@urban-automotive\.co\.uk/i,
    /01908 978978/i,
    /hcaptcha/i,
  ];

  value = value.replace(/<(p|li|div)>([\s\S]*?)<\/\1>/gi, (full, tag, inner) => {
    const plain = stripHtml(inner);
    if (!plain) return '';
    if (junkPatterns.some((rx) => rx.test(plain))) return '';
    return `<${tag}>${inner}</${tag}>`;
  });

  value = value
    .replace(/\n+/g, '')
    .replace(/>\s+</g, '><')
    .trim();

  return value;
}

function extractWheelCode(text) {
  const match = String(text ?? '').match(WHEEL_CODE_RX);
  if (!match) return null;
  return `${match[1].toUpperCase()}-${match[2].toUpperCase()}`;
}

function extractSize(text) {
  const match = String(text ?? '').match(SIZE_RX);
  return match ? `${match[1]}"` : null;
}

function extractPartNumbers(...values) {
  const found = new Set();
  const rxList = [
    /\b\d{3}-\d{4}(?:\/\d+)?(?:-[A-Z]{2})?\b/g,
    /\bURA[A-Z0-9]+\b/g,
    /\bL\d{3,4}-\d{4}\b/g,
    /\bURBAN-P\d+\b/g,
    /\b050-\d{4}\b/g,
    /\b200-\d{4}(?:-[A-Z]{2})?\b/g,
    /\b250-\d{4}(?:-[A-Z]{2})?\b/g,
    /\b400-\d{4}(?:-[A-Z]{2})?\b/g,
    /\b440-\d{4}\b/g,
  ];

  for (const value of values) {
    const source = String(value ?? '').toUpperCase();
    for (const rx of rxList) {
      const matches = source.match(rx) || [];
      for (const match of matches) found.add(match);
    }
  }
  return [...found];
}

function extractVehicleKeys(...values) {
  const joined = values.filter(Boolean).join(' ');
  const keys = new Set();
  for (const { key, rx } of VEHICLE_PATTERNS) {
    if (rx.test(joined)) keys.add(key);
  }
  return [...keys];
}

function primaryVehicleKey(keys) {
  return keys[0] || null;
}

function inferKind({ titleEn, titleUa, categoryEn, categoryUa, handle }) {
  const source = [titleEn, titleUa, categoryEn, categoryUa, handle].filter(Boolean).join(' ');
  for (const [kind, rx] of KIND_PATTERNS) {
    if (rx.test(source)) return kind;
  }
  return 'generic';
}

function translateCategoryUa(categoryEn, categoryUa) {
  const key = categoryEn || categoryUa || null;
  if (!key) return categoryUa ?? null;
  return CATEGORY_UA_MAP.get(key) || categoryUa || key;
}

function makeWheelHtml(official) {
  const sizes = new Set();
  const finishes = new Set();
  const packages = new Set();

  for (const variant of official.variants) {
    const [size, finish, pack] = (variant.title || '').split('/').map((item) => normText(item));
    if (size && size !== 'Default Title') sizes.add(size);
    if (finish) finishes.add(finish);
    if (pack) packages.add(pack);
  }

  const parts = [
    `<p>Official ${official.title} from Urban Automotive.</p>`,
  ];
  if (sizes.size || finishes.size) {
    parts.push(
      `<p>${[
        sizes.size ? `Available sizes: ${[...sizes].join(', ')}` : null,
        finishes.size ? `available finishes: ${[...finishes].join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('; ')}.</p>`
    );
  }
  if (packages.size) {
    parts.push(`<p><strong>Package options:</strong></p><ul>${[...packages].map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  parts.push('<p>Official Urban Automotive imagery and configuration are based on the current House of Urban listing.</p>');
  return parts.join('');
}

function makeFallbackHtml(local, official) {
  const clean = normalizeHtml(official.bodyHtml || official.body_html || '');
  if (clean && !/price is for supply only|shipping information|returns?/i.test(stripHtml(clean))) {
    return clean;
  }
  if (official.kind === 'wheel') {
    return makeWheelHtml(official);
  }

  const lines = [`<p>Official ${official.title} from Urban Automotive.</p>`];

  if (official.vehicleKeys.length) {
    lines.push(`<p><strong>Compatibility:</strong> ${official.vehicleKeys.map((key) => VEHICLE_PATTERNS.find((item) => item.key === key)?.label || key).join(', ')}.</p>`);
  }

  const optionValues = official.variants
    .map((variant) => normText(variant.title))
    .filter((value) => value && value !== 'Default Title')
    .slice(0, 8);

  if (optionValues.length) {
    lines.push(`<p><strong>Available options on the official Urban listing:</strong></p><ul>${optionValues.map((value) => `<li>${value}</li>`).join('')}</ul>`);
  }

  return lines.join('');
}

function chooseVariantImage(official, local) {
  const localText = [local.titleEn, local.titleUa, local.sku].filter(Boolean).join(' ').toLowerCase();
  const localSize = extractSize(local.titleEn || local.titleUa || '');
  for (const variant of official.variants) {
    const title = String(variant.title || '').toLowerCase();
    const variantImage = pickImageUrl(variant.featured_image || variant.featuredImage);
    if (!variantImage) continue;
    const sizeOk = localSize ? title.includes(localSize.toLowerCase()) : true;
    const finishOk =
      (!/satin black|gloss black|forged carbon|visual carbon|red|satin/i.test(localText) || title.includes('satin black') || title.includes('gloss black')) ||
      title.includes('red');
    if (sizeOk && finishOk) return variantImage;
  }
  return pickImageUrl(official.featuredImage) || official.images[0] || null;
}

function buildOfficialMeta(product) {
  const images = [];
  const imageSet = new Set();
  const rawImages = [];
  if (product.image) rawImages.push(product.image);
  if (Array.isArray(product.images)) rawImages.push(...product.images);
  for (const item of rawImages) {
    const url = pickImageUrl(item);
    if (url && !imageSet.has(url)) {
      imageSet.add(url);
      images.push(url);
    }
  }

  const variants = Array.isArray(product.variants) ? product.variants.map((variant) => ({
    ...variant,
    title: normText(variant.title),
    sku: normText(variant.sku),
    featured_image: variant.featured_image || variant.featuredImage || null,
  })) : [];

  const partNumbers = new Set(extractPartNumbers(product.title, product.handle, product.body_html));
  for (const variant of variants) {
    for (const part of extractPartNumbers(variant.sku, variant.title)) {
      partNumbers.add(part);
    }
  }

  const vehicleKeys = new Set(extractVehicleKeys(product.title, product.handle, product.body_html));
  for (const variant of variants) {
    for (const vehicleKey of extractVehicleKeys(variant.title, variant.sku)) {
      vehicleKeys.add(vehicleKey);
    }
  }

  const official = {
    id: product.id,
    handle: product.handle,
    title: normText(product.title),
    bodyHtml: product.body_html || '',
    images,
    featuredImage: pickImageUrl(product.image),
    variants,
    partNumbers: [...partNumbers],
    vehicleKeys: [...vehicleKeys],
    wheelCode: extractWheelCode(product.title),
    kind: inferKind({ titleEn: product.title, handle: product.handle }),
  };

  return official;
}

function buildLocalMeta(row) {
  const vehicleKeys = extractVehicleKeys(row.titleEn, row.titleUa, row.collectionEn, row.collectionUa, row.slug);
  return {
    ...row,
    vehicleKeys,
    primaryVehicleKey: primaryVehicleKey(vehicleKeys),
    partNumbers: extractPartNumbers(row.sku, row.titleEn, row.titleUa, row.slug),
    wheelCode: extractWheelCode(row.titleEn || row.titleUa || row.sku),
    kind: inferKind({
      titleEn: row.titleEn,
      titleUa: row.titleUa,
      categoryEn: row.categoryEn,
      categoryUa: row.categoryUa,
      handle: row.slug,
    }),
  };
}

function scoreMatch(local, official) {
  let score = 0;
  let reason = 'heuristic';

  for (const part of local.partNumbers) {
    if (official.partNumbers.includes(part)) {
      return { score: 1, reason: `part:${part}` };
    }
  }

  const localVehicles = local.vehicleKeys;
  const vehicleOverlap = localVehicles.filter((key) => official.vehicleKeys.includes(key));
  if (vehicleOverlap.length) {
    score += 0.35;
    reason = `vehicle:${vehicleOverlap[0]}`;
  }

  if (local.wheelCode && official.wheelCode && local.wheelCode === official.wheelCode) {
    score += 0.4;
    reason = `wheel:${local.wheelCode}`;
  }

  if (local.kind !== 'generic' && local.kind === official.kind) {
    score += 0.3;
    reason = `${reason}+kind:${local.kind}`;
  }

  if (local.kind === 'bodykit' && official.kind === 'bodykit' && vehicleOverlap.length) {
    score += 0.15;
  }

  const titleSimilarity = tokenScore(local.titleEn || local.titleUa || local.slug, official.title);
  score += titleSimilarity * (vehicleOverlap.length ? 0.35 : 0.2);

  if (official.kind === 'wheel' && local.kind === 'wheel' && vehicleOverlap.length && titleSimilarity > 0.2) {
    score += 0.1;
  }

  if (!vehicleOverlap.length && local.kind !== 'wheel') {
    score -= 0.25;
  }

  return { score, reason };
}

function selectOfficial(local, officials) {
  let best = null;
  let bestScore = 0;
  let bestReason = '';
  for (const official of officials) {
    const { score, reason } = scoreMatch(local, official);
    if (score > bestScore) {
      bestScore = score;
      best = official;
      bestReason = reason;
    }
  }

  const threshold = local.kind === 'wheel' ? 0.55 : 0.62;
  if (!best || bestScore < threshold) {
    return null;
  }

  return { official: best, score: Number(bestScore.toFixed(3)), reason: bestReason };
}

async function fetchOfficialProducts() {
  const products = [];
  for (let page = 1; page <= 12; page += 1) {
    const res = await fetch(`${OFFICIAL_BASE}/products.json?limit=250&page=${page}`, {
      headers: { 'User-Agent': 'OneCompany/UrbanSync/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch official products page ${page}: HTTP ${res.status}`);
    }
    const data = await res.json();
    const chunk = Array.isArray(data.products) ? data.products : [];
    if (!chunk.length) break;
    products.push(...chunk);
    if (chunk.length < 250) break;
  }
  return products.map(buildOfficialMeta);
}

async function backupUrbanProducts(rows) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `${nowStamp()}-urban-before-sync.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return file;
}

async function translateHtmlToUa(html, brand) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const systemPrompt = `You translate official product descriptions for a premium automotive store from English to Ukrainian.\n\nRules:\n1. Output HTML only.\n2. Keep all HTML tags.\n3. Keep brand names, model codes, wheel codes, and part numbers in English.\n4. Use natural premium Ukrainian automotive terminology.\n5. Do not add claims that are not in the source.\n6. Do not translate Urban Automotive, Land Rover, Range Rover, Rolls-Royce, Bentley, Audi, Volkswagen, Mercedes-Benz, Lamborghini.\n7. Keep lists compact and factual.`;

  const userPrompt = `Translate this official ${brand || 'automotive'} product HTML to Ukrainian:\n\n${html}`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini translation failed: HTTP ${res.status} ${text.slice(0, 240)}`);
  }

  const data = await res.json();
  let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  translated = translated.replace(/^```html?/i, '').replace(/```$/i, '').trim();
  const firstTag = translated.indexOf('<');
  if (firstTag > 0) translated = translated.slice(firstTag).trim();
  return translated;
}

async function main() {
  console.log(JSON.stringify({
    mode: DRY_RUN ? 'dry-run' : 'commit',
    translateUa: TRANSLATE_UA,
    limit: LIMIT,
  }, null, 2));

  const [officialProducts, localRows] = await Promise.all([
    fetchOfficialProducts(),
    prisma.shopProduct.findMany({
      where: {
        brand: { equals: 'Urban Automotive', mode: 'insensitive' },
      },
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        sku: true,
        brand: true,
        titleUa: true,
        titleEn: true,
        shortDescUa: true,
        shortDescEn: true,
        longDescUa: true,
        longDescEn: true,
        bodyHtmlUa: true,
        bodyHtmlEn: true,
        categoryUa: true,
        categoryEn: true,
        collectionUa: true,
        collectionEn: true,
        image: true,
        gallery: true,
      },
    }),
  ]);

  const backupFile = await backupUrbanProducts(localRows);
  console.log(`Backup: ${backupFile}`);

  const locals = localRows.map(buildLocalMeta);
  const vehicleFallbackImage = new Map();
  for (const official of officialProducts) {
    const image = pickImageUrl(official.featuredImage) || official.images[0] || null;
    if (!image) continue;
    for (const vehicleKey of official.vehicleKeys) {
      if (!vehicleFallbackImage.has(vehicleKey)) {
        vehicleFallbackImage.set(vehicleKey, image);
      }
    }
  }
  const matches = [];
  const unmatched = [];
  const updates = [];

  for (const local of locals) {
    const picked = selectOfficial(local, officialProducts);
    if (!picked) {
      unmatched.push(local);
      const translatedCategory = translateCategoryUa(local.categoryEn, local.categoryUa);
      const fallbackImage =
        isBrokenImage(local.image) && local.primaryVehicleKey
          ? vehicleFallbackImage.get(local.primaryVehicleKey) || null
          : null;
      const data = {};
      if (translatedCategory !== local.categoryUa) {
        data.categoryUa = translatedCategory;
      }
      if (fallbackImage) {
        data.image = fallbackImage;
        data.gallery = [fallbackImage];
      }
      if (Object.keys(data).length) {
        updates.push({
          id: local.id,
          slug: local.slug,
          officialHandle: null,
          confidence: 0,
          reason: fallbackImage ? 'category+image-fallback' : 'category-only',
          data,
        });
      }
      continue;
    }

    const { official, score, reason } = picked;
    matches.push({ slug: local.slug, sku: local.sku, officialHandle: official.handle, score, reason });

    const image = chooseVariantImage(official, local);
    const gallery = official.images.length ? official.images : image ? [image] : [];
    const bodyHtmlEn = makeFallbackHtml(local, official);
    const longDescEn = stripHtml(bodyHtmlEn) || local.longDescEn || null;
    const shortDescEn = excerpt(bodyHtmlEn, 240) || local.shortDescEn || null;
    const translatedCategory = translateCategoryUa(local.categoryEn, local.categoryUa);

    const data = {};

    if (translatedCategory !== local.categoryUa) data.categoryUa = translatedCategory;
    if (image && image !== local.image) data.image = image;
    if (gallery.length) data.gallery = gallery;
    if (bodyHtmlEn && bodyHtmlEn !== local.bodyHtmlEn) data.bodyHtmlEn = bodyHtmlEn;
    if (longDescEn && longDescEn !== local.longDescEn) data.longDescEn = longDescEn;
    if (shortDescEn && shortDescEn !== local.shortDescEn) data.shortDescEn = shortDescEn;

    updates.push({
      id: local.id,
      slug: local.slug,
      officialHandle: official.handle,
      confidence: score,
      reason,
      data,
      bodyHtmlEn,
      currentBodyHtmlUa: local.bodyHtmlUa,
    });
  }

  const effectiveUpdates = updates.filter((entry) => Object.keys(entry.data).length > 0);
  const finalUpdates = LIMIT > 0 ? effectiveUpdates.slice(0, LIMIT) : effectiveUpdates;

  console.log(JSON.stringify({
    officialProducts: officialProducts.length,
    localUrban: locals.length,
    matched: matches.length,
    unmatched: unmatched.length,
    updates: effectiveUpdates.length,
    applying: finalUpdates.length,
    sampleMatches: matches.slice(0, 25),
    sampleUnmatched: unmatched.slice(0, 20).map((item) => ({
      slug: item.slug,
      sku: item.sku,
      titleEn: item.titleEn,
      categoryEn: item.categoryEn,
      collectionEn: item.collectionEn,
    })),
  }, null, 2));

  if (DRY_RUN) {
    await prisma.$disconnect();
    return;
  }

  let translatedUaCount = 0;

  for (const entry of finalUpdates) {
    if (TRANSLATE_UA && entry.bodyHtmlEn) {
      try {
        const uaHtml = await translateHtmlToUa(entry.bodyHtmlEn, 'Urban Automotive');
        const uaLong = stripHtml(uaHtml);
        const uaShort = excerpt(uaHtml, 240);
        entry.data.bodyHtmlUa = uaHtml;
        entry.data.longDescUa = uaLong || null;
        if (uaShort) entry.data.shortDescUa = uaShort;
        translatedUaCount += 1;
      } catch (error) {
        console.error(`[translate-ua] ${entry.slug}: ${(error).message}`);
      }
    }

    await prisma.shopProduct.update({
      where: { id: entry.id },
      data: entry.data,
    });
    console.log(`[updated] ${entry.slug} <- ${entry.officialHandle || 'taxonomy'} (${entry.reason})`);
  }

  console.log(JSON.stringify({
    committed: true,
    updated: finalUpdates.length,
    translatedUa: translatedUaCount,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
