// Brand-neutral fallback editorial copy for shop products whose Atomic / Airtable
// feed left `bodyHtmlUa` empty OR shipped English-dominant text into the UA
// field (which the legacy "and → та" patcher only made worse). Produces short,
// factual Ukrainian copy without Urban-Automotive brand voice.
//
// Runs AFTER the Urban gate (Urban-only) and Akrapovič generator (Akrapovič-only)
// in shopCatalogServer.ts.

export type GenericShopEditorialInput = {
  slug: string;
  titleEn: string;
  titleUa?: string | null;
  shortDescEn?: string | null;
  shortDescUa?: string | null;
  longDescEn?: string | null;
  longDescUa?: string | null;
  bodyHtmlEn?: string | null;
  bodyHtmlUa?: string | null;
  brand?: string | null;
  categoryEn?: string | null;
  categoryUa?: string | null;
  productType?: string | null;
  collectionEn?: string | null;
  collectionUa?: string | null;
  tags?: string[];
  sku?: string | null;
};

export type GenericShopEditorialCopy = {
  titleUa: string;
  shortDescUa: string;
  longDescUa: string;
  bodyHtmlUa: string;
  seoTitleUa: string;
  seoDescriptionUa: string;
};

const CATEGORY_UA_FALLBACK: Array<[RegExp, string]> = [
  [/\b(exhaust|tailpipe|catback|cat-back|downpipe|slip[- ]on|muffler|midpipe)\b/i, 'Вихлопна система'],
  // EDC / electronic damping / cancellation kits ship as suspension parts even
  // though the supplier sometimes tags them as "sensors / accessories".
  [/\b(suspension|coilover|coil[- ]over|damper|damping|shock|strut|spring|spacer|mount|bushing|edc(?:\s+cancel\w*)?|electronic\s+damp\w*)\b/i, 'Підвіска'],
  [/\b(brake|disc|rotor|pad|caliper|hardware\s+kit|big\s+brake)\b/i, 'Гальмівна система'],
  [/\b(radiator|intercooler|oil\s+cooler|charge\s+air|cooling)\b/i, 'Система охолодження'],
  [/\b(intake|inlet\s+manifold|charge\s+pipe|turbo\s+inlet)\b/i, 'Впускна система'],
  [/\b(turbocharger|turbo\s+kit|methanol|water\s+meth|nitrous|fueling|injector|fuel\s+pump)\b/i, 'Силова доробка',],
  [/\b(chip[- ]?tuning|tuning\s+box|piggyback|ecu|map|stage\s*\d)\b/i, 'Чіп-тюнінг'],
  [/\b(spoiler|splitter|diffuser|wing|aerokit|body\s?kit|bumper|hood|bonnet|side\s+skirt)\b/i, 'Аеродинаміка / обвіс'],
  [/\b(wheel|rim|forged|cast)\b/i, 'Колісні диски'],
  [/\b(intercom|harness|wiring|control\s+module|controller|switch|indicator)\b/i, 'Електроніка'],
  [/\b(seat|steering\s+wheel|gauge|pedal|shift\s+knob|interior)\b/i, "Інтер'єр"],
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeWhitespace(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();
}

function stripHtml(value: string | null | undefined): string {
  return normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function cyrillicRatio(value: string | null | undefined): number {
  const text = String(value ?? '');
  const letters = text.match(/[A-Za-zА-Яа-яІіЇїЄєҐґÄÖÜßäöüçñ]/g)?.length ?? 0;
  if (!letters) return 0;
  const cyrillic = text.match(/[А-Яа-яІіЇїЄєҐґ]/g)?.length ?? 0;
  return cyrillic / letters;
}

export function isUaBodyEmptyOrLatin(row: {
  bodyHtmlUa?: string | null;
  longDescUa?: string | null;
  shortDescUa?: string | null;
}): boolean {
  const stripped = stripHtml(row.bodyHtmlUa) || stripHtml(row.longDescUa) || stripHtml(row.shortDescUa);
  if (!stripped) return true;
  if (stripped.length < 40) return true;
  return cyrillicRatio(stripped) < 0.4;
}

const VEHICLE_BRAND_TITLECASE: Array<[RegExp, string]> = [
  [/MERCEDES(?:[- ]BENZ)?(?:[- ]?AMG)?/gi, 'Mercedes'],
  [/PORSCHE/gi, 'Porsche'],
  [/FERRARI/gi, 'Ferrari'],
  [/TOYOTA/gi, 'Toyota'],
  [/NISSAN/gi, 'Nissan'],
  [/VOLKSWAGEN/gi, 'Volkswagen'],
  [/LAMBORGHINI/gi, 'Lamborghini'],
  [/MCLAREN/gi, 'McLaren'],
  [/CHEVROLET/gi, 'Chevrolet'],
  [/RENAULT/gi, 'Renault'],
  [/AUDI/gi, 'Audi'],
  [/HYUNDAI/gi, 'Hyundai'],
  [/KIA/gi, 'Kia'],
  [/HONDA/gi, 'Honda'],
  [/MAZDA/gi, 'Mazda'],
  [/SUBARU/gi, 'Subaru'],
  [/MITSUBISHI/gi, 'Mitsubishi'],
  [/FORD/gi, 'Ford'],
  [/MINI/gi, 'Mini'],
  [/CUPRA/gi, 'Cupra'],
];

function buildVehiclePhrase(titleEn: string): string {
  const afterFor = titleEn.match(/\bfor\s+(.+)$/i)?.[1];
  if (!afterFor) return '';
  let phrase = afterFor;
  phrase = phrase
    .replace(/\s+\d{4}\s*[–—\-]\s*\d{4}.*$/i, '')
    .replace(/\s+\d{4}\s*[+–—\-]\s*$/i, '')
    .replace(/\s+\d{4}\s*onwards.*$/i, '')
    .replace(/\s+\d{4}\s*$/i, '')
    .replace(/\s*\((?:OPF|GPF|ECE|EC|without|with|non-)[^)]*\)\s*$/i, '')
    .replace(/[,;]\s*$/, '')
    .trim();
  for (const [pattern, replacement] of VEHICLE_BRAND_TITLECASE) {
    phrase = phrase.replace(pattern, replacement);
  }
  return normalizeWhitespace(phrase);
}

// Generic / catchall / misleading categories that don't add information — when
// the DB row ships these we'd rather derive a more specific category from the
// title. Includes "Датчики і аксесуари" (OHLINS EDC kit case) where the
// supplier groups suspension electronics under a sensors-and-accessories bag.
const GENERIC_CATEGORY_PATTERN =
  /^(аксесуар(?:и)?|accessory|accessories|інше|other|component|компонент|датчик(?:и)?(?:\s+і\s+аксесуар(?:и)?)?|sensor(?:s)?(?:\s+(?:and|&)\s+accessor(?:y|ies))?)\s*\(?[^)]*\)?$/i;

