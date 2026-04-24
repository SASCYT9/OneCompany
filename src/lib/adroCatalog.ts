import type { ShopProduct } from '@/lib/shopCatalog';

type AdroCatalogProduct = Pick<
  ShopProduct,
  'brand' | 'vendor' | 'title' | 'category' | 'sku' | 'slug'
>;

export type AdroCatalogCategory = {
  key: string;
  labelEn: string;
  labelUa: string;
};

export type EnrichedAdroCatalogProduct = {
  product: ShopProduct;
  makes: string[];
  models: string[];
  category: AdroCatalogCategory;
  searchText: string;
};

const UNKNOWN_MAKE = 'Other';
const UNKNOWN_MODEL = 'Other';

const MAKE_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'BMW', patterns: [/\bBMW\b/i, /\bM[2-5]\b/i, /\bX5\s*M\b/i] },
  { label: 'Porsche', patterns: [/\bPORSCHE\b/i, /\b911\b/i, /\b992(?:\.\d)?\b/i, /\b718\b/i, /\bGT3\b/i] },
  { label: 'Toyota', patterns: [/\bTOYOTA\b/i, /\bGR\s*YARIS\b/i, /\bGR86\b/i, /\bSUPRA\b/i] },
  { label: 'Subaru', patterns: [/\bSUBARU\b/i, /\bBRZ\b/i] },
  { label: 'Tesla', patterns: [/\bTESLA\b/i, /\bMODEL\s*[3Y]\b/i] },
  { label: 'Ford', patterns: [/\bFORD\b/i, /\bMUSTANG\b/i] },
  { label: 'Kia', patterns: [/\bKIA\b/i, /\bSTINGER\b/i] },
  { label: 'Honda', patterns: [/\bHONDA\b/i, /\bCIVIC\b/i, /\bTYPE\s*R\b/i] },
  { label: 'Hyundai', patterns: [/\bHYUNDAI\b/i, /\bELANTRA\b/i, /\bVELOSTER\b/i] },
  { label: 'Genesis', patterns: [/\bGENESIS\b/i, /\bGV70\b/i, /\bGV80\b/i, /\bG70\b/i] },
  { label: 'Chevrolet', patterns: [/\bCHEVROLET\b/i, /\bCORVETTE\b/i] },
];

const MAKE_STRIP_PATTERNS = [
  /\bBMW\b/gi,
  /\bPORSCHE\b/gi,
  /\bTOYOTA\b/gi,
  /\bSUBARU\b/gi,
  /\bTESLA\b/gi,
  /\bFORD\b/gi,
  /\bKIA\b/gi,
  /\bHONDA\b/gi,
  /\bHYUNDAI\b/gi,
  /\bGENESIS\b/gi,
  /\bCHEVROLET\b/gi,
];

