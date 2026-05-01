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

// Common short English words used in model names that must NOT be uppercased.
// Without this list, the "≤3 chars → toUpperCase" rule turns "Max" → "MAX",
// "Gen" → "GEN", "3rd" → "3RD".
const KEEP_TITLECASE_SHORT = new Set([
  'max', 'gen', 'pro', '3rd', '2nd', '1st', 'gt4', // edge case; stays as-is
]);

function fmtToken(part: string): string {
  if (!part) return part;
  // Underscore = alternate-chassis separator (e.g. 8t_8f → "8T/8F", f06_f12 → "F06/F12")
  if (part.includes('_')) {
    return part.split('_').map(fmtToken).join('/');
  }
  // roman numerals
  if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(part)) return part.toUpperCase();
  // Any alphanumeric token containing a digit, length ≤ 8 — chassis code,
  // uppercase entirely. Covers c7, w213, am65, t8, 8x, 8s, cl203, cw0w,
  // ca30w, vf3a, ys3f. Without this rule, mixed-pattern tokens like "cw0w"
  // would fall through to capitalize() and become "Cw0w".
  if (/\d/.test(part) && /^[a-z0-9]+$/i.test(part) && part.length <= 8) {
    return part.toUpperCase();
  }
  // pure digits
  if (/^\d+$/.test(part)) return part;
  // English words that must stay title-cased even though they're short
  if (KEEP_TITLECASE_SHORT.has(part.toLowerCase())) return capitalize(part);
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

// ──────────────────────────────────────────────────────────────────────
// Model/chassis split — for catalog filter that wants Make → Model → Кузов.
// The modelSlug like "rs6-c7-2011-to-2019" splits into:
//   modelKey = "rs6", modelLabel = "RS6"
//   chassisKey = "c7", chassisLabel = "C7 (2011–2019)"
// ──────────────────────────────────────────────────────────────────────

const ROMAN_RE = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;
// Common English/marketing suffixes that look like 3-4 letter chassis but are
// actually part of the model name. Without this list we'd eat "Class" off
// "E-Class", "Type" off "F-Type", "Life" off "Zafira Life", etc.
const NOT_CHASSIS_WORDS = new Set([
  'gen', 'class', 'klasse', 'door', 'turismo', 'cabrio', 'coupe', 'roadster',
  'avant', 'estate', 'spider', 'max', 'series', 'grand', 'sport', 'tourneo',
  'connect', 'plus', 'pro', 'lite', 'long', 'short', 'amg',
  'type', 'life', 'spur', 'cross', 'star', 'crew', 'cab', 'wagon', 'targa',
]);

// Performance-prefix words that always combine with the next token to form
// the full model name — e.g. "rs-q3" → "RS Q3" (not "RS" + chassis "Q3").
// Without this list, the walk-back logic would peel "Q3" off the model and
// classify it as part of the chassis.
const MODEL_PREFIXES = new Set(['rs', 'tt']);

function looksLikeChassis(tok: string): boolean {
  if (!tok) return false;
  const lower = tok.toLowerCase();
  if (NOT_CHASSIS_WORDS.has(lower)) return false;
  if (ROMAN_RE.test(tok)) return true;                              // iii, viii
  // Any alphanumeric token containing a digit (covers c7, w213, 8x, 8s, 4g,
  // 4d2, 470, 75, cw0w, ca30w, vf3a, ys3f, etc.). The length cap stops 9-char
  // words that happen to contain a digit from being misclassified.
  if (/\d/.test(tok) && /^[a-z0-9]+$/i.test(tok) && tok.length <= 8) return true;
  // Underscore-separated tokens. With digits → definitely chassis (8t_8f,
  // 312_319, f06_f12). All-letter (no digits) → only if mostly single-letter
  // parts (fd_a_n_k = chassis), not multi-word model variants (kasten_tepee).
  if (tok.includes('_') && /^[a-z0-9_]+$/i.test(tok) && tok.length <= 14) {
    if (/\d/.test(tok)) return true;
    const parts = tok.split('_');
    const shortShare = parts.filter((p) => p.length <= 2).length / parts.length;
    return shortShare >= 0.6;
  }
  // Short all-letter codes: c (Corsa C), fjb, gba, jc
  if (/^[a-z]+$/i.test(tok) && tok.length <= 4) return true;
  return false;
}

export type RacechipModelParts = {
  fullSlug: string;
  modelKey: string;          // e.g. "rs6", "tt-rs", "rs-q3", "e-class"
  modelLabel: string;        // e.g. "RS6", "TT RS", "RS Q3", "E Class"
  chassisKey: string;        // unique per (make, modelKey) — full suffix incl. years, e.g. "c8-from-2019"
  chassisLabel: string;      // e.g. "C8 (2019+)", "B9 Facelift (2019+)"
  years: string;             // e.g. "2011–2019", "2019+"
};

