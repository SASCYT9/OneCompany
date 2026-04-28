/**
 * Cross-shop fitment matcher.
 *
 * Given a product on one brand store, find products from OTHER brand stores
 * that fit the same vehicle (e.g. an ADRO M3 G80 bumper → iPE M3 G80 exhaust,
 * Akrapovic M3 G80 system, Ohlins M3 G80 coilovers, GiroDisc M3 G80 rotors).
 *
 * Each brand has its own fitment extractor (Adro, iPE, CSF, GiroDisc, Ohlins,
 * Akrapovic, etc). This module delegates to them when the product belongs to
 * that brand, and falls back to generic title-based detection otherwise.
 *
 * Urban, Brabus, and Turn14 are intentionally excluded from cross-shop
 * recommendations on both sides — they have bespoke catalogs whose fitment
 * signals don't align with the rest of the lineup.
 */

import type { ShopProduct } from '@/lib/shopCatalog';
import { detectAdroMakes, detectAdroModels, isAdroProduct } from '@/lib/adroCatalog';
import { resolveIpeVehicleBrand, resolveIpeVehicleModel } from '@/lib/ipeCatalog';
import { extractCsfCatalogFitment } from '@/lib/csfCatalog';
import { detectOhlinsMake } from '@/lib/ohlinsCatalog';
import { extractVehicleBrand, extractVehicleModel } from '@/lib/akrapovicFilterUtils';

/* ── Excluded brands (no recommendations to or from these) ───── */

const EXCLUDED_BRAND_TOKENS = ['urban', 'brabus', 'turn14', 'turn 14'];

export function isExcludedFromCrossShop(product: Pick<ShopProduct, 'brand' | 'vendor'>) {
  const brand = String(product.brand ?? '').trim().toLowerCase();
  const vendor = String(product.vendor ?? '').trim().toLowerCase();
  return EXCLUDED_BRAND_TOKENS.some(
    (token) => brand.includes(token) || vendor.includes(token)
  );
}

/* ── Chassis-code dictionary (shared across brands) ───────────── */

const CHASSIS_CODES = new Set([
  // BMW
  'E30', 'E36', 'E46', 'E82', 'E87', 'E90', 'E91', 'E92', 'E93',
  'F06', 'F10', 'F12', 'F13', 'F15', 'F16', 'F20', 'F22', 'F30',
  'F31', 'F32', 'F33', 'F34', 'F36', 'F40', 'F80', 'F82', 'F83',
  'F85', 'F86', 'F87', 'F90', 'F91', 'F92', 'F93', 'F95', 'F96',
  'F97', 'F98',
  'G01', 'G02', 'G05', 'G06', 'G07', 'G08', 'G11', 'G12', 'G14',
  'G15', 'G16', 'G20', 'G21', 'G22', 'G23', 'G26', 'G29', 'G30',
  'G31', 'G32', 'G42', 'G43', 'G70', 'G80', 'G81', 'G82', 'G83',
  'G87', 'G8X', 'G90',
  // Audi / VW
  'B7', 'B8', 'B8.5', 'B9', 'B9.5', 'C7', 'C8', 'D5', 'PQ35',
  '8V', '8V.1', '8V.2',
  '8Y', '8Y.1', '8Y.2',
  '8S', '8R', '4M', '4G', '4F',
  // VW chassis
  'MQB', 'MK7', 'MK7.5', 'MK8',
  // Porsche
  '991', '991.1', '991.2', '992', '992.1', '992.2', '718', '981',
  '982', '987', '987.1', '987.2', '986', '996', '997', '997.1', '997.2',
  '9YA', '9Y0', '9YB', '9PA', '95B', '95B.1', '95B.2',
  // Mercedes
  'W124', 'W201', 'W202', 'W203', 'W204', 'W205', 'W206',
  'W210', 'W211', 'W212', 'W213', 'W214',
  'W220', 'W221', 'W222', 'W223',
  'W163', 'W164', 'W166', 'W167',
  'W463', 'W464', 'W465', 'W176', 'W177', 'W246', 'W247',
  'C124', 'C140', 'C190', 'C197', 'C217',
  'C167', 'X167',
  'R107', 'R129', 'R171', 'R172', 'R230', 'R231', 'R232',
  // Range Rover / Land Rover
  'L405', 'L460', 'L461', 'L462', 'L494', 'L538', 'L551', 'L663',
  // Lamborghini / Ferrari / McLaren / others
  'LP610', 'LP640', 'LP700', 'LP740', 'LP750',
  // Toyota / Subaru / Honda / Nissan
  'A90', 'A91', 'GR86', 'AE86', 'JZA80', 'JZA90',
  'FK8', 'FL5', 'FK7', 'FN2',
  'NA', 'NB', 'NC', 'ND',
  // Subaru WRX/STI generations
  'GC', 'GD', 'GE', 'GH', 'GR', 'GV', 'VA', 'VB',
  'VAB', 'VAG', 'VAF',
  // Subaru BRZ / Toyota 86 (sibling chassis)
  'ZN6', 'ZN8', 'ZD8', 'ZC6', 'ZC32',
  'JCW',
  'R35', 'RZ34', 'Z34', 'Z33',
]);

