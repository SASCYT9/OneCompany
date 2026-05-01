// RaceChip slug → human label utilities. Used by hero picker, catalog filter,
// and product-card subtitles. Keep aligned with scripts/import-racechip.ts and
// scripts/generate-racechip-catalog.mjs (those run server-side at scrape/import).

const MAKE_SPECIAL: Record<string, string> = {
  bmw: 'BMW',
  vw: 'Volkswagen',
  'mercedes-benz': 'Mercedes-Benz',
  'alfa-romeo': 'Alfa Romeo',
  'land-rover': 'Land Rover',
  'rolls-royce': 'Rolls-Royce',
  'aston-martin': 'Aston Martin',
  ds: 'DS',
  mg: 'MG',
  mini: 'MINI',
  gmc: 'GMC',
  ram: 'RAM',
  kia: 'Kia',
  ssangyong: 'SsangYong',
  ldv: 'LDV',
  mclaren: 'McLaren',
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtToken(part: string): string {
  if (!part) return part;
  // roman numerals
  if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(part)) return part.toUpperCase();
  // chassis codes like g30, w205, f10, x5
  if (/^[a-z]\d+$/i.test(part)) return part.toUpperCase();
  // pure digits
  if (/^\d+$/.test(part)) return part;
  // short tokens — model code abbreviations like rs, tt, q5, 8s, 4g
  if (part.length <= 3) return part.toUpperCase();
  return capitalize(part);
}

export function formatRacechipMake(slug: string): string {
  if (!slug) return '';
  if (MAKE_SPECIAL[slug]) return MAKE_SPECIAL[slug];
  return slug.split('-').map(capitalize).join(' ');
}

export function formatRacechipModel(slug: string): string {
  if (!slug) return '';
  // Strip year tokens — handle both `from-YYYY` and `YYYY-to-YYYY`
  const cleaned = slug
    .replace(/-?from-\d{4}/, '')
    .replace(/-?\d{4}-to-\d{4}/, '')
    .replace(/^-|-$/g, '');

  // `_` separator denotes alternative chassis (e.g. `8t_8f`) — render with `/`.
  return cleaned
    .split('-')
    .map((part) => {
      if (part.includes('_')) {
        return part.split('_').map(fmtToken).join('/');
      }
      return fmtToken(part);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractRacechipYears(slug: string): string {
  const range = slug.match(/(\d{4})-to-(\d{4})/);
  if (range) return `${range[1]}–${range[2]}`;
  const from = slug.match(/from-(\d{4})/);
  if (from) return `${from[1]}+`;
  return '';
}

// The label shown in dropdowns: model + parenthesized years when available.
export function formatRacechipModelLabel(slug: string): string {
  const model = formatRacechipModel(slug);
  const years = extractRacechipYears(slug);
  return years ? `${model} (${years})` : model;
}

const ENGINE_FIXES: Array<[RegExp, string]> = [
  [/\bTdci\b/g, 'TDCi'],
  [/\bTdi\b/g, 'TDi'],
  [/\bTsi\b/g, 'TSI'],
  [/\bTfsi\b/g, 'TFSI'],
  [/\bEcoboost\b/g, 'EcoBoost'],
  [/\bEcoblue\b/g, 'EcoBlue'],
  [/\bMultijet\b/g, 'MultiJet'],
  [/\bJtd\b/g, 'JTD'],
  [/\bHpi\b/g, 'HPI'],
  [/\bHpt\b/g, 'HPT'],
  [/\bMzr\b/g, 'MZR'],
];

// Engine slug → readable spec. Examples:
//   "1-6-d-1598ccm-116hp-85kw-300nm" → "1.6 D 116 HP / 85 kW / 300 Nm"
//   "rs6-4-0-tfsi-3993ccm-560hp-412kw-700nm" → "RS6 4.0 TFSI 560 HP / 412 kW / 700 Nm"
//   "rs6-performance-3993ccm-605hp-445kw-750nm" → "RS6 Performance 605 HP / 445 kW / 750 Nm"
export function formatRacechipEngine(slug: string): string {
  if (!slug) return '';
  // 1) Pull out the spec triplet (HP/kW/Nm) before any other transformation
  const hpMatch = slug.match(/(\d+)hp/);
  const kwMatch = slug.match(/(\d+)kw/);
  const nmMatch = slug.match(/(\d+)nm/);
  // 2) Strip the spec tail (-NNNNccm-...) so only the engine name remains
  let s = slug.replace(/-\d+ccm.*$/, '');
  // 3) Restore a single decimal in the displacement (first single-digit/single-digit
  //    pair in the remaining tokens). Catches both `1-6-...` (leading) and
  //    `rs6-4-0-...` (after a model-code prefix).
  s = s.replace(/(?:^|-)(\d)-(\d)(?=-|$)/, (m, a, b, off) =>
    (off === 0 ? '' : '-') + `${a}.${b}`,
  );

  // Tokenize remaining engine name
  const name = s
    .split('-')
    .map((p) => fmtToken(p))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Apply readability fixes for known engine acronyms
  let nice = name;
  for (const [re, repl] of ENGINE_FIXES) nice = nice.replace(re, repl);

  const specs: string[] = [];
  if (hpMatch) specs.push(`${hpMatch[1]} HP`);
  if (kwMatch) specs.push(`${kwMatch[1]} kW`);
  if (nmMatch) specs.push(`${nmMatch[1]} Nm`);
  return specs.length ? `${nice} ${specs.join(' / ')}`.trim() : nice;
}
