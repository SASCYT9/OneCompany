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
    'Libery Walk',
    'Liberty Walk',
    'RYFT',
    'VF Engineering',
    'WheelForce',
    '1221 wheels',
    'AC Schnitzer',
    'Avantgarde Wheels',
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