/* ── Make detection (shared) ──────────────────────────────────── */

const MAKE_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'BMW', patterns: [/\bBMW\b/i, /\bM[2-5]\b/i, /\bX[3-6]M\b/i] },
  { label: 'Porsche', patterns: [/\bporsche\b/i, /\b911\b/i, /\b992\b/i, /\b991\b/i, /\b718\b/i, /\bcayenne\b/i, /\bpanamera\b/i, /\bmacan\b/i, /\btaycan\b/i] },
  { label: 'Toyota', patterns: [/\btoyota\b/i, /\bsupra\b/i, /\bgr86\b/i, /\bgr\s*yaris\b/i, /\bgr\s*corolla\b/i] },
  { label: 'Subaru', patterns: [/\bsubaru\b/i, /\bbrz\b/i, /\bsti\b/i, /\bwrx\b/i] },
  { label: 'Tesla', patterns: [/\btesla\b/i, /\bmodel\s*[3sxy]\b/i] },
  { label: 'Ford', patterns: [/\bford\b/i, /\bmustang\b/i, /\bfocus\s*rs\b/i] },
  { label: 'Kia', patterns: [/\bkia\b/i, /\bstinger\b/i] },
  { label: 'Honda', patterns: [/\bhonda\b/i, /\bcivic\b/i, /\btype[-\s]r\b/i] },
  { label: 'Hyundai', patterns: [/\bhyundai\b/i, /\belantra\b/i, /\bveloster\b/i, /\bi30\s*n\b/i] },
  { label: 'Genesis', patterns: [/\bgenesis\b/i, /\bgv70\b/i, /\bgv80\b/i, /\bg70\b/i] },
  { label: 'Chevrolet', patterns: [/\bchevrolet\b/i, /\bcorvette\b/i, /\bcamaro\b/i] },
  { label: 'Audi', patterns: [/\baudi\b/i, /\brs[3-7]\b/i, /\brsq[3-8]\b/i, /\br8\b/i, /\btt\s*rs\b/i] },
  { label: 'Volkswagen', patterns: [/\bvolkswagen\b/i, /\bgolf\s*r\b/i, /\bgolf\s*gti\b/i, /\b\bgolf\b/i] },
  { label: 'Mercedes-AMG', patterns: [/\bmercedes\s*amg\b/i, /\bamg\s*(c63|e63|gt|s63|cla|gle|gls)\b/i, /\bc63\b/i, /\be63\b/i, /\bg63\b/i, /\bgt\s*63\b/i] },
  { label: 'Mercedes-Benz', patterns: [/\bmercedes\s*benz\b/i, /\bmercedes-benz\b/i, /\bmercedes\b/i] },
  { label: 'Lamborghini', patterns: [/\blamborghini\b/i, /\baventador\b/i, /\bhuracan\b/i, /\burus\b/i, /\brevuelto\b/i] },
  { label: 'McLaren', patterns: [/\bmclaren\b/i, /\b570s\b/i, /\b600lt\b/i, /\b720s\b/i, /\b765lt\b/i, /\bartura\b/i] },
  { label: 'Ferrari', patterns: [/\bferrari\b/i, /\b458\b/i, /\b488\b/i, /\bf8\b/i, /\b296\b/i, /\b812\b/i, /\bportofino\b/i, /\bpurosangue\b/i, /\broma\b/i] },
  { label: 'Maserati', patterns: [/\bmaserati\b/i, /\bgranturismo\b/i, /\bgrecale\b/i, /\blevante\b/i] },
  { label: 'Aston Martin', patterns: [/\baston\s*martin\b/i, /\bvantage\b/i, /\bdb11\b/i, /\bdbx\b/i] },
  { label: 'Nissan', patterns: [/\bnissan\b/i, /\bgt-r\b/i, /\bgtr\b/i, /\b370z\b/i, /\b350z\b/i, /\bz\s*nismo\b/i] },
  { label: 'Mitsubishi', patterns: [/\bmitsubishi\b/i, /\blancer\s*evo\b/i] },
  { label: 'Mazda', patterns: [/\bmazda\b/i, /\bmx[-\s]?5\b/i, /\bmiata\b/i] },
  { label: 'Lotus', patterns: [/\blotus\b/i, /\belise\b/i, /\bexige\b/i, /\bemira\b/i, /\bevora\b/i] },
];

