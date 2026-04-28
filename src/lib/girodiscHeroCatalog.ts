import type { ShopProduct } from '@/lib/shopCatalog';

/**
 * Server-friendly mirror of the make/model extraction used in the live
 * GirodiscVehicleFilter (`src/app/[locale]/shop/components/GirodiscVehicleFilter.tsx`).
 * Kept here as plain functions so the brand-home can build the quick-finder tree
 * during SSR and hand a small JSON payload to the client component.
 */

const GIRODISC_MAKE_LABELS: Record<string, string> = {
  audi: 'Audi',
  bmw: 'BMW',
  chevrolet: 'Chevrolet',
  corvette: 'Chevrolet',
  dodge: 'Dodge',
  ferrari: 'Ferrari',
  ford: 'Ford',
  honda: 'Honda',
  lamborghini: 'Lamborghini',
  lotus: 'Lotus',
  maserati: 'Maserati',
  mclaren: 'McLaren',
  mercedes: 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  mitsubishi: 'Mitsubishi',
  nissan: 'Nissan',
  porsche: 'Porsche',
  subaru: 'Subaru',
  toyota: 'Toyota',
  'alfa-romeo': 'Alfa Romeo',
};

const GIRODISC_MODEL_MAKE_TERMS: Record<string, string[]> = {
  audi: ['audi'],
  bmw: ['bmw'],
  chevrolet: ['chevrolet', 'corvette'],
  corvette: ['chevrolet', 'corvette'],
  dodge: ['dodge'],
  ferrari: ['ferrari'],
  ford: ['ford'],
  honda: ['honda'],
  lamborghini: ['lamborghini'],
  lotus: ['lotus'],
  maserati: ['maserati'],
  mclaren: ['mclaren'],
  mercedes: ['mercedes-benz', 'mercedes benz', 'mercedes', 'amg'],
  'mercedes-benz': ['mercedes-benz', 'mercedes benz', 'mercedes', 'amg'],
  mitsubishi: ['mitsubishi'],
  nissan: ['nissan'],
  porsche: ['porsche'],
  subaru: ['subaru'],
  toyota: ['toyota'],
  'alfa-romeo': ['alfa romeo', 'alfa-romeo', 'alfa'],
};

