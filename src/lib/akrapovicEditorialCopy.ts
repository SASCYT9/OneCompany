import { LINE_PATTERNS } from '@/lib/akrapovicFilterUtils';

// `extractProductLine` from akrapovicFilterUtils returns the first match in
// LINE_PATTERNS order, where `exhaust-system` is listed BEFORE `slip-on` /
// `evolution`. That order is right for the brand filter (where any match is
// fine) but wrong for editorial copy: "Slip-On Line Exhaust System" should be
// classified as Slip-On, not generic Exhaust System. Re-prioritize here.
const LINE_KEY_PRIORITY = [
  'sound-kit',
  'mounting-kit',
  'mid-pipe',
  'manifold',
  'evolution',
  'slip-on-race',
  'slip-on',
  'link-pipe',
  'downpipe',
  'tail-pipe',
  'rear-wing',
  'mirror-caps',
  'diffuser',
  'exhaust-system',
  'accessories',
] as const;

function classifyAkrapovicLine(title: string): string {
  for (const key of LINE_KEY_PRIORITY) {
    const def = LINE_PATTERNS.find((entry) => entry.key === key);
    if (!def) continue;
    if (def.patterns.some((rx) => rx.test(title))) return key;
  }
  return 'exhaust-system';
}

export type AkrapovicEditorialInput = {
  slug: string;
  titleEn: string;
  titleUa?: string | null;
  shortDescEn?: string | null;
  shortDescUa?: string | null;
  longDescEn?: string | null;
  longDescUa?: string | null;
  bodyHtmlEn?: string | null;
  bodyHtmlUa?: string | null;
  brand?: string | null;
  categoryEn?: string | null;
  categoryUa?: string | null;
  productType?: string | null;
  collectionEn?: string | null;
  collectionUa?: string | null;
  tags?: string[];
};

export type AkrapovicEditorialCopy = {
  titleUa: string;
  shortDescUa: string;
  longDescUa: string;
  bodyHtmlUa: string;
  seoTitleUa: string;
  seoDescriptionUa: string;
};

type LineMeta = { display: string; concept?: string };

// Line keys come from akrapovicFilterUtils.ts → LINE_PATTERNS. The display string
// keeps Akrapovič's official Latin product-line names (Slip-On Line, Evolution
// Line, etc.); the optional concept is the short Ukrainian explainer used inside
// the bullets — not part of the H1.
const LINE_LABELS: Record<string, LineMeta> = {
  'slip-on': { display: 'Slip-On Line', concept: 'задня частина (Slip-On / Axleback)' },
  'slip-on-race': { display: 'Slip-On Race Line', concept: 'задня частина (Slip-On / Axleback), трек-орієнтована' },
  evolution: { display: 'Evolution Line', concept: 'Cat-Back — середня + задня частина' },
  downpipe: { display: 'Downpipe', concept: 'секція від турбіни / випускного колектора' },
  'link-pipe': { display: 'Evolution Link Pipe', concept: "з'єднувальна секція між каталізатором і задньою частиною" },
  'mid-pipe': { display: 'Mid Pipe', concept: 'середня секція' },
  manifold: { display: 'Exhaust Manifold', concept: 'випускний колектор' },
  'tail-pipe': { display: 'Насадки вихлопу', concept: 'декоративні насадки до основної системи' },
  'sound-kit': { display: 'Sound & Control Kit', concept: 'електронний модуль керування заслінками' },
  'mounting-kit': { display: 'Mounting Kit', concept: 'комплект монтажу' },
  'rear-wing': { display: 'Rear Wing', concept: 'заднє антикрило' },
  'mirror-caps': { display: 'Mirror Caps', concept: 'накладки на дзеркала' },
  diffuser: { display: 'Rear Diffuser', concept: 'задній дифузор' },
  'exhaust-system': { display: 'Exhaust System', concept: 'вихлопна система' },
  accessories: { display: 'Accessory', concept: 'аксесуар Akrapovič' },
};

