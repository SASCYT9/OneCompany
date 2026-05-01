import { createHash } from 'crypto';

import { load } from 'cheerio';

import { htmlToPlainText, sanitizeRichTextHtml } from '@/lib/sanitizeRichTextHtml';

export type IpePriceKind = 'absolute' | 'relative' | 'included' | 'free' | 'tbd' | string;

export type IpeParsedPriceListRow = {
  page: number;
  tier: string | null;
  brand: string;
  model: string | null;
  year_range: string | null;
  engine: string | null;
  section: string | null;
  sku: string;
  material: string | null;
  description: string;
  price_kind: IpePriceKind;
  msrp_usd: number | null;
  import_fee_usd: number | null;
  retail_usd: number | null;
  remarks: string | null;
  matched_summary_label: string | null;
  raw_line: string;
};

export type IpeParsedPriceList = {
  source_pdf: string;
  pricing_formula?: {
    threshold_usd?: number;
    low_fee_usd?: number;
    high_fee_usd?: number;
    type?: string;
    rule?: string;
  } | null;
  items: IpeParsedPriceListRow[];
};

export type IpeOfficialOptionSnapshot = {
  name: string;
  values: string[];
};

export type IpeOfficialVariantSnapshot = {
  id: string;
  title: string;
  sku: string | null;
  available: boolean;
  featuredImage: string | null;
  optionValues: string[];
  optionMap: Record<string, string>;
};

export type IpeOfficialProductSnapshot = {
  id: string;
  handle: string;
  title: string;
  bodyHtml: string;
  tags: string[];
  images: string[];
  vendor: string | null;
  productType: string | null;
  url: string;
  options: IpeOfficialOptionSnapshot[];
  variants: IpeOfficialVariantSnapshot[];
};

export type IpeOfficialSnapshot = {
  sourceBaseUrl: string;
  crawledAt: string;
  productCount: number;
  handlesFromSitemap: string[];
  products: IpeOfficialProductSnapshot[];
};

export type IpeCanonicalTokenSet = {
  vehicleMake: string | null;
  modelTokens: string[];
  chassisTokens: string[];
  yearTokens: string[];
  systemFamily: string | null;
  material: string | null;
  featureFlags: string[];
  sectionHints: string[];
  overlapTokens: string[];
  signatureText: string;
};

export type IpeMatchScoreBreakdown = {
  vehicle: number;
  system: number;
  option: number;
  material: number;
  overlap: number;
  section: number;
  total: number;
};

export type IpeProductMatchCandidate = {
  product: IpeOfficialProductSnapshot;
  score: number;
  breakdown: IpeMatchScoreBreakdown;
};

export type IpeProductMatchSelection = {
  best: IpeProductMatchCandidate | null;
  candidates: IpeProductMatchCandidate[];
  status: 'auto' | 'review' | 'unresolved';
};

export type IpeVariantCandidate = {
  source: 'official' | 'absolute-row';
  title: string;
  optionNames: string[];
  optionValues: string[];
  officialVariantId?: string | null;
  officialVariantTitle?: string | null;
  defaultVariant?: boolean;
  baseRow?: IpeParsedPriceListRow;
  imageUrl?: string | null;
};

export type IpeResolvedVariantPricing = {
  priceUsd: number | null;
  baseRow: IpeParsedPriceListRow | null;
  deltaRows: IpeParsedPriceListRow[];
  includedRows: IpeParsedPriceListRow[];
  reviewReasons: string[];
  confidence: number;
};

const DEFAULT_THRESHOLD_USD = 5000;
const DEFAULT_LOW_FEE_USD = 1500;
const DEFAULT_HIGH_FEE_USD = 1600;

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'back',
  'by',
  'for',
  'from',
  'in',
  'ipe',
  'innotech',
  'of',
  'on',
  'or',
  'performance',
  'system',
  'systems',
  'the',
  'to',
  'version',
  'with',
]);

const MODEL_STOPWORDS = new Set([
  ...STOPWORDS,
  'current',
  'cat',
  'catted',
  'catless',
  'downpipe',
  'exhaust',
  'factory',
  'full',
  'header',
  'headers',
  'mid',
  'opf',
  'pipe',
  'pro',
  'rear',
  'remote',
  'straight',
  'stainless',
  'steel',
  'titanium',
  'tips',
  'upgrade',
  'wireless',
  'engine',
  'model',
  'motor',
  'original',
  'dual',
  'single',
  'side',
  'out',
  'ipe',
]);

const VEHICLE_MAKES = [
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'Ferrari',
  'Ford',
  'Jaguar',
  'Lamborghini',
  'Land Rover',
  'Lexus',
  'Maserati',
  'McLaren',
  'Mercedes-Benz',
  'MINI',
  'Nissan',
  'Porsche',
  'Rolls-Royce',
  'Subaru',
  'Toyota',
  'Volkswagen',
] as const;

