import type { ShopProduct } from '@/lib/shopCatalog';

type OhlinsCatalogProduct = Pick<ShopProduct, 'slug' | 'title' | 'shortDescription'>;

export const OHLINS_SLUG_PREFIX_TO_MAKE: Record<string, string> = {
  aus: 'Audi',
  auv: 'Audi',
  alv: 'Alpine',
  bms: 'BMW',
  bmv: 'BMW',
  bmz: 'BMW',
  fos: 'Ford',
  fov: 'Ford',
  hos: 'Honda',
  hov: 'Honda',
  hys: 'Hyundai',
  inv: 'INEOS',
  isv: 'Isuzu',
  jev: 'Jeep',
  les: 'Lexus',
  lof: 'Lotus',
  lov: 'Lotus',
  mas: 'Maserati',
  mcs: 'Mini',
  mev: 'Mercedes-Benz',
  mes: 'Mercedes-Benz',
  mis: 'Mitsubishi',
  mir: 'Mitsubishi',
  miz: 'Mitsubishi',
  nis: 'Nissan',
  nir: 'Nissan',
  pof: 'Porsche',
  por: 'Porsche',
  pos: 'Porsche',
  pov: 'Porsche',
  poz: 'Porsche',
  sef: 'SEAT',
  sur: 'Subaru',
  sus: 'Subaru',
  suv: 'Suzuki',
  tes: 'Tesla',
  tos: 'Toyota',
  tov: 'Toyota',
  vaf: 'Volkswagen/Audi',
  vws: 'Volkswagen',
};

export const OHLINS_UNIVERSAL_PRODUCT_PATTERNS: RegExp[] = [
  /\bformula\s+student\b/i,
  /\bhelper\s+spring\b/i,
  /\bsprings?\b/i,
  /\bwrench\b/i,
  /\bspanner\b/i,
  /\bпідшипник\b/i,
  /\bbearing\b/i,
  /\bdust\s+boot\b/i,
  /\bbump\s+stop\b/i,
  /\bbumper\b/i,
  /\bcontrol\s+cable\b/i,
  /\bcontrol\s+lever\b/i,
  /\badjust(?:ment|er)\b/i,
  /\bend\s+(?:eyelet|bracket)\b/i,
  /\bhex\s+nut\b/i,
  /\bwheel\s+spacer\b/i,
  /\bspacer\b/i,
  /\bbushing\b/i,
  /\bgasket\b/i,
  /\badapter\s+kit\b/i,
  /\bstabilizer\s+bracket\b/i,
];

export const OHLINS_CATEGORY_PATTERNS: { match: RegExp; label: string; labelUa: string }[] = [
  { match: /road\s*[&]\s*track|койловер/i, label: 'Road & Track', labelUa: 'Road & Track' },
  { match: /advanced\s*track\s*day|trackday/i, label: 'Advanced Trackday', labelUa: 'Advanced Trackday' },
  { match: /motorsport|grp?\s*n|cup|tcr|race/i, label: 'Motorsport', labelUa: 'Motorsport' },
  { match: /off[\s-]*road|adventure|hilux|jimny|grenadier/i, label: 'Off-Road & Adventure', labelUa: 'Off-Road & Adventure' },
  { match: /електронн|electronic|edc|pasm/i, label: 'Electronics (EDC)', labelUa: 'Електроніка (EDC)' },
  { match: /shock\s+absorber|damper/i, label: 'Shock Absorbers', labelUa: 'Амортизатори' },
  {
    match:
      /верхня опора|top mount|strut mount|upper mount|shock mount|adapter kit|mount kit|deactivation kit|expansion package|підшипник|bearing|dust boot|bump stop|bumper|gasket|stabilizer bracket|end eyelet|end bracket|adjust(?:ment|er)|control cable|control lever|bracket|bushing|hex nut|wheel spacer|spacer/i,
    label: 'Mounts & Hardware',
    labelUa: 'Опори та кріплення',
  },
  { match: /пружин|spring/i, label: 'Springs', labelUa: 'Пружини' },
  { match: /wrench|spanner|tool/i, label: 'Tools & Accessories', labelUa: 'Інструмент та аксесуари' },
];

const OHLINS_TITLE_BRANDS = [
  'BMW',
  'Porsche',
  'Audi',
  'Chevrolet',
  'Mercedes',
  'Ford',
  'Honda',
  'Nissan',
  'Toyota',
  'Subaru',
  'Mitsubishi',
  'Volkswagen',
  'VW',
  'Hyundai',
  'Lexus',
  'Mazda',
  'Mini',
  'Lotus',
  'Alpine',
  'Maserati',
  'Tesla',
  'SEAT',
  'Jeep',
  'Suzuki',
  'INEOS',
  'Isuzu',
] as const;

function getOhlinsTitle(product: Pick<OhlinsCatalogProduct, 'title'>) {
  return `${product.title?.en ?? ''} ${product.title?.ua ?? ''}`.trim();
}

export function detectOhlinsMake(product: Pick<OhlinsCatalogProduct, 'slug' | 'title'>): string | null {
  const slugBody = product.slug.replace(/^ohlins-/, '');
  const prefix = slugBody.split('-')[0]?.toLowerCase();
  if (prefix && OHLINS_SLUG_PREFIX_TO_MAKE[prefix]) {
    return OHLINS_SLUG_PREFIX_TO_MAKE[prefix];
  }

  const title = getOhlinsTitle(product);
  for (const brand of OHLINS_TITLE_BRANDS) {
    if (title.toUpperCase().includes(brand.toUpperCase())) {
      if (brand === 'VW') return 'Volkswagen';
      if (brand === 'Mercedes') return 'Mercedes-Benz';
      return brand;
    }
  }

  if (/\bVAG\b/i.test(title)) {
    return 'Volkswagen/Audi';
  }

  if (/\bCOOPER\b|\bCLUBMAN\b|\bROADSTER\b|\bCOUNTRYMAN\b/i.test(title)) {
    return 'Mini';
  }

  if (OHLINS_UNIVERSAL_PRODUCT_PATTERNS.some((pattern) => pattern.test(title))) {
    return 'Universal';
  }

  return null;
}

export function detectOhlinsCategory(
  product: Pick<OhlinsCatalogProduct, 'title' | 'shortDescription'>
): { label: string; labelUa: string } | null {
  const text = `${product.title?.en ?? ''} ${product.title?.ua ?? ''} ${product.shortDescription?.en ?? ''}`;
  for (const pattern of OHLINS_CATEGORY_PATTERNS) {
    if (pattern.match.test(text)) {
      return { label: pattern.label, labelUa: pattern.labelUa };
    }
  }

  return null;
}
