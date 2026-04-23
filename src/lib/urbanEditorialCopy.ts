export type UrbanEditorialProductInput = {
  slug: string;
  titleEn: string;
  titleUa?: string | null;
  shortDescEn?: string | null;
  shortDescUa?: string | null;
  longDescEn?: string | null;
  longDescUa?: string | null;
  bodyHtmlEn?: string | null;
  bodyHtmlUa?: string | null;
  seoTitleUa?: string | null;
  seoDescriptionUa?: string | null;
  brand?: string | null;
  categoryEn?: string | null;
  categoryUa?: string | null;
  productType?: string | null;
  collectionEn?: string | null;
  collectionUa?: string | null;
  tags?: string[];
};

type UrbanCatalogFamily =
  | 'bodykits'
  | 'exterior'
  | 'wheels'
  | 'exhaust'
  | 'interior'
  | 'accessories';

type UrbanEditorialCopy = {
  titleUa: string;
  shortDescUa: string;
  longDescUa: string;
  bodyHtmlUa: string;
  seoTitleUa: string;
  seoDescriptionUa: string;
};

type WheelSpec = {
  code: string | null;
  diameter: string | null;
  pcd: string | null;
  et: string | null;
  finish: string | null;
  axle: string | null;
};

const CATEGORY_UA_MAP: Record<string, string> = {
  accessories: 'Аксесуари',
  arches: 'Арки',
  bodykits: 'Обвіси',
  bundles: 'Комплекти',
  covers: 'Накладки',
  'decal and lettering': 'Декор та літеринг',
  diffusers: 'Дифузори',
  electrics: 'Електрика',
  exhaust: 'Вихлоп',
  'front bumper add-ons': 'Елементи переднього бампера',
  'front bumpers': 'Передні бампери',
  'front lips': 'Передні спліттери',
  'floor mats': 'Килимки',
  grilles: 'Решітки',
  hoods: 'Капоти',
  'interior kit': "Інтер'єрний комплект",
  'mirror caps': 'Накладки дзеркал',
  'rear bumpers': 'Задні бампери',
  'roof lights': 'Дахове світло',
  'side panels': 'Бокові панелі',
  'side skirts': 'Бокові пороги',
  'side steps': 'Підніжки',
  sills: 'Пороги',
  spoilers: 'Спойлери',
  splitters: 'Спліттери',
  'tailgates trim': 'Накладки багажника',
  tailpipes: 'Насадки вихлопу',
  trims: 'Оздоблення',
  vents: 'Вентиляційні елементи',
  wheels: 'Диски',
  'wheel spacers': 'Колісні проставки',
};

const FAMILY_VALUE_SENTENCE: Record<UrbanCatalogFamily, string> = {
  bodykits:
    'Позиція працює в дусі OEM Plus і формує більш виразну ширину, посадку та графіку кузова.',
  exterior:
    'Деталь додає кузову стриманий і дорогий акцент у дусі OEM Plus без візуального перевантаження.',
  wheels:
    'Специфікація побудована навколо правильного fitment, stance та преміальної подачі автомобіля.',
  exhaust:
    'Елемент завершує задню частину в типовій для Urban стриманій, технічній манері.',
  interior:
    'Рішення переносить мову зовнішнього пакета в салон і підсилює відчуття цілісної збірки.',
  accessories:
    'Аксесуар зберігає коректний fitment, практичність і стилістику фірмової Urban-конфігурації.',
};

const FAMILY_CLOSING_SENTENCE: Record<UrbanCatalogFamily, string> = {
  bodykits:
    'Точний склад пакета, оздоблення та сумісність залежать від конкретної конфігурації Urban Automotive для цього автомобіля.',
  exterior:
    'Фінальний fitment, матеріал і склад постачання залежать від конкретного SKU Urban Automotive та вибраної конфігурації кузова.',
  wheels:
    'Фінальна конфігурація осі, PCD, ET та оздоблення визначається конкретною специфікацією цього SKU Urban Automotive.',
  exhaust:
    'Точний fitment і склад поставки залежать від конфігурації вихлопної програми для відповідної платформи.',
  interior:
    'Оздоблення, варіант виконання та склад постачання залежать від конкретної конфігурації Urban Automotive для цього салону.',
  accessories:
    'Остаточний fitment і склад постачання визначаються платформою, кузовом і конфігурацією відповідного Urban SKU.',
};

const FINISH_TOKENS = [
  'Full Visual Carbon Fibre',
  'Semi-Visual Carbon Fibre',
  'Visual Carbon Fibre',
  'Exposed Carbon Fibre',
  'Exposed Carbon',
  'Carbon Fibre',
  'Billet Aluminium',
  'Satin Black',
  'Gloss Black',
  'Black Shadow',
  'RAW',
  'PUR',
];