/* ── Public API ───────────────────────────────────────────────── */

export type Fitment = {
  /** Canonical make label, e.g. "BMW", "Porsche". */
  make: string | null;
  /** Distinct model labels (lowercased & deduped). */
  models: string[];
  /** Chassis codes (uppercased & deduped). */
  chassisCodes: string[];
};

function uniq<T>(values: ReadonlyArray<T>): T[] {
  return Array.from(new Set(values));
}

function lower(value: string) {
  return value.trim().toLowerCase();
}

/** Strip year ranges, "from"/"to" connectives, and excess whitespace from a
 *  model label so "S Class W221 2005 To 2013" → "S Class W221". */
function stripYearNoise(value: string) {
  return value
    .replace(/\b(?:from|to|до|з)\b/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)?\d{2,4}/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchText(product: ShopProduct): string {
  return [
    product.title?.en,
    product.title?.ua,
    product.collection?.en,
    product.collection?.ua,
    ...(product.tags ?? []),
    product.slug,
    product.sku,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ');
}

function detectMakeGeneric(text: string): string | null {
  for (const entry of MAKE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return entry.label;
    }
  }
  return null;
}

function extractChassisFromText(text: string): string[] {
  const found = new Set<string>();
  // Match in parens: (G80), (G80/G81), (F82, F83)
  const parens = text.matchAll(/\(([^)]{1,80})\)/g);
  for (const match of parens) {
    const inside = match[1];
    const tokens = inside.split(/[/,;\s]+/);
    for (const raw of tokens) {
      const upper = raw.trim().toUpperCase().replace(/[.,]+$/, '');
      if (CHASSIS_CODES.has(upper)) {
        found.add(upper);
      }
    }
  }
  // Bare codes anywhere in text (G80, F82 even without parens)
  const bareTokens = text.toUpperCase().split(/[^A-Z0-9.]+/);
  for (const token of bareTokens) {
    if (CHASSIS_CODES.has(token)) {
      found.add(token);
    }
  }
  return [...found];
}

function extractTagModels(product: ShopProduct): string[] {
  const tags = product.tags ?? [];
  const models: string[] = [];
  for (const tag of tags) {
    const normalized = String(tag ?? '').trim().toLowerCase();
    if (normalized.startsWith('car_model:')) {
      models.push(normalized.slice('car_model:'.length).replace(/[-_]/g, ' '));
    }
  }
  return models;
}

