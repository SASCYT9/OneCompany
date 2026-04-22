import type { ShopProduct } from '@/lib/shopCatalog';

const IPE_VEHICLE_PATTERNS: Array<{ key: string; patterns: RegExp[] }> = [
  {
    key: 'Porsche',
    patterns: [/\bporsche\b/i, /\b911\b/i, /\b992\b/i, /\b991\b/i, /\b718\b/i, /\bcayenne\b/i, /\bpanamera\b/i, /\bmacan\b/i, /\bgt3\b/i, /\btaycan\b/i],
  },
  {
    key: 'Ferrari',
    patterns: [/\bferrari\b/i, /\b458\b/i, /\b488\b/i, /\bf8\b/i, /\b296\b/i, /\b812\b/i, /\broma\b/i, /\bportofino\b/i, /\bpurosangue\b/i],
  },
  {
    key: 'Lamborghini',
    patterns: [/\blamborghini\b/i, /\baventador\b/i, /\bhuracan\b/i, /\burus\b/i, /\brevuelto\b/i, /\bsvj\b/i],
  },
  {
    key: 'McLaren',
    patterns: [/\bmclaren\b/i, /\b570s\b/i, /\b600lt\b/i, /\b720s\b/i, /\b765lt\b/i, /\bartura\b/i],
  },
  {
    key: 'BMW',
    patterns: [/\bbmw\b/i, /\bm2\b/i, /\bm3\b/i, /\bm4\b/i, /\bm5\b/i, /\bm8\b/i, /\bx3m\b/i, /\bx4m\b/i],
  },
  {
    key: 'Mercedes-AMG',
    patterns: [/\bmercedes amg\b/i, /\bamg\b/i, /\bc63\b/i, /\be63\b/i, /\bgt 63\b/i],
  },
  {
    key: 'Mercedes-Benz',
    patterns: [/\bmercedes benz\b/i, /\bmercedes\b/i],
  },
  {
    key: 'Audi',
    patterns: [/\baudi\b/i, /\br8\b/i, /\brs6\b/i, /\brs7\b/i, /\brsq8\b/i, /\brs q8\b/i],
  },
  {
    key: 'Volkswagen',
    patterns: [/\bvolkswagen\b/i, /\bgolf\b/i, /\bmk7(?:\.5)?\b/i, /\bmk8\b/i, /\btiguan\b/i, /\bgti\b/i],
  },
  {
    key: 'Toyota',
    patterns: [/\btoyota\b/i, /\bsupra\b/i, /\bgr86\b/i],
  },
  {
    key: 'Maserati',
    patterns: [/\bmaserati\b/i, /\bgranturismo\b/i, /\bgrecale\b/i, /\blevante\b/i],
  },
  {
    key: 'Aston Martin',
    patterns: [/\baston martin\b/i, /\bvantage\b/i, /\bdb11\b/i, /\bdbx\b/i],
  },
  {
    key: 'Nissan',
    patterns: [/\bnissan\b/i, /\bgt-r\b/i, /\bgtr\b/i, /\br35\b/i, /\brz34\b/i],
  },
  {
    key: 'Ford',
    patterns: [/\bford\b/i, /\bmustang\b/i],
  },
  {
    key: 'Subaru',
    patterns: [/\bsubaru\b/i, /\bbrz\b/i],
  },
];

const IPE_LINE_PATTERNS: Array<{ key: string; patterns: RegExp[] }> = [
  {
    key: 'Valvetronic Exhaust',
    patterns: [
      /\bvalvetronic\b/i,
      /\bexhaust system\b/i,
      /\bexhaust\b/i,
      /\bcat back\b/i,
      /\bcatback\b/i,
      /\bfull-system\b/i,
      /\bfull system\b/i,
      /\brear valvetronic\b/i,
    ],
  },
  {
    key: 'Downpipe / Cats',
    patterns: [/\bdownpipe\b/i, /\bcat pipe\b/i, /\bcatted downpipe\b/i, /\bcatless downpipe\b/i],
  },
  {
    key: 'Headers',
    patterns: [/\bheaders?\b/i, /\bheader back\b/i, /\bequal length\b/i],
  },
  {
    key: 'Tailpipes',
    patterns: [/\btailpipes?\b/i, /\btips?\b/i, /\bchrome black tips\b/i, /\btitanium blue tips\b/i, /\bcarbon fiber tips\b/i],
  },
  {
    key: 'Controls / Electronics',
    patterns: [/\bremote control\b/i, /\bobdii\b/i, /\blighting sensor\b/i, /\bhand gesture\b/i, /\bcontrol system\b/i],
  },
];