function pickCategoryUa(input: GenericShopEditorialInput): string {
  const fromUa = normalizeWhitespace(input.categoryUa);
  const haystack = `${input.categoryEn ?? ''} ${input.productType ?? ''} ${input.titleEn ?? ''}`;
  // 1. If the title clearly maps to a specific domain (Suspension / Exhaust /
  //    Cooling / etc.), prefer it — it beats both "Аксесуари" generic and
  //    misleading vendor labels like "Датчики і аксесуари" for an EDC kit.
  for (const [pattern, label] of CATEGORY_UA_FALLBACK) {
    if (pattern.test(haystack)) return label;
  }
  // 2. Otherwise trust the DB categoryUa unless it's a known catchall.
  if (fromUa && !GENERIC_CATEGORY_PATTERN.test(fromUa)) return fromUa;
  const fromEn = normalizeWhitespace(input.categoryEn);
  return fromEn || 'Компонент';
}

function buildShortDescription(
  brand: string,
  categoryUa: string,
  vehicle: string,
  productType: string
): string {
  const productTypeIsInformative =
    productType &&
    !GENERIC_CATEGORY_PATTERN.test(productType) &&
    productType.toLowerCase() !== categoryUa.toLowerCase();
  const subject = productTypeIsInformative
    ? `${categoryUa} (${productType})`
    : categoryUa;
  const brandSuffix = brand ? ` ${brand}` : '';
  const vehicleSuffix = vehicle ? ` для ${vehicle}` : '';
  return normalizeWhitespace(
    `${subject}${brandSuffix}${vehicleSuffix}. Конфігурація відповідає офіційному артикулу виробника.`
  );
}

const CLOSING_SENTENCE =
  'Точна комплектація, оздоблення та сумісність визначаються офіційним артикулом виробника для конкретної платформи.';

export function buildGenericShopEditorialCopy(
  input: GenericShopEditorialInput
): GenericShopEditorialCopy {
  const titleEn = normalizeWhitespace(input.titleEn);
  const titleUa = normalizeWhitespace(input.titleUa) || titleEn;
  const brand = normalizeWhitespace(input.brand);
  const productType = normalizeWhitespace(input.productType);
  const categoryUa = pickCategoryUa(input);
  const vehicle = buildVehiclePhrase(titleEn);
  const sku = normalizeWhitespace(input.sku);

  const shortDescUa = buildShortDescription(brand, categoryUa, vehicle, productType);

  const bullets: string[] = [];
  if (sku) bullets.push(`<li><strong>Артикул:</strong> ${escapeHtml(sku)}</li>`);
  if (brand) bullets.push(`<li><strong>Бренд:</strong> ${escapeHtml(brand)}</li>`);
  if (categoryUa) bullets.push(`<li><strong>Категорія:</strong> ${escapeHtml(categoryUa)}</li>`);
  if (productType && productType !== categoryUa)
    bullets.push(`<li><strong>Тип:</strong> ${escapeHtml(productType)}</li>`);
  if (vehicle) bullets.push(`<li><strong>Платформа:</strong> ${escapeHtml(vehicle)}</li>`);

  const bodyHtmlUa = [
    `<p>${escapeHtml(shortDescUa)}</p>`,
    bullets.length ? `<ul>${bullets.join('')}</ul>` : '',
    `<p>${escapeHtml(CLOSING_SENTENCE)}</p>`,
  ]
    .filter(Boolean)
    .join('');

  const longDescUa = `${shortDescUa} ${CLOSING_SENTENCE}`;

  return {
    titleUa,
    shortDescUa,
    longDescUa,
    bodyHtmlUa,
    seoTitleUa: titleUa,
    seoDescriptionUa: shortDescUa,
  };
}