function extractTagMake(product: ShopProduct): string | null {
  const tags = product.tags ?? [];
  // Pass 1: prefer the dedicated `car_make:` tag.
  for (const tag of tags) {
    const normalized = String(tag ?? '').trim().toLowerCase();
    if (!normalized.startsWith('car_make:')) continue;
    const slug = normalized.slice('car_make:'.length);
    const match = MAKE_PATTERNS.find((entry) => entry.label.toLowerCase() === slug);
    if (match) return match.label;
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  // Pass 2: fall back to `brand:` only when it names a known vehicle make.
  // Some catalogs (Burger) overload `brand:bmw` to mean vehicle make; others
  // (Girodisc) use `brand:girodisc` for the vendor — that latter case must NOT
  // be misread as a vehicle make.
  for (const tag of tags) {
    const normalized = String(tag ?? '').trim().toLowerCase();
    if (!normalized.startsWith('brand:')) continue;
    const slug = normalized.slice('brand:'.length);
    const match = MAKE_PATTERNS.find((entry) => entry.label.toLowerCase() === slug);
    if (match) return match.label;
  }
  return null;
}

/**
 * Extract fitment from any product, delegating to the brand-specific
 * extractor when available and falling back to generic detection.
 */
export function extractProductFitment(product: ShopProduct): Fitment {
  const text = buildSearchText(product);
  const brand = String(product.brand ?? '').trim().toLowerCase();

  let make: string | null = null;
  let models: string[] = [];
  let chassis: string[] = [];

  // 1. Brand-specific extractor first (most accurate)
  if (isAdroProduct(product)) {
    const adroMakes = detectAdroMakes(product).filter((m) => m && m !== 'Other');
    make = adroMakes[0] ?? null;
    models = detectAdroModels(product).filter((m) => m && m !== 'Other');
  } else if (brand.includes('csf')) {
    const fitment = extractCsfCatalogFitment(product);
    make = fitment.make;
    models = fitment.models;
    chassis = fitment.chassisCodes;
  } else if (brand.includes('ohlins') || brand.includes('öhlins')) {
    make = detectOhlinsMake(product);
  } else if (brand === 'akrapovic' || brand === 'akrapovič') {
    const tokenBrand = extractVehicleBrand(product.title?.en ?? '');
    make = tokenBrand;
    const tokenModel = extractVehicleModel(product.title?.en ?? '');
    if (tokenModel) models = [tokenModel];
  } else if (brand.includes('ipe') || brand.includes('innotech')) {
    make = resolveIpeVehicleBrand(product);
    const ipeModel = resolveIpeVehicleModel(product);
    if (ipeModel) models = [ipeModel];
  } else if (brand.includes('girodisc')) {
    make = extractTagMake(product);
    models = extractTagModels(product);
  }

  // 2. Generic fallbacks for anything still missing
  if (!make) make = extractTagMake(product) ?? detectMakeGeneric(text);
  if (models.length === 0) models = extractTagModels(product);
  if (chassis.length === 0) chassis = extractChassisFromText(text);

  return {
    make,
    models: uniq(
      models
        .map((m) => stripYearNoise(lower(m)))
        .filter(Boolean)
    ),
    chassisCodes: uniq(chassis.map((c) => c.toUpperCase()).filter(Boolean)),
  };
}

/* ── Cross-shop matching ──────────────────────────────────────── */

const SCORE_CHASSIS = 60;
const SCORE_MODEL_EXACT = 30;
const SCORE_MODEL_TOKEN = 18;
const SCORE_MAKE = 6;

/** Normalize a model label so "M3 (G80)" and "M3 G80" and "m3-g80" compare equal. */
function normalizeModelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()/]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coarse model token (e.g. "m3" from "m3 g80") for partial matches.
 *  Returns '' for tokens shorter than 3 chars OR pure year-style numbers,
 *  to avoid false matches like the "S" suffix in "Mercedes S-Class" hitting
 *  every "Porsche 911 S". */
function modelHeadToken(value: string): string {
  const normalized = normalizeModelKey(value);
  for (const token of normalized.split(' ').filter(Boolean)) {
    if (token.length < 3) continue;
    if (/^(19|20)\d{2}$/.test(token)) continue;
    if (token === 'class' || token === 'series') continue;
    return token;
  }
  return '';
}

/** Threshold beyond which a candidate is considered "fits-everything" — used
 *  to push generic catch-all parts below truly chassis-specific matches. */
const SPECIFICITY_THRESHOLD = 8;
const SPECIFICITY_PENALTY = 2;

