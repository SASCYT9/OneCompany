export const normalizeBrandName = (value: string): string => {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

const INVERT_BRANDS_NORMALIZED = new Set(
  [
    'ABT',
    'BRABUS',
    'AC Schnitzer',
    'ADRO',
    'Airlift',
    'Akrapovic',
    'AMS',
    'ANRKY',
    'AVANTGARDE',
    'BRIXTON',
    'CAPRISTO',
    'DUKE',
    'KOTOUC',
    'Libery Walk',
    'Liberty Walk',
    'OneCompany FORGED',
    'RYFT',
    'VF Engineering',
    'WheelForce',
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

export const shouldInvertBrand = (brandName: string | undefined | null): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped = INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, '')] ?? INVERT_BRAND_ALIASES[normalized] ?? normalized;

  return INVERT_BRANDS_NORMALIZED.has(mapped);
};