const GIRODISC_HERO_MAKE_PRIORITY = [
  'Porsche', 'BMW', 'Mercedes-Benz', 'Audi', 'Ferrari', 'Chevrolet',
  'Lamborghini', 'McLaren', 'Ford', 'Nissan', 'Toyota', 'Subaru',
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeGirodiscToken(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatGirodiscLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      if (
        /^(bmw|amg|gt|gts|gt2|gt3|gt4|gt4rs|gt500|rs|rs3|rs4|rs5|rs6|rs7|rsq8|r8|tt|sti|wrx|z06|z51)$/i.test(
          word
        )
      ) {
        return word.toUpperCase();
      }
      if (/^[a-z]\d/i.test(word) || /^[a-z]{1,3}\d+[a-z]?$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function getGirodiscMakeKey(product: ShopProduct): string | null {
  const makeTag = product.tags?.find((tag) => tag.startsWith('car_make:'));
  if (!makeTag) return null;
  const make = makeTag.split(':')[1];
  return make === 'corvette' ? 'chevrolet' : make;
}

function cleanGirodiscModelLabel(value: string) {
  return value
    .replace(/\b(for|для|dlia)\b/gi, ' ')
    .replace(
      /\b(front|rear|left|right|kit|set|brake|pads?|rotors?|rings?|replacement|racing|endurance|magic|performance)\b/gi,
      ' '
    )
    .replace(/\d{3,4}\s*[xх]\s*\d{2,3}[-\s]*(?:mm|мм|mм|мm)/giu, ' ')
    .replace(/\d{3,4}[-\s]*(?:mm|мм|mм|мm)/giu, ' ')
    .replace(/\b(19|20)\d{2}\s*(?:-\s*(?:\d{2,4})?)?/g, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGirodiscModelsForKey(product: ShopProduct, makeKey: string | null) {
  const taggedModels = (product.tags ?? [])
    .filter((tag) => tag.startsWith('car_model:'))
    .map((tag) => tag.slice('car_model:'.length))
    .map((value) => ({
      key: normalizeGirodiscToken(value),
      label: formatGirodiscLabel(value),
    }));

  if (taggedModels.length > 0) {
    return taggedModels;
  }

  if (!makeKey) return [];

  const terms = GIRODISC_MODEL_MAKE_TERMS[makeKey] ?? [makeKey];
  const sourceText = `${product.title.en ?? ''} ${product.title.ua ?? ''} ${product.slug.replace(
    /-/g,
    ' '
  )}`;
  const lowerSource = sourceText.toLowerCase();
  const segments: string[] = [];

  for (const term of terms) {
    const match = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').exec(sourceText);
    if (!match) continue;

    let segment = sourceText.slice(match.index + match[0].length);
    const nextMakeIndex = Object.values(GIRODISC_MODEL_MAKE_TERMS)
      .flat()
      .filter((otherTerm) => !terms.includes(otherTerm))
      .map((otherTerm) => lowerSource.indexOf(otherTerm, match.index + match[0].length))
      .filter((index) => index > -1)
      .sort((a, b) => a - b)[0];

    if (typeof nextMakeIndex === 'number') {
      segment = sourceText.slice(match.index + match[0].length, nextMakeIndex);
    }

    segments.push(segment);
  }

  const candidates = segments
    .flatMap((segment) => segment.split(/\s+\/\s+|[,;]|(?:\s+\+\s+)/g))
    .map(cleanGirodiscModelLabel)
    .map((value) => value.replace(new RegExp(`^(${terms.map(escapeRegExp).join('|')})\\s+`, 'i'), ''))
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && value.length <= 42)
    .filter((value) => !/^(and|or|with|without|mm|cm)$|^\d+$/i.test(value));

  const unique = new Map<string, { key: string; label: string }>();
  for (const candidate of candidates) {
    const key = normalizeGirodiscToken(candidate);
    if (!key || unique.has(key)) continue;
    unique.set(key, { key, label: formatGirodiscLabel(candidate) });
  }

  return [...unique.values()];
}

export type GirodiscHeroVehicleModel = {
  key: string;
  label: string;
};

export type GirodiscHeroVehicleMake = {
  /** Tag-formatted key used by the catalog filter (e.g. "car_make:bmw"). */
  key: string;
  /** Human label (e.g. "BMW"). */
  label: string;
  /** Distinct model labels detected for this make. */
  models: GirodiscHeroVehicleModel[];
};

export function isGirodiscProduct(product: Pick<ShopProduct, 'brand' | 'vendor'>) {
  const brand = String(product.brand ?? '').trim().toLowerCase();
  const vendor = String(product.vendor ?? '').trim().toLowerCase();
  return brand === 'girodisc' || vendor === 'girodisc';
}

export function buildGirodiscHeroVehicleTree(
  products: ReadonlyArray<ShopProduct>
): GirodiscHeroVehicleMake[] {
  const tree = new Map<string, Map<string, string>>();

  for (const product of products) {
    const makeKey = getGirodiscMakeKey(product);
    if (!makeKey) continue;

    let modelMap = tree.get(makeKey);
    if (!modelMap) {
      modelMap = new Map();
      tree.set(makeKey, modelMap);
    }

    for (const model of extractGirodiscModelsForKey(product, makeKey)) {
      if (!model.key || modelMap.has(model.key)) continue;
      modelMap.set(model.key, model.label);
    }
  }

  const result: GirodiscHeroVehicleMake[] = [];
  for (const [makeKey, modelMap] of tree.entries()) {
    const label = GIRODISC_MAKE_LABELS[makeKey] ?? formatGirodiscLabel(makeKey);
    const models: GirodiscHeroVehicleModel[] = [];
    for (const [key, modelLabel] of modelMap.entries()) {
      models.push({ key, label: modelLabel });
    }
    models.sort((a, b) => a.label.localeCompare(b.label));
    result.push({ key: `car_make:${makeKey}`, label, models });
  }

  result.sort((a, b) => {
    const ai = GIRODISC_HERO_MAKE_PRIORITY.indexOf(a.label);
    const bi = GIRODISC_HERO_MAKE_PRIORITY.indexOf(b.label);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label);
  });

  return result;
}