function scoreMatch(target: Fitment, candidate: Fitment): number {
  let score = 0;
  if (target.make && candidate.make && target.make === candidate.make) {
    score += SCORE_MAKE;
  }

  // Chassis match is the strongest signal — any shared code = same platform.
  let chassisHits = 0;
  for (const code of target.chassisCodes) {
    if (candidate.chassisCodes.includes(code)) {
      score += SCORE_CHASSIS;
      chassisHits += 1;
    }
  }

  // Model match: exact normalized hit > head-token-only hit
  const targetKeys = new Set(target.models.map(normalizeModelKey).filter(Boolean));
  const candidateKeys = new Set(candidate.models.map(normalizeModelKey).filter(Boolean));
  let exactHits = 0;
  let tokenHits = 0;
  for (const key of targetKeys) {
    if (candidateKeys.has(key)) {
      exactHits += 1;
      continue;
    }
    const headToken = modelHeadToken(key);
    if (!headToken) continue;
    if ([...candidateKeys].some((cand) => modelHeadToken(cand) === headToken)) {
      tokenHits += 1;
    }
  }
  score += exactHits * SCORE_MODEL_EXACT + tokenHits * SCORE_MODEL_TOKEN;

  // Hard constraint: when the target has chassis codes (specific platform like
  // M3 G80), require the candidate to share at least one chassis code OR an
  // exact-normalized model. Otherwise generic-fit parts (e.g. Burger BMS Boost
  // Tap for "all M-series") flood out the chassis-specific matches.
  if (target.chassisCodes.length > 0 && chassisHits === 0 && exactHits === 0) {
    return 0;
  }

  // Specificity penalty: a candidate that fits 30+ chassis codes is technically
  // compatible but not "made for your car". Push it below truly platform-
  // specific matches like an iPE exhaust dedicated to M3/M4 G80/G82.
  if (candidate.chassisCodes.length > SPECIFICITY_THRESHOLD) {
    score -= (candidate.chassisCodes.length - SPECIFICITY_THRESHOLD) * SPECIFICITY_PENALTY;
  }

  return Math.max(0, score);
}

export type CrossShopMatch = {
  product: ShopProduct;
  brand: string;
  score: number;
  fitment: Fitment;
};

export type CrossShopGroup = {
  /** Lowercased brand key (e.g. "ipe", "ohlins"). */
  brandKey: string;
  /** Display label as it appears on the product (e.g. "iPE", "Öhlins"). */
  brandLabel: string;
  matches: CrossShopMatch[];
};

const BRAND_DISPLAY_OVERRIDES: Record<string, string> = {
  ipe: 'iPE',
  'innotech performance exhaust': 'iPE',
  ohlins: 'Öhlins',
  öhlins: 'Öhlins',
  girodisc: 'GiroDisc',
  csf: 'CSF Racing',
  'csf racing': 'CSF Racing',
  do88: 'DO88',
  adro: 'ADRO',
  akrapovic: 'Akrapovič',
  akrapovič: 'Akrapovič',
  racechip: 'RaceChip',
  burger: 'Burger Motorsports',
  'burger motorsports': 'Burger Motorsports',
};

function brandDisplay(rawBrand: string): { key: string; label: string } {
  const key = rawBrand.trim().toLowerCase();
  const label = BRAND_DISPLAY_OVERRIDES[key] ?? rawBrand.trim();
  return { key, label };
}

/**
 * Find products from OTHER brands that fit the same vehicle as `currentProduct`.
 * Returns groups by brand, each capped at `perBrand` matches, total capped at
 * `totalLimit` products.
 */