function normalizeBmwSeries(p: RacechipModelParts, make?: string): RacechipModelParts {
  // Racechip uses two slug conventions for the same BMW series:
  //   "7-series-e38-1994-to-2001" → modelKey "7-series", label "7 Series"
  //   "7-g70-from-2022"           → modelKey "7",        label "7"
  // Collapse single-digit BMW model keys to the "-series" form so the
  // model dropdown shows one entry per series instead of two.
  if (make === 'bmw' && /^[1-8]$/.test(p.modelKey)) {
    return {
      ...p,
      modelKey: `${p.modelKey}-series`,
      modelLabel: `${p.modelLabel} Series`,
    };
  }
  return p;
}

export function parseRacechipModelSlug(slug: string, make?: string): RacechipModelParts {
  const years = extractRacechipYears(slug);
  // For modelKey/chassisKey we work on year-stripped slug. The chassisKey at
  // the END is computed from the ORIGINAL slug (so it carries year tokens
  // and remains unique per generation).
  let yearStripped = slug
    .replace(/-?from-\d{4}/, '')
    .replace(/-?\d{4}-to-\d{4}/, '')
    .replace(/^-|-$/g, '');

  let suffix = '';
  let yearStrippedNoFacelift = yearStripped;
  if (yearStrippedNoFacelift.endsWith('-facelift')) {
    suffix = ' Facelift';
    yearStrippedNoFacelift = yearStrippedNoFacelift.slice(0, -'-facelift'.length);
  }

  const tokens = yearStrippedNoFacelift.split('-').filter(Boolean);

  function makeParts(modelTokens: string[], chassisTokens: string[]): RacechipModelParts {
    const modelKey = modelTokens.join('-');
    // chassisKey is whatever in the original slug comes AFTER `${modelKey}-`.
    // Falls back to the joined chassis tokens when modelKey is empty.
    const chassisKey =
      modelKey && slug.startsWith(modelKey + '-')
        ? slug.slice(modelKey.length + 1)
        : chassisTokens.join('-');
    const chassisLabel = chassisTokens.map(fmtToken).join(' ').trim() + suffix;
    const yearStr = years ? ` (${years})` : '';
    return normalizeBmwSeries({
      fullSlug: slug,
      modelKey,
      modelLabel: modelTokens.map(fmtToken).join(' ').trim(),
      chassisKey,
      chassisLabel: (chassisLabel + yearStr).trim(),
      years,
    }, make);
  }

  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];

    if (looksLikeChassis(last)) {
      // Walk backwards from the last token to gather all chassis-with-digit
      // tokens. Catches BMW patterns like "1-series-e81-82_87-88" → chassis
      // "E81 82/87 88" with model "1 Series", or "m6-f06_f12-13" → chassis
      // "F06/F12 13" with model "M6". Stops at the first non-chassis token
      // (e.g. "series", "class") or any token without a digit.
      const startBeforeWalkback = tokens.length - 1;
      let chassisStart = startBeforeWalkback;
      while (chassisStart > 1) {
        const tok = tokens[chassisStart - 1];
        if (looksLikeChassis(tok) && /\d/.test(tok)) {
          chassisStart--;
        } else {
          break;
        }
      }
      const walkedBack = chassisStart < startBeforeWalkback;

      // Roman-numeral generation marker before chassis — e.g. "civic-ix-fk"
      // ("ix" has no digit so the walk-back above doesn't catch it) or
      // "cr-v-v-rw" (single letter "v" matches roman).
      if (
        !walkedBack &&
        chassisStart > 0 &&
        ROMAN_RE.test(tokens[chassisStart - 1]) &&
        !ROMAN_RE.test(last)
      ) {
        chassisStart--;
      }

      // Don't strip the second token away if the first is a known
      // performance prefix that always combines with the next token to form
      // the full model name — e.g. "rs-q3-f3" (model "RS Q3", chassis "F3"),
      // not (model "RS", chassis "Q3 F3"). Only fires when walk-back actually
      // moved chassisStart back; otherwise "tt-8s" would also collapse.
      if (
        walkedBack &&
        chassisStart === 1 &&
        MODEL_PREFIXES.has(tokens[0].toLowerCase())
      ) {
        chassisStart = 2;
      }

      return makeParts(tokens.slice(0, chassisStart), tokens.slice(chassisStart));
    }
  }

  // No identifiable chassis — entire token list is the model name.
  const modelKey = yearStrippedNoFacelift || slug;
  const chassisKey =
    modelKey && slug.startsWith(modelKey + '-')
      ? slug.slice(modelKey.length + 1)
      : suffix
        ? 'facelift'
        : '';
  return normalizeBmwSeries({
    fullSlug: slug,
    modelKey,
    modelLabel: tokens.map(fmtToken).join(' ').trim(),
    chassisKey,
    chassisLabel: ((suffix.trim() || '') + (years ? ` (${years})` : '')).trim(),
    years,
  }, make);
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