const FAMILY_DESCRIPTIONS: Record<string, string> = {
  'slip-on':
    'Slip-On — задня секція вихлопу Akrapovič: замінює штатні задні глушники, зберігаючи каталізатори та фронтальну секцію. Технічна назва задньої частини — також Axleback.',
  'slip-on-race':
    'Slip-On Race Line — спортивна версія задньої секції Akrapovič без OPF/GPF, орієнтована на трекове використання.',
  evolution:
    'Evolution Line — Cat-Back від Akrapovič: середня + задня частина системи, замінює штатний вихлоп від каталізаторів до насадок.',
  downpipe:
    'Downpipe Akrapovič — секція від турбіни / випускного колектора до решти системи. Збільшує пропускну здатність і знижує противотиск.',
  'link-pipe':
    "Link Pipe Akrapovič — з'єднувальна секція між каталізатором / downpipe і задньою частиною (Slip-On або Evolution Line).",
  'mid-pipe':
    "Mid Pipe Akrapovič — середня секція вихлопу, що з'єднує downpipe / каталізатор із задньою частиною.",
  manifold:
    'Випускний колектор Akrapovič — замінює штатний колектор і оптимізує газодинаміку перед турбіною / каталізатором.',
  'tail-pipe':
    'Комплект декоративних насадок вихлопу Akrapovič. Додатковий елемент до основної системи (Slip-On / Evolution Line).',
  'sound-kit':
    'Sound & Control Kit Akrapovič — електронний модуль керування заслінками вихлопу. Змінює тон і динаміку звуку у різних режимах.',
  'mounting-kit':
    'Комплект монтажу Akrapovič — кріплення, прокладки та супутні елементи для встановлення системи.',
  'rear-wing': 'Заднє антикрило Akrapovič — карбонова деталь з мотоспортивної програми бренду.',
  'mirror-caps': 'Накладки на дзеркала Akrapovič — карбонова деталь зовнішнього оздоблення.',
  diffuser: 'Задній дифузор Akrapovič — карбонова деталь зовнішнього оздоблення.',
  'exhaust-system': 'Вихлопна система Akrapovič — заводська конфігурація для вибраної платформи.',
  accessories: 'Фірмовий аксесуар Akrapovič.',
};

const CLOSING_SENTENCE =
  'Точна конфігурація та склад поставки залежать від офіційного артикула Akrapovič для конкретної платформи.';

const BRAND_TITLECASE: Array<[RegExp, string]> = [
  [/MERCEDES(?:[- ]BENZ)?(?:[- ]?AMG)?/gi, 'Mercedes'],
  [/PORSCHE/gi, 'Porsche'],
  [/FERRARI/gi, 'Ferrari'],
  [/TOYOTA/gi, 'Toyota'],
  [/NISSAN/gi, 'Nissan'],
  [/VOLKSWAGEN/gi, 'Volkswagen'],
  [/LAMBORGHINI/gi, 'Lamborghini'],
  [/MCLAREN/gi, 'McLaren'],
  [/CHEVROLET/gi, 'Chevrolet'],
  [/RENAULT/gi, 'Renault'],
  [/ABARTH/gi, 'Abarth'],
  [/ALFA\s+ROMEO/gi, 'Alfa Romeo'],
  [/CUPRA/gi, 'Cupra'],
  [/AUDI/gi, 'Audi'],
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeWhitespace(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();
}

function buildVehiclePhrase(titleEn: string): string {
  const afterFor = titleEn.match(/\bfor\s+(.+)$/i)?.[1];
  if (!afterFor) return '';

  let phrase = afterFor;

  // Drop trailing year ranges, year+ markers, "onwards" tails.
  phrase = phrase
    .replace(/\s+\d{4}\s*[–—\-]\s*\d{4}.*$/i, '')
    .replace(/\s+\d{4}\s*[+–—\-]\s*$/i, '')
    .replace(/\s+\d{4}\s*onwards.*$/i, '')
    .replace(/\s+\d{4}\s*$/i, '');

  // Drop trailing parenthetical fitment notes (OPF/GPF/ECE/EC/with.../without...).
  phrase = phrase
    .replace(/\s*\((?:OPF|GPF|ECE|EC|without|with|non-)[^)]*\)\s*$/i, '')
    .replace(/\s+(?:OPF\/GPF|OPF|GPF)\s*$/i, '')
    .replace(/[,;]\s*$/, '')
    .trim();

  for (const [pattern, replacement] of BRAND_TITLECASE) {
    phrase = phrase.replace(pattern, replacement);
  }

  return normalizeWhitespace(phrase);
}