export function findCrossShopFitmentMatches(
  currentProduct: ShopProduct,
  allProducts: ReadonlyArray<ShopProduct>,
  options: { perBrand?: number; totalLimit?: number; minScore?: number } = {}
): CrossShopGroup[] {
  // Default minScore = SCORE_MODEL_TOKEN: require at least a head-token model
  // hit OR a chassis match. Make-only (BMW + BMW) doesn't qualify, since
  // that pulls in unrelated parts for any BMW.
  const { perBrand = 3, totalLimit = 12, minScore = SCORE_MODEL_TOKEN } = options;

  if (isExcludedFromCrossShop(currentProduct)) return [];

  const targetFitment = extractProductFitment(currentProduct);
  if (!targetFitment.make && targetFitment.models.length === 0 && targetFitment.chassisCodes.length === 0) {
    return [];
  }

  const currentBrandKey = String(currentProduct.brand ?? '').trim().toLowerCase();
  const seenSlugs = new Set<string>([currentProduct.slug]);
  const allMatches: CrossShopMatch[] = [];

  for (const candidate of allProducts) {
    if (!candidate?.slug || seenSlugs.has(candidate.slug)) continue;
    if (isExcludedFromCrossShop(candidate)) continue;

    const candidateBrandKey = String(candidate.brand ?? '').trim().toLowerCase();
    if (!candidateBrandKey || candidateBrandKey === currentBrandKey) continue;

    const candidateFitment = extractProductFitment(candidate);
    const score = scoreMatch(targetFitment, candidateFitment);
    if (score < minScore) continue;

    seenSlugs.add(candidate.slug);
    allMatches.push({
      product: candidate,
      brand: candidate.brand ?? '',
      score,
      fitment: candidateFitment,
    });
  }

  // Primary: higher score wins. Tiebreak: prefer the candidate with the
  // narrower chassis list (i.e. truly platform-specific over multi-chassis).
  allMatches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.fitment.chassisCodes.length - b.fitment.chassisCodes.length;
  });

  // Group by brand, cap each, then cap total
  const grouped = new Map<string, CrossShopGroup>();
  let totalKept = 0;
  for (const match of allMatches) {
    if (totalKept >= totalLimit) break;
    const { key, label } = brandDisplay(match.brand);
    let group = grouped.get(key);
    if (!group) {
      group = { brandKey: key, brandLabel: label, matches: [] };
      grouped.set(key, group);
    }
    if (group.matches.length >= perBrand) continue;
    group.matches.push(match);
    totalKept += 1;
  }

  // Order groups by their best match score (descending)
  const groups = [...grouped.values()].sort((a, b) => {
    const aBest = a.matches[0]?.score ?? 0;
    const bBest = b.matches[0]?.score ?? 0;
    return bBest - aBest;
  });

  return groups;
}

/**
 * Capitalize a model label, uppercasing any embedded chassis codes
 * (G80, F82, 992, etc.) regardless of separators. Handles "m3 (g80 / g81)"
 * and "m3 g80" alike.
 */
export function prettifyVehicleLabel(value: string): string {
  // Step 1: uppercase any token that matches a known chassis code, anywhere.
  const withChassisUpper = value.replace(/[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?/g, (token) => {
    const upper = token.toUpperCase();
    return CHASSIS_CODES.has(upper) ? upper : token;
  });
  // Step 2: title-case the rest by capitalizing the first letter of each word
  // group (separated by space, slash, dash, or paren).
  return withChassisUpper.replace(/(?:^|[\s\/(\-])([a-z])/g, (match) => match.toUpperCase());
}

function prettifyModelLabel(value: string): string {
  return prettifyVehicleLabel(value);
}

/**
 * Convenience helper: returns the headline summarizing what vehicle the
 * cross-shop section is targeting (e.g. "Підходить вашому BMW M3 (G80)").
 */
export function buildCrossShopHeading(
  fitment: Fitment,
  locale: 'ua' | 'en'
): string {
  const isUa = locale === 'ua';
  const lead = isUa ? 'Також підходить:' : 'Also fits:';
  const parts: string[] = [];
  if (fitment.make) parts.push(fitment.make);

  // Pick the most specific model label (longest one likely contains chassis)
  if (fitment.models.length > 0) {
    const best = [...fitment.models].sort((a, b) => b.length - a.length)[0];
    parts.push(prettifyModelLabel(best));
  } else if (fitment.chassisCodes.length > 0) {
    parts.push(`(${fitment.chassisCodes[0]})`);
  }

  if (parts.length === 0) {
    return isUa ? 'Може зацікавити з інших магазинів' : 'You may also like from other stores';
  }
  return `${lead} ${parts.join(' ')}`;
}