const NORMALIZED_MAKE_ALIASES = new Map<string, string>([
  ['aston martin', 'Aston Martin'],
  ['audi', 'Audi'],
  ['bentley', 'Bentley'],
  ['bmw', 'BMW'],
  ['ferrari', 'Ferrari'],
  ['ford', 'Ford'],
  ['jaguar', 'Jaguar'],
  ['lamborghini', 'Lamborghini'],
  ['land rover', 'Land Rover'],
  ['lexus', 'Lexus'],
  ['maserati', 'Maserati'],
  ['mclaren', 'McLaren'],
  ['mercedes benz', 'Mercedes-Benz'],
  ['mercedes-benz', 'Mercedes-Benz'],
  ['benz', 'Mercedes-Benz'],
  ['mini', 'MINI'],
  ['nissan', 'Nissan'],
  ['porsche', 'Porsche'],
  ['rolls royce', 'Rolls-Royce'],
  ['rolls-royce', 'Rolls-Royce'],
  ['subaru', 'Subaru'],
  ['toyota', 'Toyota'],
  ['volkswagen', 'Volkswagen'],
]);

const SYSTEM_FAMILY_PATTERNS = [
  ['full-system', /\bfull system\b|\bequal length full system\b|\bequal-length full system\b/i],
  ['rear-valvetronic', /\brear valvetronic\b/i],
  ['cat-back', /\bcat back\b|\bcatback\b/i],
  ['header-back', /\bheader back\b/i],
  ['header', /\bheaders?\b/i],
  ['downpipe', /\bdownpipe\b|\bfront section\b|\bfront pipe\b|\bcat pipe\b|\bcat\/catless straight\b|\bcatless straight\b/i],
  ['mid-pipe', /\bmid pipe\b|\blink pipe\b/i],
  ['tips', /\btips?\b|\btailpipes?\b/i],
  ['upgrade', /\bupgrade options?\b|\bremote control\b|\bobdii\b|\blighting sensor\b|\bcel sync\b/i],
] as const;

const MATERIAL_PATTERNS = [
  ['ss+ti', /\bss\+ti\b|\bstainless(?: steel)?\b.*\btitanium\b|\btitanium\b.*\bstainless(?: steel)?\b/i],
  ['ti', /\btitanium\b|\b\(?ti\)?\b/i],
  ['ss', /\bstainless(?: steel)?\b|\b\(?ss\)?\b/i],
  ['carbon', /\bcarbon(?: fiber)?\b/i],
  ['inconel', /\binconel\b/i],
] as const;

const FEATURE_PATTERNS = [
  ['opf', /\bopf\b/i],
  ['non-opf', /\bnon[- ]opf\b/i],
  ['catted', /\bcatted\b|\bwith cat\b|\bcat version\b/i],
  ['catless', /\bcatless\b/i],
  ['h-pipe', /\bh pipe\b|\bh-pipe\b/i],
  ['x-pipe', /\bx pipe\b|\bx-pipe\b/i],
  ['remote-control', /\bremote control\b/i],
  ['obdii', /\bobdii\b|\blighting sensor\b/i],
  ['satin-silver', /\bsatin silver\b/i],
  ['chrome-black', /\bchrome black\b/i],
  ['satin-gold', /\bsatin gold\b/i],
  ['titanium-blue', /\btitanium blue\b/i],
  ['polished-silver', /\bpolished silver\b/i],
  ['carbon-fiber', /\bcarbon fiber\b/i],
  ['pro-version', /\bpro version\b/i],
  ['factory-version', /\bfactory version\b/i],
  ['extend-pipe', /\bextend pipe\b/i],
  ['cel-sync', /\bcel sync\b/i],
] as const;

const IPE_HTML_NOISE_PATTERNS = [
  /\bfree shipping\b/i,
  /\bshipping information\b/i,
  /\breturns?\b/i,
  /\brefund\b/i,
  /\bcontact us\b/i,
  /\bcustomer service\b/i,
  /\bclick here\b/i,
  /\bshare this\b/i,
  /\bwishlist\b/i,
  /\bemail us\b/i,
  /\bsubscribe\b/i,
  /\bnewsletter\b/i,
  /\bshipping cost\b/i,
  /\bpayment methods?\b/i,
];