const IPE_GENERIC_TAGS = new Set([
  'ipe',
  'ipe exhaust',
  'innotech performance exhaust',
  'exhaust',
  'accessories',
  'stainless steel',
  'titanium',
  'carbon fiber',
  'store:main',
  'opf',
  'non-opf',
  'catted',
  'catless',
  'remote-control',
  'obdii',
  'tips',
  'full-system',
  'cat-back',
  'downpipe',
  'headers',
  'header',
  'tailpipes',
  'valvetronic exhaust',
  'controls / electronics',
  'ipe official',
  'downpipes & headers',
  'chrome-black',
  'titanium-blue',
  'carbon-fiber',
  'x-pipe',
  'h-pipe',
  'remote control',
  'obdii',
]);

function buildSearchText(product: Pick<ShopProduct, 'tags' | 'title' | 'collection'>) {
  return [
    ...(product.tags ?? []),
    product.title?.en,
    product.title?.ua,
    product.collection?.en,
    product.collection?.ua,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ');
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function isYearTag(value: string) {
  return /^(19|20)\d{2}$/.test(value);
}

function isVehicleMakeTag(value: string) {
  const normalized = normalizeToken(value);
  return IPE_VEHICLE_PATTERNS.some((entry) => entry.patterns.some((pattern) => pattern.test(normalized)));
}

export function resolveIpeVehicleBrand(product: Pick<ShopProduct, 'tags' | 'title' | 'collection'>) {
  const haystack = buildSearchText(product);
  if (!haystack) {
    return null;
  }

  for (const entry of IPE_VEHICLE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) {
      return entry.key;
    }
  }

  return null;
}

export function resolveIpeProductLine(product: Pick<ShopProduct, 'tags' | 'title' | 'collection'>) {
  const haystack = buildSearchText(product);
  if (!haystack) {
    return null;
  }

  for (const entry of IPE_LINE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) {
      return entry.key;
    }
  }

  return null;
}

export function resolveIpeVehicleModel(product: Pick<ShopProduct, 'tags' | 'title' | 'collection'>) {
  const tags = (product.tags ?? []).map((tag) => String(tag ?? '').trim()).filter(Boolean);
  const resolvedBrand = resolveIpeVehicleBrand(product);
  const preferredTag = tags.find((tag) => {
    const normalized = normalizeToken(tag);
    if (!normalized) return false;
    if (IPE_GENERIC_TAGS.has(normalized)) return false;
    if (isYearTag(normalized)) return false;
    if (isVehicleMakeTag(normalized)) return false;
    if (normalized.length <= 2) return false;
    return true;
  });

  if (preferredTag) {
    const normalized = preferredTag.replace(/\s+/g, ' ').trim();
    if (resolvedBrand && normalized.toLowerCase().startsWith(`${resolvedBrand.toLowerCase()} `)) {
      return normalized.slice(resolvedBrand.length).trim();
    }
    return normalized;
  }

  const fallback = product.title?.en || product.title?.ua || '';
  return fallback
    .replace(/\bExhaust System\b/gi, '')
    .replace(/\bValvetronic\b/gi, '')
    .replace(/\bInnotech Performance Exhaust\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(Porsche|Ferrari|Lamborghini|McLaren|BMW|Mercedes-Benz|Mercedes-AMG|Audi|Volkswagen|Toyota|Maserati|Aston Martin|Nissan|Ford|Subaru)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveIpeProductMaterials(product: Pick<ShopProduct, 'tags' | 'title'>) {
  const haystack = buildSearchText({
    tags: product.tags,
    title: product.title,
    collection: { en: '', ua: '' },
  });
  const materials: string[] = [];
  if (/\btitanium\b/i.test(haystack)) materials.push('Titanium');
  if (/\bstainless steel\b|\bstainless\b/i.test(haystack)) materials.push('Stainless Steel');
  if (/\bcarbon fiber\b/i.test(haystack)) materials.push('Carbon Fiber');
  return materials;
}

export function resolveIpeProductSpecs(product: Pick<ShopProduct, 'tags' | 'title'>) {
  const haystack = buildSearchText({
    tags: product.tags,
    title: product.title,
    collection: { en: '', ua: '' },
  });
  const specs: string[] = [];
  if (/\bopf\b/i.test(haystack)) specs.push('OPF');
  if (/\bnon-opf\b/i.test(haystack)) specs.push('Non-OPF');
  if (/\bcatted\b/i.test(haystack)) specs.push('Catted');
  if (/\bcatless\b/i.test(haystack)) specs.push('Catless');
  if (/\bremote control\b|\bremote-control\b/i.test(haystack)) specs.push('Remote Control');
  if (/\bobdii\b|\blighting sensor\b/i.test(haystack)) specs.push('OBDII');
  return specs;
}