const CURATED_FLAGSHIP_SLUGS = new Set([
  'urban-defender-110-aerokit',
  'urban-defender-110-wide-arches',
  'urban-defender-110-roof-lightbar',
  'urban-audi-rs6-avant-aerokit',
  'urban-range-rover-l460-aerokit',
  'urb-bod-25353001-v1',
  'urban-050-1056-57',
  'urban-l461-1000',
  'urb-bod-25353030-v1',
  'urb-bod-25353062-v1',
  'urb-bod-25353068-v1',
  'urb-bod-25353066-v1',
  'urb-bod-25353070-v1',
  'urb-bod-25353067-v1',
  'urb-bod-25353063-v1',
  'urb-bod-25353071-v1',
  'urb-bod-25353069-v1',
  'urban-250-1002',
  'urb-bun-25358198-v1',
]);

const UA_BRAND_STYLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bfull visual carbon fibre\b/gi, 'Full Visual Carbon Fibre'],
  [/\bsemi-visual carbon fibre\b/gi, 'Semi-Visual Carbon Fibre'],
  [/\bvisual carbon fibre\b/gi, 'Visual Carbon Fibre'],
  [/\bexposed carbon fibre\b/gi, 'Exposed Carbon Fibre'],
  [/\bexposed carbon\b/gi, 'Exposed Carbon'],
  [/\bcarbon fibre\b/gi, 'Carbon Fibre'],
  [/\bgloss black\b/gi, 'Gloss Black'],
  [/\bsatin black\b/gi, 'Satin Black'],
  [/\bblack shadow\b/gi, 'Black Shadow'],
];

const UA_AUTOMOTIVE_NOUN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\burban l460 programme\b/gi, 'Urban-програма L460'],
  [/\burban v2\b/gi, 'Urban V2'],
  [/\boem plus look\b/gi, 'OEM Plus-характером'],
  [/\burban programme\b/gi, 'Urban-програма'],
  [/\bprogramme\b/gi, 'програма'],
  [/\bprice list\b/gi, 'прайс-лист'],
  [/\breplacement bumper package\b/gi, 'пакета заміни бамперів'],
  [/\breplacement carbon bumpers?\b/gi, 'карбоновими бамперами'],
  [/\bdiffuser package\b/gi, 'пакета дифузора'],
  [/\bDRL kit\b/gi, 'DRL-комплектом'],
  [/\burban branding\b/gi, 'брендинг Urban'],
  [/\bbranding Urban\b/gi, 'брендингом Urban'],
  [/\bbranding package\b/gi, 'комплект брендингу'],
  [/\bwheel and tyre package\b/gi, 'комплект коліс і шин'],
  [/\bfront bumper\b/gi, 'передній бампер'],
  [/\brear bumper\b/gi, 'задній бампер'],
  [/\bfront splitter\b/gi, 'передній спліттер'],
  [/\brear diffuser\b/gi, 'задній дифузор'],
  [/\bbillet tailpipes?\b/gi, 'billet-насадками вихлопу'],
  [/\brear over-rider kit\b/gi, 'комплектом задніх накладок over-rider'],
  [/\bwide-track arches\b/gi, 'розширеними арками'],
  [/\bwidebody presence\b/gi, 'виразним широким силуетом Urban'],
  [/\bin-house carbon accessories\b/gi, 'фірмовими карбоновими аксесуарами власної розробки'],
  [/\bside sills?\b/gi, 'бокові пороги'],
  [/\bfixed side steps\b/gi, 'стаціонарні підніжки'],
  [/\bside steps\b/gi, 'підніжки'],
  [/\bmatrix grille\b/gi, 'решітка Matrix'],
  [/\bautograph grille\b/gi, 'решітка Autograph'],
  [/\bgrille\b/gi, 'решітка'],
  [/\brear spoiler\b/gi, 'задній спойлер'],
  [/\bfront canards?\b/gi, 'передні канарди'],
  [/\bcanard packs?\b/gi, 'комплекти канардів'],
  [/\bdoor inserts?\b/gi, 'дверні вставки'],
  [/\blower door mouldings inserts?\b/gi, 'нижні дверні вставки'],
  [/\bmudflap kit\b/gi, 'комплект бризковиків'],
  [/\bmudguards?\b/gi, 'бризковики'],
  [/\bbonnet\b/gi, 'капот'],
  [/\bsplitter\b/gi, 'спліттер'],
  [/\bdiffuser\b/gi, 'дифузор'],
  [/\bwheel arches?\b/gi, 'колісні арки'],
  [/\bproductbase\b/gi, 'базовий елемент'],
  [/\btailpipe finishers?\b/gi, 'насадки вихлопу'],
];

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();
}

function stripHtml(value: string | null | undefined) {
  return normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasCyrillic(value: string | null | undefined) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(String(value ?? ''));
}

function countLetters(value: string | null | undefined) {
  return (String(value ?? '').match(/[A-Za-zА-Яа-яІіЇїЄєҐґ]/g) ?? []).length;
}