const YEAR_TOKEN_RX = /\b(?:19|20)\d{2}\b|current/gi;
const CHASSIS_TOKEN_RX = /\b(?:[A-Z]{0,3}\d{1,4}(?:\.\d)?[A-Z]{0,3}|\d{3,4}(?:\.\d)?[A-Z]{0,3})\b/g;

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[※•]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/catback/gi, 'cat back')
    .replace(/nonopf/gi, 'non opf')
    .replace(/x-pipe/gi, 'x pipe')
    .replace(/h-pipe/gi, 'h pipe')
    .replace(/[^\p{L}\p{N}\s/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAlphaNumericText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[※•]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/catback/gi, 'cat back')
    .replace(/nonopf/gi, 'non opf')
    .replace(/x-pipe/gi, 'x pipe')
    .replace(/h-pipe/gi, 'h pipe')
    .replace(/[^\p{L}\p{N}\s./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeText(value: string | null | undefined, stopwords = STOPWORDS) {
  const splitTokens = normalizeText(value)
    .toLowerCase()
    .split(/[\s/|-]+/)
    .map((token) => token.trim());
  const compoundTokens = normalizeAlphaNumericText(value)
    .toLowerCase()
    .split(/[\s/|-]+/)
    .map((token) => token.trim());

  return Array.from(
    new Set(
      [...splitTokens, ...compoundTokens].filter((token) => token.length > 1 && !stopwords.has(token))
    )
  );
}

function overlapScore(left: readonly string[], right: readonly string[]) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  let matches = 0;
  for (const token of left) {
    if (rightSet.has(token)) matches += 1;
  }
  return matches / Math.max(left.length, right.length);
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function firstMatch(text: string, patterns: readonly (readonly [string, RegExp])[]) {
  for (const [label, rx] of patterns) {
    if (rx.test(text)) return label;
  }
  return null;
}

function collectMatches(text: string, patterns: readonly (readonly [string, RegExp])[]) {
  const matches = new Set<string>();
  for (const [label, rx] of patterns) {
    if (rx.test(text)) {
      matches.add(label);
    }
  }
  return Array.from(matches).sort();
}

function normalizeVehicleMake(value: string | null | undefined) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  return NORMALIZED_MAKE_ALIASES.get(normalized) ?? null;
}

function detectVehicleMake(text: string, fallback?: string | null | undefined) {
  const explicit = normalizeVehicleMake(fallback);
  if (explicit) return explicit;

  const normalized = normalizeText(text).toLowerCase();
  for (const make of VEHICLE_MAKES) {
    if (normalized.includes(make.toLowerCase())) return make;
  }
  for (const [alias, canonical] of NORMALIZED_MAKE_ALIASES) {
    if (normalized.includes(alias)) return canonical;
  }
  return null;
}

function extractYearTokens(text: string) {
  return Array.from(
    new Set(
      (text.match(YEAR_TOKEN_RX) ?? [])
        .map((token) => token.toLowerCase())
        .map((token) => (token === 'current' ? token : token.trim()))
    )
  );
}

function extractChassisTokens(text: string) {
  const normalized = normalizeAlphaNumericText(text).toUpperCase();
  return Array.from(
    new Set(
      (normalized.match(CHASSIS_TOKEN_RX) ?? [])
        .flatMap((token) => {
          const trimmed = token.trim().toUpperCase();
          const compact = trimmed.replace(/[./-]/g, '');
          return compact && compact !== trimmed ? [trimmed, compact] : [trimmed];
        })
        .filter((token) => {
          if (token.length < 2) return false;
          if (/^(19|20)\d{2}$/.test(token)) return false;
          if (/^\d\.\d[TL]?$/.test(token)) return false;
          return true;
        })
    )
  );
}

function extractModelTokens(text: string, make: string | null) {
  const makeTokens = tokenizeText(make ?? '', MODEL_STOPWORDS);
  const stopwords = new Set([...MODEL_STOPWORDS, ...makeTokens]);
  const modelTokens = tokenizeText(text, stopwords).filter((token) => !/^(19|20)\d{2}$/.test(token));
  const chassisLikeTokens = extractChassisTokens(text)
    .map((token) => token.toLowerCase())
    .filter((token) => !/^(19|20)\d{2}$/.test(token));
  return Array.from(new Set([...modelTokens, ...chassisLikeTokens]));
}

function buildSignatureText(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ');
}

export function computeIpeRetailPrice(
  msrpUsd: number | null | undefined,
  options?: {
    thresholdUsd?: number;
    lowFeeUsd?: number;
    highFeeUsd?: number;
  }
) {
  const normalizedMsrp = Number(msrpUsd ?? 0);
  if (!Number.isFinite(normalizedMsrp) || normalizedMsrp <= 0) return null;
  const thresholdUsd = options?.thresholdUsd ?? DEFAULT_THRESHOLD_USD;
  const lowFeeUsd = options?.lowFeeUsd ?? DEFAULT_LOW_FEE_USD;
  const highFeeUsd = options?.highFeeUsd ?? DEFAULT_HIGH_FEE_USD;
  return normalizedMsrp + (normalizedMsrp >= thresholdUsd ? highFeeUsd : lowFeeUsd);
}

export function buildIpeCanonicalTokenSetFromPriceRow(row: IpeParsedPriceListRow): IpeCanonicalTokenSet {
  const signatureText = buildSignatureText(row.brand, row.model, row.year_range, row.engine, row.section, row.material, row.description);
  const vehicleMake = detectVehicleMake(signatureText, row.brand);
  return {
    vehicleMake,
    modelTokens: extractModelTokens(buildSignatureText(row.model, row.year_range, row.engine), vehicleMake),
    chassisTokens: extractChassisTokens(buildSignatureText(row.model, row.description, row.section)),
    yearTokens: extractYearTokens(buildSignatureText(row.year_range, row.description)),
    systemFamily: firstMatch(signatureText, SYSTEM_FAMILY_PATTERNS),
    material: firstMatch(signatureText, MATERIAL_PATTERNS),
    featureFlags: collectMatches(signatureText, FEATURE_PATTERNS),
    sectionHints: collectMatches(buildSignatureText(row.section, row.description), SYSTEM_FAMILY_PATTERNS),
    overlapTokens: tokenizeText(buildSignatureText(row.model, row.section, row.description, row.material, row.remarks)),
    signatureText,
  };
}

export function buildIpeCanonicalTokenSetFromOfficialProduct(
  product: IpeOfficialProductSnapshot,
  variant?: IpeOfficialVariantSnapshot | null
): IpeCanonicalTokenSet {
  const signatureText = buildSignatureText(
    product.title,
    product.productType,
    product.tags.join(' '),
    product.bodyHtml,
    variant?.title,
    variant?.optionValues.join(' ')
  );
  const vehicleMake = detectVehicleMake(signatureText);
  return {
    vehicleMake,
    modelTokens: extractModelTokens(buildSignatureText(product.title, product.tags.join(' ')), vehicleMake),
    chassisTokens: extractChassisTokens(buildSignatureText(product.title, product.tags.join(' '), variant?.title)),
    yearTokens: extractYearTokens(buildSignatureText(product.title, product.tags.join(' '))),
    systemFamily: firstMatch(signatureText, SYSTEM_FAMILY_PATTERNS),
    material: firstMatch(signatureText, MATERIAL_PATTERNS),
    featureFlags: collectMatches(signatureText, FEATURE_PATTERNS),
    sectionHints: collectMatches(
      buildSignatureText(
        product.title,
        product.productType,
        product.tags.join(' '),
        htmlToPlainText(product.bodyHtml),
        variant?.title,
        variant?.optionValues.join(' ')
      ),
      SYSTEM_FAMILY_PATTERNS
    ),
    overlapTokens: tokenizeText(buildSignatureText(product.title, product.tags.join(' '), htmlToPlainText(product.bodyHtml), variant?.title)),
    signatureText,
  };
}

function scoreVehicleSignature(row: IpeCanonicalTokenSet, product: IpeCanonicalTokenSet) {
  const makeScore =
    row.vehicleMake && product.vehicleMake ? (row.vehicleMake === product.vehicleMake ? 1 : 0) : 0;
  const modelScore = overlapScore(row.modelTokens, product.modelTokens);
  const chassisScore = overlapScore(row.chassisTokens, product.chassisTokens);
  const yearScore = overlapScore(row.yearTokens, product.yearTokens);
  return clamp01(makeScore * 0.45 + Math.max(modelScore, chassisScore) * 0.45 + yearScore * 0.1);
}

function scoreSystemFamily(row: IpeCanonicalTokenSet, product: IpeCanonicalTokenSet) {
  if (!row.systemFamily || !product.systemFamily) {
    if (
      row.systemFamily &&
      (product.sectionHints.includes(row.systemFamily) || product.featureFlags.includes(row.systemFamily))
    ) {
      return 0.75;
    }
    if (
      product.systemFamily &&
      (row.sectionHints.includes(product.systemFamily) || row.featureFlags.includes(product.systemFamily))
    ) {
      return 0.75;
    }
    return 0;
  }
  if (row.systemFamily === product.systemFamily) return 1;
  if (product.sectionHints.includes(row.systemFamily) || row.sectionHints.includes(product.systemFamily)) return 0.75;
  if (row.systemFamily === 'full-system' && ['cat-back', 'downpipe', 'header', 'tips', 'upgrade'].includes(product.systemFamily)) {
    return 0.7;
  }
  if (product.systemFamily === 'full-system' && ['cat-back', 'downpipe', 'header', 'tips', 'upgrade'].includes(row.systemFamily)) {
    return 0.7;
  }
  const rowParts = row.systemFamily.split('-');
  const productParts = product.systemFamily.split('-');
  return overlapScore(rowParts, productParts);
}

function scoreOptionSignature(row: IpeCanonicalTokenSet, product: IpeCanonicalTokenSet) {
  if (!row.featureFlags.length) return 0.5;
  if (!product.featureFlags.length) return 0;
  return overlapScore(row.featureFlags, product.featureFlags);
}

function scoreMaterialSignature(row: IpeCanonicalTokenSet, product: IpeCanonicalTokenSet) {
  if (!row.material || !product.material) return 0;
  if (row.material === product.material) return 1;
  if (product.material === 'ss+ti' && (row.material === 'ss' || row.material === 'ti')) return 1;
  if (row.material === 'ss+ti' && (product.material === 'ss' || product.material === 'ti')) return 0.6;
  return 0;
}

function scoreSectionHints(row: IpeCanonicalTokenSet, product: IpeCanonicalTokenSet) {
  return overlapScore(row.sectionHints, product.sectionHints);
}

export function scoreIpeProductMatch(
  row: IpeParsedPriceListRow,
  product: IpeOfficialProductSnapshot
): IpeMatchScoreBreakdown {
  return scoreIpeCanonicalTokenSets(
    buildIpeCanonicalTokenSetFromPriceRow(row),
    buildIpeCanonicalTokenSetFromOfficialProduct(product)
  );
}

export function scoreIpeCanonicalTokenSets(
  row: IpeCanonicalTokenSet,
  product: IpeCanonicalTokenSet
): IpeMatchScoreBreakdown {
  const vehicle = scoreVehicleSignature(row, product);
  const system = scoreSystemFamily(row, product);
  const option = scoreOptionSignature(row, product);
  const material = scoreMaterialSignature(row, product);
  const overlap = overlapScore(row.overlapTokens, product.overlapTokens);
  const section = scoreSectionHints(row, product);
  const total =
    vehicle * 0.35 +
    system * 0.25 +
    option * 0.15 +
    material * 0.1 +
    overlap * 0.1 +
    section * 0.05;

  return {
    vehicle: Number(vehicle.toFixed(3)),
    system: Number(system.toFixed(3)),
    option: Number(option.toFixed(3)),
    material: Number(material.toFixed(3)),
    overlap: Number(overlap.toFixed(3)),
    section: Number(section.toFixed(3)),
    total: Number(total.toFixed(3)),
  };
}

export function selectBestIpeProductMatch(
  row: IpeParsedPriceListRow,
  products: readonly IpeOfficialProductSnapshot[],
  options?: {
    limit?: number;
    autoThreshold?: number;
    reviewThreshold?: number;
  }
): IpeProductMatchSelection {
  const autoThreshold = options?.autoThreshold ?? 0.9;
  const reviewThreshold = options?.reviewThreshold ?? 0.75;
  const limit = options?.limit ?? 5;
  const scored = products
    .map((product) => {
      const breakdown = scoreIpeProductMatch(row, product);
      return {
        product,
        score: breakdown.total,
        breakdown,
      } satisfies IpeProductMatchCandidate;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(limit, 1));

  const best = scored[0] ?? null;
  const status =
    !best || best.score < reviewThreshold
      ? 'unresolved'
      : best.score >= autoThreshold
        ? 'auto'
        : 'review';

  return { best, candidates: scored, status };
}

export function cleanIpeOfficialHtml(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';

  let cleaned = normalized
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  const seen = new Set<string>();
  cleaned = cleaned.replace(/<(p|li|h1|h2|h3|h4|h5|h6)[^>]*>([\s\S]*?)<\/\1>/gi, (full, tag, inner) => {
    const plain = htmlToPlainText(inner).replace(/\s+/g, ' ').trim();
    if (!plain) return '';
    if (IPE_HTML_NOISE_PATTERNS.some((rx) => rx.test(plain))) return '';
    const dedupeKey = plain.toLowerCase();
    if (seen.has(dedupeKey)) return '';
    seen.add(dedupeKey);
    return `<${tag}>${inner}</${tag}>`;
  });

  cleaned = cleaned
    .replace(/<(p|li|div|span)[^>]*>\s*<\/\1>/gi, '')
    .replace(/\n+/g, '')
    .replace(/>\s+</g, '><')
    .trim();

  return sanitizeRichTextHtml(cleaned);
}

export function buildIpeShortDescription(value: string | null | undefined, maxLength = 240) {
  const plain = htmlToPlainText(value);
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  const sliced = plain.slice(0, maxLength);
  const stop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('; '), sliced.lastIndexOf(', '));
  return `${(stop > 80 ? sliced.slice(0, stop) : sliced).trim()}...`;
}

function isMeaningfulVariant(variant: IpeOfficialVariantSnapshot) {
  if (variant.optionValues.some((value) => value && value.toLowerCase() !== 'default title')) return true;
  const title = variant.title.trim().toLowerCase();
  return Boolean(title && title !== 'default title');
}

function buildVariantTitleFromRow(row: IpeParsedPriceListRow) {
  const parts = [row.section, row.description].map((part) => normalizeText(part)).filter(Boolean);
  return parts.join(' · ') || normalizeText(row.model) || row.sku;
}

export function buildIpeVariantCandidates(
  product: IpeOfficialProductSnapshot,
  rows: readonly IpeParsedPriceListRow[]
): IpeVariantCandidate[] {
  const meaningfulVariants = product.variants.filter(isMeaningfulVariant);
  if (meaningfulVariants.length > 0) {
    return meaningfulVariants.map((variant, index) => ({
      source: 'official',
      title: variant.title.trim() || variant.optionValues.filter(Boolean).join(' / ') || product.title,
      optionNames: product.options.map((option) => option.name).slice(0, 3),
      optionValues: variant.optionValues.slice(0, 3),
      officialVariantId: variant.id,
      officialVariantTitle: variant.title,
      defaultVariant: index === 0,
      imageUrl: variant.featuredImage,
    }));
  }

  return rows
    .filter((row) => row.price_kind === 'absolute')
    .map((row, index) => ({
      source: 'absolute-row',
      title: buildVariantTitleFromRow(row),
      optionNames: ['Configuration'],
      optionValues: [buildVariantTitleFromRow(row)],
      defaultVariant: index === 0,
      baseRow: row,
      imageUrl: null,
    }));
}

function buildVariantTokenSet(
  product: IpeOfficialProductSnapshot,
  candidate: IpeVariantCandidate
) {
  if (candidate.baseRow) {
    return buildIpeCanonicalTokenSetFromPriceRow(candidate.baseRow);
  }

  const variant =
    candidate.officialVariantId != null
      ? product.variants.find((item) => item.id === candidate.officialVariantId) ?? null
      : null;
  return buildIpeCanonicalTokenSetFromOfficialProduct(product, variant);
}

function scoreVariantRowCandidate(
  variantTokens: IpeCanonicalTokenSet,
  rowTokens: IpeCanonicalTokenSet,
  kind: 'base' | 'delta' | 'included'
) {
  const system = scoreSystemFamily(rowTokens, variantTokens);
  const material = scoreMaterialSignature(rowTokens, variantTokens);
  const option = scoreOptionSignature(rowTokens, variantTokens);
  const overlap = overlapScore(rowTokens.overlapTokens, variantTokens.overlapTokens);
  const vehicle = scoreVehicleSignature(rowTokens, variantTokens);

  const total =
    kind === 'base'
      ? vehicle * 0.3 + system * 0.35 + material * 0.15 + option * 0.1 + overlap * 0.1
      : vehicle * 0.2 + system * 0.15 + material * 0.1 + option * 0.35 + overlap * 0.2;

  return Number(total.toFixed(3));
}

function featureGroupForRow(row: IpeParsedPriceListRow) {
  const tokenSet = buildIpeCanonicalTokenSetFromPriceRow(row);
  if (tokenSet.systemFamily === 'downpipe') return 'downpipe';
  if (tokenSet.systemFamily === 'header' || tokenSet.systemFamily === 'header-back') return 'header';
  if (tokenSet.systemFamily === 'tips') return 'tips';
  if (tokenSet.featureFlags.includes('remote-control')) return 'remote-control';
  if (tokenSet.featureFlags.includes('obdii')) return 'obdii';
  if (tokenSet.featureFlags.includes('satin-silver')) return 'tip-finish';
  if (tokenSet.featureFlags.includes('chrome-black')) return 'tip-finish';
  if (tokenSet.featureFlags.includes('satin-gold')) return 'tip-finish';
  if (tokenSet.featureFlags.includes('titanium-blue')) return 'tip-finish';
  if (tokenSet.featureFlags.includes('polished-silver')) return 'tip-finish';
  if (tokenSet.featureFlags.includes('carbon-fiber')) return 'tip-material';
  if (tokenSet.featureFlags.includes('opf') || tokenSet.featureFlags.includes('non-opf')) return 'opf';
  if (tokenSet.featureFlags.includes('catted') || tokenSet.featureFlags.includes('catless')) return 'catalyst';
  return row.section ? normalizeText(row.section).toLowerCase() : row.sku.toLowerCase();
}

export type IpeVariantOptionContext = {
  isFullSystem: boolean;
  isCatback: boolean;
  isHeaderBack: boolean;
  frontPipe: 'factory' | 'equal-length' | null;
  downpipe: 'catted' | 'catless' | null;
  opf: 'opf' | 'non-opf' | null;
  tipFinish: string | null;
  tipMaterial: string | null;
  hasRemote: boolean;
  hasObdii: boolean;
  material: 'ss' | 'ti' | null;
  raw: string;
};

export function inferIpeVariantOptionContext(optionValues: readonly string[]): IpeVariantOptionContext {
  const joined = optionValues.filter(Boolean).join(' | ').toLowerCase();
  const isFullSystem = /\bfull\s*system\b/.test(joined);
  const isCatback = !isFullSystem && /\bcat\s*back\b|\bcatback\b/.test(joined);
  const isHeaderBack = /\bheader\s*back\b/.test(joined);
  const tipFinish = /\bchrome\s*black\b/.test(joined)
    ? 'chrome-black'
    : /\bsatin\s*silver\b/.test(joined)
      ? 'satin-silver'
      : /\bsatin\s*gold\b/.test(joined)
        ? 'satin-gold'
        : /\btitanium\s*blue\b/.test(joined)
          ? 'titanium-blue'
          : /\bpolished\s*silver\b/.test(joined)
            ? 'polished-silver'
            : null;
  return {
    isFullSystem,
    isCatback,
    isHeaderBack,
    frontPipe: /\bequal[- ]length\b/.test(joined)
      ? 'equal-length'
      : /\bfactory\b/.test(joined)
        ? 'factory'
        : null,
    downpipe: /\bcatless\b/.test(joined) ? 'catless' : /\bcatted\b/.test(joined) ? 'catted' : null,
    opf: /\bnon[- ]?opf\b/.test(joined) ? 'non-opf' : /\bopf\b/.test(joined) ? 'opf' : null,
    tipFinish,
    tipMaterial: /\bcarbon\s*fiber\b/.test(joined) ? 'carbon-fiber' : null,
    hasRemote: /\bremote\b/.test(joined),
    hasObdii: /\bobd\s*ii\b|\bobdii\b/.test(joined),
    material: /\btitanium\b/.test(joined) ? 'ti' : /\bstainless\b/.test(joined) ? 'ss' : null,
    raw: joined,
  };
}

function rowMatchesVariantContext(
  row: IpeParsedPriceListRow,
  context: IpeVariantOptionContext
): { eligible: boolean; required: boolean } {
  const tokens = buildIpeCanonicalTokenSetFromPriceRow(row);
  const flags = tokens.featureFlags;
  const family = tokens.systemFamily;

  // Material exclusion: if variant explicitly chose SS, exclude Ti rows (and vice versa)
  if (context.material === 'ss' && tokens.material === 'ti') return { eligible: false, required: false };
  if (context.material === 'ti' && tokens.material === 'ss') return { eligible: false, required: false };

  // OPF exclusion across rows that carry an OPF flag
  if (context.opf === 'opf' && flags.includes('non-opf') && !flags.includes('opf')) return { eligible: false, required: false };
  if (context.opf === 'non-opf' && flags.includes('opf') && !flags.includes('non-opf')) return { eligible: false, required: false };

  if (family === 'downpipe' || family === 'header' || family === 'header-back') {
    // Downpipe rows count only for Full System / Header-Back variants — not Catback
    if (context.isCatback && !context.isFullSystem && !context.isHeaderBack) {
      return { eligible: false, required: false };
    }
    if (context.downpipe === 'catted' && flags.includes('catless') && !flags.includes('catted')) {
      return { eligible: false, required: false };
    }
    if (context.downpipe === 'catless' && flags.includes('catted') && !flags.includes('catless')) {
      return { eligible: false, required: false };
    }
    return { eligible: true, required: context.isFullSystem };
  }

  if (family === 'tips') {
    if (context.tipFinish && !flags.includes(context.tipFinish)) return { eligible: false, required: false };
    if (context.tipMaterial && !flags.includes(context.tipMaterial)) return { eligible: false, required: false };
    if (!context.tipFinish && !context.tipMaterial) return { eligible: false, required: false };
    return { eligible: true, required: false };
  }

  if (flags.includes('remote-control')) {
    return { eligible: context.hasRemote, required: false };
  }
  if (flags.includes('obdii')) {
    return { eligible: context.hasObdii, required: false };
  }

  return { eligible: true, required: false };
}

export function resolveIpeVariantPricing(
  product: IpeOfficialProductSnapshot,
  candidate: IpeVariantCandidate,
  rows: readonly IpeParsedPriceListRow[]
): IpeResolvedVariantPricing {
  if (candidate.baseRow) {
    return {
      priceUsd: candidate.baseRow.retail_usd,
      baseRow: candidate.baseRow,
      deltaRows: [],
      includedRows: rows.filter((row) => row.price_kind === 'included' || row.price_kind === 'free'),
      reviewReasons: [],
      confidence: 1,
    };
  }

  const context = inferIpeVariantOptionContext(candidate.optionValues);
  const variantTokens = buildVariantTokenSet(product, candidate);
  const absoluteRowsAll = rows.filter((row) => row.price_kind === 'absolute');
  const relativeRowsAll = rows.filter((row) => row.price_kind === 'relative');
  const includedRows = rows.filter((row) => row.price_kind === 'included' || row.price_kind === 'free');

  const familyAllowedForBase = (family: string | null) => {
    if (!family) return true;
    if (context.isCatback && !context.isFullSystem) {
      return family === 'cat-back' || family === 'rear-valvetronic';
    }
    if (context.isFullSystem) {
      return family === 'full-system' || family === 'cat-back' || family === 'rear-valvetronic' || family === 'header-back';
    }
    return true;
  };

  const filteredAbsoluteRows = absoluteRowsAll.filter((row) => {
    const tokens = buildIpeCanonicalTokenSetFromPriceRow(row);
    if (!familyAllowedForBase(tokens.systemFamily)) return false;
    if (context.material === 'ss' && tokens.material === 'ti') return false;
    if (context.material === 'ti' && tokens.material === 'ss') return false;
    // When the variant doesn't declare a material, default to Stainless Steel
    // (the standard iPE configuration; Titanium is a separate paid upgrade).
    if (!context.material && tokens.material === 'ti') return false;
    return true;
  });

  const baseSourceRows = filteredAbsoluteRows.length ? filteredAbsoluteRows : absoluteRowsAll;
  const baseCandidates = baseSourceRows
    .map((row) => ({
      row,
      score: scoreVariantRowCandidate(variantTokens, buildIpeCanonicalTokenSetFromPriceRow(row), 'base'),
    }))
    .sort((left, right) => right.score - left.score);

  const reviewReasons: string[] = [];
  const bestBase = baseCandidates[0] ?? null;

  if (!bestBase || bestBase.score < 0.58) {
    return {
      priceUsd: null,
      baseRow: null,
      deltaRows: [],
      includedRows: [],
      reviewReasons: ['base-price-row-unresolved'],
      confidence: bestBase?.score ?? 0,
    };
  }

  if (baseCandidates[1] && Math.abs(baseCandidates[0].score - baseCandidates[1].score) <= 0.05) {
    reviewReasons.push('base-price-row-ambiguous');
  }

  const baseRowFamily = buildIpeCanonicalTokenSetFromPriceRow(bestBase.row).systemFamily;
  const baseAlreadyIncludesDownpipe = baseRowFamily === 'full-system' || baseRowFamily === 'header-back';

  const eligibleDeltaPool: IpeParsedPriceListRow[] = [];

  // For Full System variants whose base is cat-back, pull the matching downpipe
  // from the absolute rows (some catalogs price downpipes as standalone absolutes).
  if (context.isFullSystem && !baseAlreadyIncludesDownpipe) {
    const downpipeAbsolutes = absoluteRowsAll.filter((row) => {
      const tokens = buildIpeCanonicalTokenSetFromPriceRow(row);
      const fam = tokens.systemFamily;
      if (fam !== 'downpipe' && fam !== 'header' && fam !== 'header-back') return false;
      const { eligible } = rowMatchesVariantContext(row, context);
      return eligible;
    });
    eligibleDeltaPool.push(...downpipeAbsolutes);
  }

  for (const row of relativeRowsAll) {
    const { eligible } = rowMatchesVariantContext(row, context);
    if (eligible) eligibleDeltaPool.push(row);
  }

  const selectedDeltaRows: IpeParsedPriceListRow[] = [];
  const usedGroups = new Set<string>();
  for (const entry of eligibleDeltaPool
    .map((row) => ({
      row,
      score: scoreVariantRowCandidate(variantTokens, buildIpeCanonicalTokenSetFromPriceRow(row), 'delta'),
    }))
    .filter((entry) => entry.score >= 0.45)
    .sort((left, right) => right.score - left.score)) {
    const group = featureGroupForRow(entry.row);
    if (usedGroups.has(group)) continue;
    usedGroups.add(group);
    selectedDeltaRows.push(entry.row);
  }

  const attachedIncludedRows = includedRows.filter((row) => {
    const score = scoreVariantRowCandidate(variantTokens, buildIpeCanonicalTokenSetFromPriceRow(row), 'included');
    return score >= 0.45;
  });

  const deltaTotal = selectedDeltaRows.reduce((sum, row) => {
    const usd = row.price_kind === 'absolute'
      ? Number(row.retail_usd ?? row.msrp_usd ?? 0)
      : Number(row.msrp_usd ?? 0);
    return sum + usd;
  }, 0);

  return {
    priceUsd: Number((Number(bestBase.row.retail_usd ?? 0) + deltaTotal).toFixed(2)),
    baseRow: bestBase.row,
    deltaRows: selectedDeltaRows,
    includedRows: attachedIncludedRows,
    reviewReasons,
    confidence: bestBase.score,
  };
}

export function buildIpeSyntheticVariantSku(handle: string, optionSignature: string) {
  const digest = createHash('sha1').update(`${handle}::${optionSignature}`).digest('hex').slice(0, 8).toUpperCase();
  return `IPE-${normalizeText(handle).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()}-${digest}`;
}

export function deriveIpeCategoryLabels(rows: readonly IpeParsedPriceListRow[]) {
  const families = rows
    .map((row) => buildIpeCanonicalTokenSetFromPriceRow(row).systemFamily)
    .filter((value): value is string => Boolean(value));

  if (families.some((family) => family === 'upgrade' || family === 'tips')) {
    return { en: 'Accessories', ua: 'Аксесуари' };
  }
  if (families.some((family) => family === 'downpipe' || family === 'header' || family === 'header-back')) {
    return { en: 'Downpipes & Headers', ua: 'Даунпайпи та колектори' };
  }
  return { en: 'Exhaust Systems', ua: 'Вихлопні системи' };
}

export function translateVehicleMakeToUa(value: string | null | undefined) {
  switch (value) {
    case 'Aston Martin':
      return 'Aston Martin';
    case 'Audi':
      return 'Audi';
    case 'Bentley':
      return 'Bentley';
    case 'BMW':
      return 'BMW';
    case 'Ferrari':
      return 'Ferrari';
    case 'Ford':
      return 'Ford';
    case 'Jaguar':
      return 'Jaguar';
    case 'Lamborghini':
      return 'Lamborghini';
    case 'Land Rover':
      return 'Land Rover';
    case 'Lexus':
      return 'Lexus';
    case 'Maserati':
      return 'Maserati';
    case 'McLaren':
      return 'McLaren';
    case 'Mercedes-Benz':
      return 'Mercedes-Benz';
    case 'MINI':
      return 'MINI';
    case 'Nissan':
      return 'Nissan';
    case 'Porsche':
      return 'Porsche';
    case 'Rolls-Royce':
      return 'Rolls-Royce';
    case 'Subaru':
      return 'Subaru';
    case 'Toyota':
      return 'Toyota';
    case 'Volkswagen':
      return 'Volkswagen';
    default:
      return value ?? '';
  }
}

export function serializeVariantMapForMetafield(
  product: IpeOfficialProductSnapshot,
  variants: Array<{
    title: string;
    sku: string;
    priceUsd: number | null;
    optionValues: string[];
    baseSku: string | null;
    deltaSkus: string[];
    reviewReasons: string[];
  }>
) {
  return JSON.stringify(
    {
      handle: product.handle,
      variants,
    },
    null,
    2
  );
}
