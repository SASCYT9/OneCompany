export const normalizeBrandName = (value: string): string => {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

import { isDarkLogo } from '@/lib/darkLogos';
import { isSolidLogo } from '@/lib/solidLogos';

const INVERT_BRANDS_NORMALIZED = new Set(
  [
    'ABT',
    'BRABUS',
    'AC Schnitzer',
    'ADRO',
    'Airlift',
    'AVANTGARDE',
    'CAPRISTO',
    'KOTOUC',
    'LEIB Engineering',
    'Libery Walk',
    'Liberty Walk',
    'Oettinger',
    'RYFT',
    'VF Engineering',
    'WheelForce',
    '1221 wheels',
    'AC Schnitzer',
    'Avant Garde Wheels',
    // Added 2026-05-07: dark logos misclassified as also-solid by the auto
    // detector, so the runtime !isSolid guard suppresses auto-invert. Force
    // invert via the manual list — they all have dark wordmarks on dark
    // backgrounds otherwise.
    '1016 Industries',
    'AEM Factory',
    'BMC filters',
    'Cobb tuning',
    'Melotti Racing',
    'Raliw Forged',
    'Remus',
    'Rizoma',
    'RS-R',
    'STOPART ceramic',
    'Vargas Turbo',
    'Verus Engineering',
    'XDI fuel systems',
    // NOTE: Onyx Concept, Fore Innovations, BootMod3 are NOT inverted —
    // their source PNGs are essentially solid dark rectangles with no
    // real logo content (≥85% near-black pixels). Inverting them produces
    // a glaring white block. Better to leave them dark (mostly invisible
    // on the dark theme) until proper logo files are sourced. See issues
    // #19, #24, #26 for follow-up.
  ].map(normalizeBrandName)
);

const INVERT_BRAND_ALIASES: Record<string, string> = {
  // common variants / typos
  'libery walk': 'liberty walk',
  'liberywalk': 'liberty walk',
  'libertywalk': 'liberty walk',

  // brand naming differences
  'abt sportsline': 'abt',
  'ac schnitzer': 'ac schnitzer',
};

const NO_INVERT_BRANDS_NORMALIZED = new Set(
  [
    'GTHaus',
    'Hardrace',
    'Extreme Performance Tyres',
  ].map(normalizeBrandName)
);

export const shouldInvertBrand = (brandName: string | undefined | null): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped = INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, '')] ?? INVERT_BRAND_ALIASES[normalized] ?? normalized;

  return INVERT_BRANDS_NORMALIZED.has(mapped);
};

export const shouldInvertBrandOrLogo = (
  brandName: string | undefined | null,
  logoPath?: string | null
): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped = INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, '')] ?? INVERT_BRAND_ALIASES[normalized] ?? normalized;
  if (NO_INVERT_BRANDS_NORMALIZED.has(mapped)) return false;

  // Manual brand list always wins
  if (shouldInvertBrand(brandName)) return true;

  // Auto-invert: only for dark logos that are NOT solid-background
  if (logoPath && isDarkLogo(logoPath) && !isSolidLogo(logoPath)) {
    return true;
  }

  return false;
};

const SMART_INVERT_BRANDS_NORMALIZED = new Set(
  [
    '3D Design',
    'BE bearings',
    'Marchesini',
    'SparkExhaust',
  ].map(normalizeBrandName)
);

export const shouldSmartInvertBrand = (brandName: string | undefined | null): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped = INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, '')] ?? INVERT_BRAND_ALIASES[normalized] ?? normalized;

  return SMART_INVERT_BRANDS_NORMALIZED.has(mapped);
};