const CATEGORY_PATTERNS: Array<{ category: AdroCatalogCategory; patterns: RegExp[] }> = [
  {
    category: { key: 'front-aero', labelEn: 'Front aero', labelUa: 'Передня аеродинаміка' },
    patterns: [/bumper/i, /front/i, /splitter/i, /lip/i, /бампер/i, /спліттер/i, /підспойлер/i],
  },
  {
    category: { key: 'diffusers', labelEn: 'Diffusers', labelUa: 'Дифузори' },
    patterns: [/diffuser/i, /дифузор/i],
  },
  {
    category: { key: 'side-skirts', labelEn: 'Side skirts', labelUa: 'Пороги' },
    patterns: [/side\s+skirt/i, /пороги/i],
  },
  {
    category: { key: 'spoilers', labelEn: 'Spoilers & wings', labelUa: 'Спойлери та крила' },
    patterns: [/spoiler/i, /wing/i, /спойлер/i, /крило/i],
  },
  {
    category: { key: 'body-kits', labelEn: 'Body kits', labelUa: 'Комплекти обвісів' },
    patterns: [/body\s*(?:kit|widening)/i, /wide\s*body/i, /widebody/i, /комплект/i, /обвіс/i],
  },
  {
    category: { key: 'hoods', labelEn: 'Hoods', labelUa: 'Капоти' },
    patterns: [/hood/i, /капот/i],
  },
  {
    category: { key: 'grilles', labelEn: 'Grilles', labelUa: 'Решітки' },
    patterns: [/grille/i, /grill/i, /решітк/i],
  },
  {
    category: { key: 'vents-panels', labelEn: 'Vents & panels', labelUa: 'Вентиляція та панелі' },
    patterns: [/vent/i, /door/i, /roof/i, /panel/i, /двер/i, /дах/i, /панел/i],
  },
  {
    category: { key: 'other', labelEn: 'Other', labelUa: 'Інше' },
    patterns: [/\bother\b/i, /інше/i],
  },
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildProductText(product: Pick<AdroCatalogProduct, 'title' | 'sku' | 'slug' | 'category'> & Partial<Pick<AdroCatalogProduct, 'brand' | 'vendor'>>) {
  return [
    product.sku,
    product.slug,
    product.brand,
    product.vendor,
    product.title?.en,
    product.title?.ua,
    product.category?.en,
    product.category?.ua,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ');
}

function extractFitmentText(product: Pick<AdroCatalogProduct, 'title' | 'slug'>) {
  const source = [product.title?.en, product.title?.ua, product.slug]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ');

  const fitmentMatch = source.match(/(?:^|\s)(?:for|для)\s+([^|]+)$/i);
  if (fitmentMatch?.[1]) {
    return normalizeWhitespace(fitmentMatch[1]);
  }

  const firstFitmentMatch = source.match(/(?:^|\s)(?:for|для)\s+([^|]+)/i);
  return normalizeWhitespace(firstFitmentMatch?.[1] ?? source);
}

function splitTopLevelFitments(value: string) {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if ((char === '/' || char === ',' || char === ';') && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts.map((part) => normalizeWhitespace(part)).filter(Boolean);
}

function stripYears(value: string) {
  return value
    .replace(/\b(?:19|20)\d{2}\s*(?:[-–]\s*(?:19|20)?\d{2})?\+?/g, ' ')
    .replace(/\b(?:19|20)\d{2}\s*[-–]\s*/g, ' ')
    .replace(/\s*[-–]\s*$/g, ' ');
}

function stripMakeNames(value: string) {
  return MAKE_STRIP_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), value);
}

function normalizeModelLabel(value: string) {
  return normalizeWhitespace(
    stripMakeNames(stripYears(value))
      .replace(/\b(?:for|для)\b/gi, ' ')
      .replace(/[.]+$/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
  );
}

function fallbackCategory(rawCategory: string): AdroCatalogCategory {
  const fallback = normalizeWhitespace(rawCategory) || 'Other';
  return {
    key: fallback.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '') || 'other',
    labelEn: fallback,
    labelUa: fallback,
  };
}

export function isAdroProduct(product: Pick<AdroCatalogProduct, 'brand' | 'vendor'>) {
  const brand = String(product.brand ?? '').trim().toLowerCase();
  const vendor = String(product.vendor ?? '').trim().toLowerCase();
  return brand === 'adro' || vendor === 'adro';
}

export function detectAdroMakes(product: Pick<AdroCatalogProduct, 'title' | 'slug'>) {
  const fitmentText = extractFitmentText(product);
  const found = MAKE_PATTERNS.filter((entry) =>
    entry.patterns.some((pattern) => pattern.test(fitmentText))
  ).map((entry) => entry.label);

  return found.length ? uniqueValues(found) : [UNKNOWN_MAKE];
}

export function detectAdroModels(product: Pick<AdroCatalogProduct, 'title' | 'slug'>) {
  const fitmentText = extractFitmentText(product);
  const models = splitTopLevelFitments(fitmentText)
    .map(normalizeModelLabel)
    .filter((model) => model.length > 0 && !/^(for|для)$/i.test(model));

  return models.length ? uniqueValues(models) : [UNKNOWN_MODEL];
}

export function normalizeAdroCategory(product: Pick<AdroCatalogProduct, 'category' | 'title' | 'slug' | 'sku'>) {
  const rawCategory = uniqueValues([product.category?.en ?? '', product.category?.ua ?? '']).join(' ');
  const text = `${rawCategory} ${buildProductText(product)}`;

  for (const entry of CATEGORY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return entry.category;
    }
  }

  return fallbackCategory(rawCategory);
}

export function enrichAdroCatalogProduct(product: ShopProduct): EnrichedAdroCatalogProduct {
  const makes = detectAdroMakes(product);
  const models = detectAdroModels(product);
  const category = normalizeAdroCategory(product);

  return {
    product,
    makes,
    models,
    category,
    searchText: buildProductText(product).toLowerCase(),
  };
}