function extractMaterial(titleEn: string): string | null {
  const parens = [...titleEn.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  for (const inner of parens) {
    if (/\bTitanium\b/i.test(inner)) return 'Titanium';
    if (/\bInconel\b/i.test(inner)) return 'Inconel';
    if (/\bStainless\s+Steel\b/i.test(inner)) return 'Stainless Steel';
    if (/\bCarbon\s+Fiber\b/i.test(inner)) return 'Carbon Fiber';
    if (/\bCarbon\b/i.test(inner)) return 'Carbon';
    if (/\bStainless\b/i.test(inner)) return 'Stainless Steel';
  }
  if (/\bTitanium\b/i.test(titleEn)) return 'Titanium';
  if (/\bInconel\b/i.test(titleEn)) return 'Inconel';
  if (/\bStainless\s+Steel\b/i.test(titleEn)) return 'Stainless Steel';
  if (/\bCarbon\s+Fiber\b/i.test(titleEn)) return 'Carbon Fiber';
  if (/\bCarbon\b/i.test(titleEn)) return 'Carbon';
  return null;
}

function extractApproval(titleEn: string): string | null {
  if (/\bECE\s+Type\s+Approval\b/i.test(titleEn)) return 'ECE Type Approval';
  if (/\bECE\b/i.test(titleEn)) return 'ECE';
  if (/\bEC\s+Approval\b/i.test(titleEn)) return 'EC Approval';
  if (/\bOPF\s*\/\s*GPF\b/i.test(titleEn)) return 'OPF/GPF compatible';
  if (/\bOPF\b/i.test(titleEn)) return 'OPF compatible';
  if (/\bGPF\b/i.test(titleEn)) return 'GPF compatible';
  return null;
}

export function extractAkrapovicSkuFromTitle(titleEn: string | null | undefined): string | null {
  const value = String(titleEn ?? '').trim();
  if (!value) return null;
  const match = value.match(/^\s*AKRAPOVI[CČ]\s+([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+)/);
  return match ? match[1].toUpperCase() : null;
}

export function buildAkrapovicEditorialCopy(input: AkrapovicEditorialInput): AkrapovicEditorialCopy {
  const titleEn = normalizeWhitespace(input.titleEn);
  const productLineKey = classifyAkrapovicLine(titleEn);
  const lineLabel = LINE_LABELS[productLineKey] ?? LINE_LABELS['exhaust-system'];
  const sku = extractAkrapovicSkuFromTitle(titleEn);
  const material = extractMaterial(titleEn);
  const approval = extractApproval(titleEn);
  const vehicle = buildVehiclePhrase(titleEn);
  const familyDescription =
    FAMILY_DESCRIPTIONS[productLineKey] ?? FAMILY_DESCRIPTIONS['exhaust-system'];

  const titleHead = lineLabel.display;
  const titleUa = vehicle
    ? `${titleHead} — Akrapovič для ${vehicle}`
    : `${titleHead} — Akrapovič`;

  const shortDescUa = familyDescription;

  const bullets: string[] = [];
  if (sku) bullets.push(`<li><strong>Артикул:</strong> ${escapeHtml(sku)}</li>`);
  bullets.push(
    `<li><strong>Лінійка:</strong> ${escapeHtml(lineLabel.display)}${
      lineLabel.concept ? ` — ${escapeHtml(lineLabel.concept)}` : ''
    }</li>`
  );
  if (vehicle) bullets.push(`<li><strong>Платформа:</strong> ${escapeHtml(vehicle)}</li>`);
  if (material) bullets.push(`<li><strong>Матеріал:</strong> ${escapeHtml(material)}</li>`);
  if (approval) bullets.push(`<li><strong>Сертифікація:</strong> ${escapeHtml(approval)}</li>`);

  const bodyHtmlUa = [
    `<p>${escapeHtml(familyDescription)}</p>`,
    `<ul>${bullets.join('')}</ul>`,
    `<p>${escapeHtml(CLOSING_SENTENCE)}</p>`,
  ].join('');

  const longDescUa = `${familyDescription} ${CLOSING_SENTENCE}`;

  return {
    titleUa,
    shortDescUa,
    longDescUa,
    bodyHtmlUa,
    seoTitleUa: titleUa,
    seoDescriptionUa: shortDescUa,
  };
}