function cyrillicRatio(value: string | null | undefined) {
  const letters = countLetters(value);
  if (!letters) return 0;
  return (String(value ?? '').match(/[А-Яа-яІіЇїЄєҐґ]/g) ?? []).length / letters;
}

function normalizeLocalizedWhitespace(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\s+([,.:;!?])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
  );
}

function isWeakLocalizedField(current: string | null | undefined, referenceEn: string | null | undefined) {
  const normalizedCurrent = normalizeWhitespace(current);
  if (!normalizedCurrent) return true;

  if (/\bproductbase\b|базовий елемент\b/i.test(normalizedCurrent)) {
    return true;
  }

  const normalizedReference = normalizeWhitespace(referenceEn);
  if (normalizedReference && normalizedCurrent === normalizedReference) return true;

  return cyrillicRatio(normalizedCurrent) < 0.18;
}

function isWeakLocalizedTitle(current: string | null | undefined, referenceEn: string | null | undefined) {
  const normalizedCurrent = normalizeWhitespace(current);
  if (!normalizedCurrent) return true;

  const normalizedReference = normalizeWhitespace(referenceEn);
  if (normalizedReference && normalizedCurrent === normalizedReference) return true;

  return !hasCyrillic(normalizedCurrent);
}

function sentenceCase(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function toLowerSentence(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return normalized;
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function categoryUaFromValue(categoryEn: string | null | undefined, categoryUa: string | null | undefined) {
  if (normalizeWhitespace(categoryUa)) return normalizeWhitespace(categoryUa);
  const key = normalizeWhitespace(categoryEn).toLowerCase();
  return CATEGORY_UA_MAP[key] ?? normalizeWhitespace(categoryEn) ?? 'Компонент';
}

function resolveFamily(product: UrbanEditorialProductInput): UrbanCatalogFamily {
  const tag = (product.tags ?? []).find((value) => value.startsWith('urban-family:'));
  const tagged = tag?.slice('urban-family:'.length) as UrbanCatalogFamily | undefined;
  if (tagged && ['bodykits', 'exterior', 'wheels', 'exhaust', 'interior', 'accessories'].includes(tagged)) {
    return tagged;
  }

  const haystack = normalizeWhitespace(
    [
      product.categoryEn,
      product.productType,
      product.titleEn,
      product.collectionEn,
      ...(product.tags ?? []),
    ].join(' ')
  ).toLowerCase();

  if (/(body\s?kit|bodykit|widetrack|aero kit|replacement bumper package)/i.test(haystack)) {
    return 'bodykits';
  }
  if (/(wheel|pcd|et\d+|rim|spacer)/i.test(haystack)) {
    return 'wheels';
  }
  if (/(exhaust|tailpipe)/i.test(haystack)) {
    return 'exhaust';
  }
  if (/(seat back|floor mat|interior)/i.test(haystack)) {
    return 'interior';
  }
  if (/(tow|roof rail|branding pack|accessor|electrics)/i.test(haystack)) {
    return 'accessories';
  }
  return 'exterior';
}

function buildVehicleLabel(product: UrbanEditorialProductInput) {
  const brand = normalizeWhitespace(product.brand);
  const collection = normalizeWhitespace(product.collectionEn || product.collectionUa);
  const candidates = [collection, brand].filter(Boolean);

  if (!collection) return brand || 'відповідної моделі';
  if (!brand) return collection;

  const collectionLower = collection.toLowerCase();
  const brandLower = brand.toLowerCase();

  if (collectionLower.includes(brandLower)) return collection;
  if (brand === 'Range Rover' && collectionLower.startsWith('sport ')) return `${brand} ${collection}`;
  if (brand === 'Land Rover' && /^defender\b/i.test(collection)) return `Land Rover ${collection}`;
  if (brand === 'Land Rover' && /^discovery\b/i.test(collection)) return `Land Rover ${collection}`;
  if (brand === 'Mercedes-Benz' && /^g-wagon\b/i.test(collection)) return `${brand} ${collection}`;
  if (brand === 'Audi') return `${brand} ${collection}`;
  if (brand === 'Volkswagen') return `${brand} ${collection}`;
  if (brand === 'Lamborghini') return `${brand} ${collection}`;
  if (brand === 'Bentley') return `${brand} ${collection}`;
  if (brand === 'Rolls-Royce') return `${brand} ${collection}`;

  if (candidates.length === 2) return `${brand} ${collection}`;
  return collection;
}

function findLongestMatch(title: string, values: string[]) {
  const normalizedTitle = normalizeWhitespace(title);
  const sortedValues = [...values]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const candidate of sortedValues) {
    const pattern = new RegExp(`^${escapeRegExp(candidate)}(?:\\b|\\s|[-,:])`, 'i');
    if (pattern.test(normalizedTitle)) {
      return candidate;
    }
  }

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeLeadingVehicle(title: string, product: UrbanEditorialProductInput, vehicleLabel: string) {
  const brand = normalizeWhitespace(product.brand);
  const collection = normalizeWhitespace(product.collectionEn || product.collectionUa);
  const candidates = [
    vehicleLabel,
    collection,
    brand && collection ? `${brand} ${collection}` : '',
    collection ? `New ${collection}` : '',
  ].filter(Boolean) as string[];

  const match = findLongestMatch(title, candidates);
  if (!match) return normalizeWhitespace(title);

  const pattern = new RegExp(`^${escapeRegExp(match)}\\s*[-,:]*\\s*`, 'i');
  return normalizeWhitespace(title.replace(pattern, ''));
}

function pullParentheticalNotes(title: string) {
  const notes: string[] = [];
  const stripped = title.replace(/\(([^)]+)\)/g, (_, note: string) => {
    const normalized = normalizeWhitespace(note);
    if (normalized) notes.push(normalized);
    return ' ';
  });

  return {
    title: normalizeWhitespace(stripped.replace(/:+$/, '')),
    notes,
  };
}

function extractFinishTokens(source: string) {
  const found: string[] = [];
  let working = source;

  for (const token of FINISH_TOKENS) {
    const pattern = new RegExp(escapeRegExp(token), 'i');
    if (!pattern.test(working)) continue;
    found.push(token);
    working = normalizeWhitespace(working.replace(pattern, ' '));
  }

  return {
    tokens: found,
    text: working,
  };
}

function collapseCommaParts(parts: Array<string | null | undefined>) {
  return normalizeWhitespace(parts.filter(Boolean).join(', '));
}

function translateFitmentNote(note: string) {
  let translated = normalizeWhitespace(note);

  const replacements: Array<[RegExp, string]> = [
    [/for sv models?/gi, 'для версій SV'],
    [/non-sv oem grille required/gi, 'для non-SV потрібна OEM-решітка'],
    [/oem grille required/gi, 'потрібна OEM-решітка'],
    [/standard bonnet only/gi, 'лише для стандартного капота'],
    [/sport or svr/gi, 'для Sport або SVR'],
    [/plain or optional urban shield/gi, 'plain або з опційним URBAN Shield'],
    [/front and rear/gi, 'передні та задні'],
    [/detachable tow with electrics/gi, 'знімний фаркоп з електрикою'],
    [/with electrics/gi, 'з електрикою'],
    [/non-hybrid/gi, 'non-hybrid'],
    [/pre-facelift/gi, 'Pre-Facelift'],
    [/facelift/gi, 'Facelift'],
    [/hybrid/gi, 'Hybrid'],
    [/rear/gi, 'rear'],
    [/front/gi, 'front'],
  ];

  for (const [pattern, replacement] of replacements) {
    translated = translated.replace(pattern, replacement);
  }

  translated = translated
    .replace(/\bmodels\b/gi, 'версії')
    .replace(/\brequired\b/gi, 'потрібна')
    .replace(/\bonly\b/gi, 'лише')
    .replace(/\bfor\b/gi, 'для')
    .replace(/\band\b/gi, 'та');

  return normalizeWhitespace(translated);
}

function translateConfigTokens(title: string) {
  const notes: string[] = [];

  if (/\bSWB\b/i.test(title)) notes.push('конфігурація SWB');
  if (/\bLWB\b/i.test(title)) notes.push('конфігурація LWB');
  if (/\b2013\s*-\s*2017\b/.test(title)) notes.push('версія 2013-2017');
  if (/\b2018\s*-\s*2022\b/.test(title) || /\b2018-2022\b/.test(title)) notes.push('версія 2018-2022');
  if (/\b2020\+\b/.test(title)) notes.push('версія 2020+');
  if (/\bRAW\b/i.test(title)) notes.push('виконання RAW');
  if (/\bP400E\b/i.test(title)) notes.push('версія P400E');

  return notes;
}

function buildComponentTitle(coreTitle: string, categoryEn: string | null | undefined) {
  const source = normalizeWhitespace(coreTitle);
  const lowered = source.toLowerCase();

  if (/replacement bumper package/i.test(source)) return 'Пакет заміни бамперів Urban';
  if (/carbon fibre v2 kit/i.test(source)) return 'Комплект Carbon Fibre V2';
  if (/\bv2 kit\b/i.test(source)) return 'Комплект V2';
  if (/soft kit/i.test(source)) return 'Пакет Soft Kit';
  if (/widetrack arch kit/i.test(source)) return 'Комплект арок Widetrack';
  if (/wide track arch kit/i.test(source)) return 'Комплект арок Wide Track';
  if (/arch extension kit/i.test(source)) return 'Комплект розширення колісних арок';
  if (/arch kit|arch set/i.test(source)) {
    if (/widetrack/i.test(source)) return 'Комплект арок Widetrack';
    if (/\bPUR\b/i.test(source)) return 'Комплект PUR-арок';
    if (/svr style/i.test(source)) return 'Комплект розширення арок у стилі SVR';
    return 'Комплект арок';
  }
  if (/rear spoiler/i.test(source)) return 'Задній спойлер';
  if (/front grille|grille/i.test(source)) {
    if (/autograph/i.test(source)) return 'Решітка Autograph';
    if (/matrix/i.test(source)) return 'Решітка Matrix';
    return 'Решітка';
  }
  if (/fixed side steps/i.test(source)) {
    if (/matrix/i.test(source)) return 'Фіксовані підніжки Matrix';
    if (/linear/i.test(source)) return 'Фіксовані підніжки Linear';
    if (/black shadow/i.test(source)) return 'Фіксовані підніжки Black Shadow';
    return 'Фіксовані підніжки';
  }
  if (/tow/i.test(source)) return 'Знімний фаркоп';
  if (/roof rail kit/i.test(source)) return 'Комплект рейлінгів на дах';
  if (/light bar|roof light/i.test(source)) return 'Даховий світловий модуль';
  if (/front canards?/i.test(source)) return 'Передні канарди';
  if (/canard packs?/i.test(source)) return 'Комплект канардів';
  if (/lower door mouldings inserts?/i.test(source)) return 'Нижні дверні вставки';
  if (/door inserts?/i.test(source)) return 'Вставки дверей';
  if (/top vent bonnet overlay/i.test(source)) return 'Накладка капота з верхніми вентиляційними елементами';
  if (/bonnet assembly/i.test(source)) return 'Капот у зборі';
  if (/bonnet|hood/i.test(source)) return 'Капот';
  if (/side vent overlay/i.test(source)) return 'Накладка бокового вентиляційного елемента';
  if (/vent/i.test(source)) return 'Вентиляційний елемент';
  if (/rear tailgate trim/i.test(source)) return 'Накладка кришки багажника';
  if (/rear diffuser|diffuser/i.test(source)) return 'Задній дифузор';
  if (/tail pipe finisher/i.test(source)) return 'Насадка вихлопу';
  if (/exhaust system/i.test(source)) return 'Вихлопна система';
  if (/key fob|key chain/i.test(source)) return 'Брелок';
  if (/mudflap kit/i.test(source)) return 'Комплект бризковиків';
  if (/seat backs?/i.test(source)) return 'Спинки сидінь';
  if (/floor mat set/i.test(source)) return 'Комплект преміальних килимків';
  if (/mirror covers?|wing mirrors?|mirror caps?/i.test(source)) return 'Накладки дзеркал';
  if (/branding pack/i.test(source)) return 'Комплект брендингу Urban';
  if (/mudguards?/i.test(source)) return 'Бризковики';
  if (/number plate kits?/i.test(source)) return 'Комплект номерної рамки';
  if (/extended arches/i.test(source)) return 'Розширені арки';
  if (/side accent trim/i.test(source)) return 'Бокова акцентна накладка';
  if (/wheel arches?/i.test(source)) return 'Колісні арки';
  if (/wheel spacers?/i.test(source)) return 'Колісні проставки';
  if (/wheel nuts?/i.test(source)) return 'Колісні гайки';
  if (/productbase/i.test(source)) return 'Базовий елемент';
  if (/bodykit|body kit/i.test(source)) {
    if (/widetrack/i.test(source)) return 'Пакет Urban Widetrack';
    return 'Аеродинамічний комплект Urban';
  }

  const normalizedCategory = normalizeWhitespace(categoryEn).toLowerCase();
  if (normalizedCategory) {
    return sentenceCase(categoryUaFromValue(normalizedCategory, null));
  }

  if (lowered) return sentenceCase(source);
  return 'Компонент Urban Automotive';
}

function buildWheelSpec(title: string): WheelSpec {
  const size = title.match(/\b(\d{2})"/)?.[0] ?? null;
  const code =
    title.match(/\b([A-Z]{2,4}\d(?:-?[A-Z])?)\b/i)?.[1]?.toUpperCase() ??
    title.match(/\b([A-Z]{2,4}\d-[A-Z])\b/i)?.[1]?.toUpperCase() ??
    null;
  const pcd = title.match(/\b(\d+x\d+)\b/i)?.[1]?.replace('X', 'x') ?? null;
  const et = title.match(/\b(ET\s?-?\d+)\b/i)?.[1]?.replace(/\s+/g, '') ?? null;
  const finish = FINISH_TOKENS.find((token) => new RegExp(escapeRegExp(token), 'i').test(title)) ?? null;
  const axle = /\brear\b/i.test(title) ? 'задня вісь' : /\bfront\b/i.test(title) ? 'передня вісь' : null;

  return {
    code,
    diameter: size,
    pcd,
    et,
    finish,
    axle,
  };
}

export function polishUrbanUaCopy(
  value: string | null | undefined,
  field: 'title' | 'text' | 'html' = 'text'
) {
  if (!value) return value ?? null;

  let polished = String(value);

  for (const [pattern, replacement] of UA_BRAND_STYLE_REPLACEMENTS) {
    polished = polished.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of UA_AUTOMOTIVE_NOUN_REPLACEMENTS) {
    polished = polished.replace(pattern, replacement);
  }

  polished = polished
    .replace(/Urban Automotive Urban Automotive/gi, 'Urban Automotive')
    .replace(/комплекти канардів Urban Automotive/gi, 'передні канарди Urban Automotive')
    .replace(/фірмовим брендинг Urban/gi, 'фірмовим брендингом Urban')
    .replace(/з пакета заміни бамперів/gi, 'з пакетом заміни бамперів')
    .replace(/, пакета дифузора,/gi, ', пакетом дифузора,')
    .replace(
      /решітка Matrix, задній спойлер, стаціонарні підніжки/gi,
      'решіткою Matrix, заднім спойлером і стаціонарними підніжками'
    )
    .replace(
      /з карбоновими бамперами, Nolden DRLs, спліттер, дифузор, billet-насадками вихлопу/gi,
      'з карбоновими бамперами, Nolden DRL, спліттером, дифузором і billet-насадками вихлопу'
    )
    .replace(/carbon передній спліттер package/gi, 'карбоновим пакетом переднього спліттера')
    .replace(/Urban Widetrack package/gi, 'пакет Urban Widetrack')
    .replace(/Exposed Carbon капот/gi, 'капотом Exposed Carbon')
    .replace(/з актуального Urban прайс-лист/gi, 'з актуального прайс-листа Urban')
    .replace(/підніжками і OEM-plus/gi, 'підніжками та логікою OEM Plus')
    .replace(/логіці OEM-plus збірки й/gi, 'дусі OEM Plus і')
    .replace(/логіці OEM-plus збірки/gi, 'дусі OEM Plus')
    .replace(/OEM-plus акцент/gi, 'акцент у дусі OEM Plus')
    .replace(/OEM-plus логікою/gi, 'логікою OEM Plus')
    .replace(/логікою OEM Plus пакета/gi, 'логікою пакета в дусі OEM Plus')
    .replace(/повною Urban widebody-подачею/gi, 'повноцінним широким силуетом Urban')
    .replace(/повною Urban виразним широким силуетом Urban/gi, 'повноцінним широким силуетом Urban')
    .replace(/widebody-подачею/gi, 'виразним широким силуетом Urban')
    .replace(
      /спліттером, заднім бампером і дифузором і повноцінним широким силуетом Urban/gi,
      'спліттером, заднім бампером і дифузором, що формують повноцінний широкий силует Urban'
    )
    .replace(/over-rider елементів/gi, 'накладок over-rider')
    .replace(/in-house карбоновими аксесуарами/gi, 'карбоновими аксесуарами власної розробки')
    .replace(/OEM-plus/gi, 'OEM Plus')
    .replace(/OEM Plus характером/gi, 'OEM Plus-характером')
    .replace(/дусі OEM Plus й/gi, 'дусі OEM Plus і')
    .replace(/вихлопу і фірмовим/gi, 'вихлопу та фірмовим')
    .replace(/фірмовими фірмовими/gi, 'фірмовими')
    .replace(/спліттер, задній бампер, дифузор/gi, 'спліттером, заднім бампером і дифузором')
    .replace(/\bдля версій SV, для non-SV потрібна OEM-решітка\b/gi, 'для версій SV; для non-SV потрібна OEM-решітка');

  if (field === 'html') {
    return polished
      .replace(/\s{2,}/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/(<p>)([a-zа-яіїєґ])/giu, (_, open: string, char: string) => open + char.toUpperCase())
      .trim();
  }

  return sentenceCase(normalizeLocalizedWhitespace(polished));
}

function buildWheelCopy(product: UrbanEditorialProductInput, vehicleLabel: string): UrbanEditorialCopy {
  const spec = buildWheelSpec(product.titleEn);
  const descriptorParts = [spec.code ? `Urban ${spec.code}` : 'Urban', spec.diameter, spec.finish].filter(Boolean);
  const titleUa = collapseCommaParts([`Диск ${descriptorParts.join(' ')}`.trim(), null]).replace(/,\s*$/, '');
  const resolvedTitle = `${titleUa} для ${vehicleLabel}`;

  const shortDescUa = normalizeWhitespace(
    `Офіційна колісна специфікація Urban Automotive ${[spec.code, spec.diameter, spec.finish].filter(Boolean).join(' ')} для ${vehicleLabel}.`
  );

  const bulletItems = [
    `<li><strong>Платформа:</strong> ${escapeHtml(vehicleLabel)}</li>`,
    spec.code ? `<li><strong>Дизайн:</strong> ${escapeHtml(spec.code)}</li>` : '',
    spec.diameter ? `<li><strong>Діаметр:</strong> ${escapeHtml(spec.diameter)}</li>` : '',
    spec.pcd ? `<li><strong>PCD:</strong> ${escapeHtml(spec.pcd)}</li>` : '',
    spec.et ? `<li><strong>ET:</strong> ${escapeHtml(spec.et)}</li>` : '',
    spec.finish ? `<li><strong>Оздоблення:</strong> ${escapeHtml(spec.finish)}</li>` : '',
    spec.axle ? `<li><strong>Призначення:</strong> ${escapeHtml(spec.axle)}</li>` : '',
  ].filter(Boolean);

  const bodyHtmlUa = [
    `<p>Офіційна колісна специфікація Urban Automotive для ${escapeHtml(vehicleLabel)}.</p>`,
    `<p>Конфігурація ${escapeHtml([spec.code, spec.diameter, spec.finish].filter(Boolean).join(' '))} побудована навколо правильного fitment, пропорції арки та характерної для Urban преміальної stance.</p>`,
    bulletItems.length ? `<ul>${bulletItems.join('')}</ul>` : '',
    `<p>${escapeHtml(FAMILY_CLOSING_SENTENCE.wheels)}</p>`,
  ]
    .filter(Boolean)
    .join('');

  return {
    titleUa: normalizeWhitespace(resolvedTitle),
    shortDescUa,
    longDescUa: stripHtml(bodyHtmlUa),
    bodyHtmlUa,
    seoTitleUa: normalizeWhitespace(resolvedTitle),
    seoDescriptionUa: shortDescUa,
  };
}

function isWheelLikeProduct(product: UrbanEditorialProductInput) {
  const category = normalizeWhitespace(product.categoryEn || product.productType).toLowerCase();
  if (category === 'wheels') return true;

  const title = normalizeWhitespace(product.titleEn);
  return /\b\d{2}"\b/.test(title) && (/\b\d+x\d+\b/i.test(title) || /\bET\s?-?\d+\b/i.test(title));
}

function buildGenericCopy(product: UrbanEditorialProductInput, family: UrbanCatalogFamily, vehicleLabel: string) {
  const withoutVehicle = removeLeadingVehicle(product.titleEn, product, vehicleLabel);
  const withNotes = pullParentheticalNotes(withoutVehicle);
  const withFinish = extractFinishTokens(withNotes.title);
  const componentTitle = buildComponentTitle(withFinish.text, product.categoryEn);
  const finishPhrase = withFinish.tokens.length ? withFinish.tokens.join(', ') : null;
  const brandedComponent = /\bUrban\b/i.test(componentTitle)
    ? componentTitle
    : `${componentTitle} Urban Automotive`;

  const titleUa = normalizeWhitespace(
    [componentTitle, finishPhrase].filter(Boolean).join(' ') + ` для ${vehicleLabel}`
  );
  const categoryUa = categoryUaFromValue(product.categoryEn, product.categoryUa);
  const noteList = [...new Set([
    ...withNotes.notes.map(translateFitmentNote),
    ...translateConfigTokens(product.titleEn),
  ].filter(Boolean))];

  const shortDescUa = normalizeWhitespace(
    `${brandedComponent}${finishPhrase ? ` у виконанні ${finishPhrase}` : ''} для ${vehicleLabel}. ${FAMILY_VALUE_SENTENCE[family]}`
  );

  const introSentence = `${brandedComponent}${finishPhrase ? ` у виконанні ${finishPhrase}` : ''} для ${vehicleLabel}.`;
  const bulletItems = [
    `<li><strong>Платформа:</strong> ${escapeHtml(vehicleLabel)}</li>`,
    `<li><strong>Категорія:</strong> ${escapeHtml(categoryUa)}</li>`,
    finishPhrase ? `<li><strong>Матеріал / оздоблення:</strong> ${escapeHtml(finishPhrase)}</li>` : '',
    noteList.length ? `<li><strong>Fitment:</strong> ${escapeHtml(noteList.join('; '))}</li>` : '',
  ].filter(Boolean);

  const bodyHtmlUa = [
    `<p>${escapeHtml(introSentence)}</p>`,
    `<p>${escapeHtml(FAMILY_VALUE_SENTENCE[family])}</p>`,
    noteList.length
      ? `<p>Підбір конфігурації для цієї позиції: ${escapeHtml(noteList.join('; '))}.</p>`
      : '',
    bulletItems.length ? `<ul>${bulletItems.join('')}</ul>` : '',
    `<p>${escapeHtml(FAMILY_CLOSING_SENTENCE[family])}</p>`,
  ]
    .filter(Boolean)
    .join('');

  return {
    titleUa,
    shortDescUa,
    longDescUa: stripHtml(bodyHtmlUa),
    bodyHtmlUa,
    seoTitleUa: titleUa,
    seoDescriptionUa: shortDescUa,
  } satisfies UrbanEditorialCopy;
}

export function buildUrbanEditorialCopy(product: UrbanEditorialProductInput): UrbanEditorialCopy {
  const vehicleLabel = buildVehicleLabel(product);
  const family = resolveFamily(product);
  const categoryEn = normalizeWhitespace(product.categoryEn || product.productType).toLowerCase();

  if (isWheelLikeProduct(product) || categoryEn === 'wheels') {
    return buildWheelCopy(product, vehicleLabel);
  }

  return buildGenericCopy(product, family, vehicleLabel);
}

function textSourceForLongDescription(
  preferredBodyHtml: string | null | undefined,
  fallbackBodyHtml: string | null | undefined
) {
  return stripHtml(preferredBodyHtml) || stripHtml(fallbackBodyHtml);
}

export function computeUrbanUaEditorialUpdate(product: UrbanEditorialProductInput) {
  const generated = buildUrbanEditorialCopy(product);
  const update: Partial<UrbanEditorialProductInput> = {};
  const preserveCuratedNarrative =
    CURATED_FLAGSHIP_SLUGS.has(product.slug) && hasCyrillic(product.bodyHtmlUa);

  if (isWeakLocalizedTitle(product.titleUa, product.titleEn)) {
    update.titleUa = generated.titleUa;
  }

  const bodyIsWeak = !preserveCuratedNarrative && isWeakLocalizedField(product.bodyHtmlUa, product.bodyHtmlEn);
  const shortIsWeak = !preserveCuratedNarrative && isWeakLocalizedField(product.shortDescUa, product.shortDescEn);
  const seoTitleIsWeak = isWeakLocalizedTitle(product.seoTitleUa, product.titleEn);
  const seoDescriptionIsWeak = isWeakLocalizedField(product.seoDescriptionUa, product.shortDescEn);
  const longIsWeak = !preserveCuratedNarrative && isWeakLocalizedField(product.longDescUa, product.longDescEn);

  if (bodyIsWeak) {
    update.bodyHtmlUa = generated.bodyHtmlUa;
  }

  if (shortIsWeak) {
    update.shortDescUa = bodyIsWeak
      ? generated.shortDescUa
      : normalizeWhitespace(product.shortDescUa) || generated.shortDescUa;
  }

  if (longIsWeak) {
    update.longDescUa = bodyIsWeak
      ? generated.longDescUa
      : textSourceForLongDescription(product.bodyHtmlUa, product.bodyHtmlEn) || generated.longDescUa;
  }

  if (seoTitleIsWeak) {
    update.seoTitleUa = update.titleUa ?? generated.seoTitleUa;
  }

  if (seoDescriptionIsWeak) {
    update.seoDescriptionUa =
      update.shortDescUa ??
      normalizeWhitespace(product.shortDescUa) ??
      textSourceForLongDescription(product.bodyHtmlUa, product.bodyHtmlEn) ??
      generated.seoDescriptionUa;
  }

  const polishedTitle = polishUrbanUaCopy(update.titleUa ?? product.titleUa, 'title');
  if (polishedTitle && polishedTitle !== (update.titleUa ?? product.titleUa)) {
    update.titleUa = polishedTitle;
  }

  const polishedShort = polishUrbanUaCopy(update.shortDescUa ?? product.shortDescUa, 'text');
  if (polishedShort && polishedShort !== (update.shortDescUa ?? product.shortDescUa)) {
    update.shortDescUa = polishedShort;
  }

  const polishedLong = polishUrbanUaCopy(update.longDescUa ?? product.longDescUa, 'text');
  if (polishedLong && polishedLong !== (update.longDescUa ?? product.longDescUa)) {
    update.longDescUa = polishedLong;
  }

  const polishedBody = polishUrbanUaCopy(update.bodyHtmlUa ?? product.bodyHtmlUa, 'html');
  if (polishedBody && polishedBody !== (update.bodyHtmlUa ?? product.bodyHtmlUa)) {
    update.bodyHtmlUa = polishedBody;
  }

  const polishedSeoTitle = polishUrbanUaCopy(
    update.seoTitleUa ?? product.seoTitleUa ?? update.titleUa ?? product.titleUa,
    'title'
  );
  if (polishedSeoTitle && polishedSeoTitle !== (update.seoTitleUa ?? product.seoTitleUa)) {
    update.seoTitleUa = polishedSeoTitle;
  }

  const polishedSeoDescription = polishUrbanUaCopy(
    update.seoDescriptionUa ?? product.seoDescriptionUa ?? update.shortDescUa ?? product.shortDescUa,
    'text'
  );
  if (
    polishedSeoDescription &&
    polishedSeoDescription !== (update.seoDescriptionUa ?? product.seoDescriptionUa)
  ) {
    update.seoDescriptionUa = polishedSeoDescription;
  }

  return Object.keys(update).length ? update : null;
}
