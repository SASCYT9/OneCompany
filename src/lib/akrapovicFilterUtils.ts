/** Parse vehicle brand + product line + model (chassis code) from Akrapovič product titles */

export const BRAND_PATTERNS: { key: string; patterns: RegExp[] }[] = [
  { key: "BMW", patterns: [/\bBMW\b/i] },
  { key: "Porsche", patterns: [/\bPORSCHE\b/i, /\bMACAN\b/i, /\bCAYENNE\b/i, /\bPANAMERA\b/i, /\bTAYCAN\b/i] },
  { key: "Mercedes-AMG", patterns: [/\bMERCEDES(?:[- ]BENZ)?[- ]?AMG\b/i, /\bMERCEDES(?:[- ]BENZ)?\b.*\bAMG\b/i] },
  { key: "Audi", patterns: [/\bAUDI\b/i] },
  { key: "Cupra", patterns: [/\bCUPRA\b/i] },
  { key: "Lamborghini", patterns: [/\bLAMBORGHINI\b/i] },
  { key: "Ferrari", patterns: [/\bFERRARI\b/i] },
  { key: "McLaren", patterns: [/\bMCLAREN\b/i] },
  { key: "Toyota", patterns: [/\bTOYOTA\b/i, /\bGR\s*SUPRA\b/i, /\bSUPRA\b/i] },
  { key: "Nissan", patterns: [/\bNISSAN\b/i] },
  { key: "Volkswagen", patterns: [/\bVOLKSWAGEN\b/i, /\bVW\b/i] },
  { key: "Chevrolet", patterns: [/\bCHEVROLET\b/i] },
  { key: "Renault", patterns: [/\bRENAULT\b/i] },
  { key: "Mini", patterns: [/\bMINI\b/i] },
  { key: "Abarth", patterns: [/\bABARTH\b/i] },
  { key: "Ford", patterns: [/\bFORD\b/i] },
  { key: "Alfa Romeo", patterns: [/\bALFA\s*ROMEO\b/i] },
];

/**
 * Marketing-name patterns per brand. Drives the "Модель" dropdown that sits between
 * Brand and Body/Chassis. Order matters: more specific trims (M340i, M440i) come before
 * generic (M3, M4) so the negative-lookahead-free generic patterns don't swallow them —
 * but we also use lookaheads on M2/M3/M4/M5/M8 to be safe against M240/M340/M440/M550/M850.
 */
export const MODEL_PATTERNS_BY_BRAND: Record<string, { model: string; pattern: RegExp }[]> = {
  Porsche: [
    { model: "911",      pattern: /\b911\b/i },
    { model: "718",      pattern: /\b(?:718|Boxster|Cayman)\b/i },
    { model: "Cayenne",  pattern: /\bCayenne\b/i },
    { model: "Macan",    pattern: /\bMacan\b/i },
    { model: "Panamera", pattern: /\bPanamera\b/i },
    { model: "Taycan",   pattern: /\bTaycan\b/i },
  ],
  BMW: [
    { model: "M135i/M140i", pattern: /\b(?:M135[id]|M140[id])\b/i },
    { model: "M235i/M240i", pattern: /\b(?:M235[id]|M240[id])\b/i },
    { model: "M340i/M340d", pattern: /\bM340[id]\b/i },
    { model: "M440i/M440d", pattern: /\bM440[id]\b/i },
    { model: "M550i",       pattern: /\bM550[id]\b/i },
    { model: "M850i",       pattern: /\bM850[id]\b/i },
    { model: "X3 M",        pattern: /\bX3\s*M\b/i },
    { model: "X4 M",        pattern: /\bX4\s*M\b/i },
    { model: "X5 M",        pattern: /\bX5\s*M\b/i },
    { model: "X6 M",        pattern: /\bX6\s*M\b/i },
    { model: "M2",          pattern: /\bM2\b/i },
    { model: "M3",          pattern: /\bM3\b/i },
    { model: "M4",          pattern: /\bM4\b/i },
    { model: "M5",          pattern: /\bM5\b/i },
    { model: "M8",          pattern: /\bM8\b/i },
    { model: "Z4",          pattern: /\bZ4\b/i },
  ],
  Audi: [
    { model: "RS3",   pattern: /\bRS\s*3\b/i },
    { model: "RS4",   pattern: /\bRS\s*4\b/i },
    { model: "RS5",   pattern: /\bRS\s*5\b/i },
    { model: "RS6",   pattern: /\bRS\s*6\b/i },
    { model: "RS7",   pattern: /\bRS\s*7\b/i },
    { model: "RS Q3", pattern: /\bRS\s*Q3\b/i },
    { model: "RS Q5", pattern: /\bRS\s*Q5\b/i },
    { model: "RS Q8", pattern: /\bRS\s*Q8\b/i },
    { model: "TT-RS", pattern: /\bTT[\s-]*RS\b/i },
    { model: "R8",    pattern: /\bR8\b/i },
    { model: "S3",    pattern: /\bS3\b/i },
    { model: "S4",    pattern: /\bS4\b/i },
    { model: "S5",    pattern: /\bS5\b/i },
  ],
  "Mercedes-AMG": [
    { model: "A45",    pattern: /\bA\s*45\b/i },
    { model: "CLA45",  pattern: /\bCLA\s*45\b/i },
    { model: "GLA45",  pattern: /\bGLA\s*45\b/i },
    { model: "C63",    pattern: /\bC\s*63\b/i },
    { model: "E63",    pattern: /\bE\s*63\b/i },
    { model: "GLC63",  pattern: /\bGLC\s*63\b/i },
    { model: "GLE63",  pattern: /\bGLE\s*63\b/i },
    { model: "G63",    pattern: /\bG\s*63\b/i },
    { model: "S63",    pattern: /\bS\s*63\b/i },
    { model: "SL63",   pattern: /\bSL\s*63\b/i },
    { model: "AMG GT", pattern: /\bAMG\s+GT\b/i },
  ],
  Toyota: [
    { model: "GR Supra", pattern: /\b(?:GR\s*)?Supra\b/i },
    { model: "GR Yaris", pattern: /\bYaris\b/i },
  ],
  Nissan: [
    { model: "GT-R", pattern: /\bGT-?R\b/i },
    { model: "370Z", pattern: /\b370\s*Z\b/i },
  ],
  Chevrolet: [
    { model: "Corvette", pattern: /\bCorvette\b/i },
    { model: "Camaro",   pattern: /\bCamaro\b/i },
  ],
  Ferrari: [
    { model: "488",  pattern: /\b488\b/i },
    { model: "F8",   pattern: /\bF8\b/i },
    { model: "296",  pattern: /\b296\b/i },
    { model: "812",  pattern: /\b812\b/i },
    { model: "Roma", pattern: /\bRoma\b/i },
  ],
  Lamborghini: [
    { model: "Huracán",   pattern: /\bHuracan\b/i },
    { model: "Aventador", pattern: /\bAventador\b/i },
    { model: "Urus",      pattern: /\bUrus\b/i },
  ],
  McLaren: [
    { model: "720S",  pattern: /\b720\s*S\b/i },
    { model: "765LT", pattern: /\b765\s*LT\b/i },
    { model: "570S",  pattern: /\b570\s*S\b/i },
  ],
  "Alfa Romeo": [
    { model: "Giulia",  pattern: /\bGiulia\b/i },
    { model: "Stelvio", pattern: /\bStelvio\b/i },
  ],
  Cupra: [
    { model: "Formentor", pattern: /\bFormentor\b/i },
    { model: "Leon",      pattern: /\bLeon\b/i },
  ],
  Volkswagen: [
    { model: "Golf", pattern: /\bGolf\b/i },
    { model: "Polo", pattern: /\bPolo\b/i },
  ],
  Renault: [
    { model: "Mégane RS", pattern: /\bMegane\b/i },
  ],
  Mini: [
    { model: "Cooper", pattern: /\bCooper\b/i },
  ],
  Abarth: [
    { model: "595", pattern: /\b595\b/i },
    { model: "695", pattern: /\b695\b/i },
  ],
  Ford: [
    { model: "Mustang",  pattern: /\bMustang\b/i },
    { model: "Focus RS", pattern: /\bFocus\s*RS\b/i },
  ],
};

/**
 * Extract marketing model names (911, M3, RS6, Cayenne…) from a title for a given brand.
 * Multi-model titles like "BMW M3 (G80) / M4 (G82)" return both models.
 *
 * Note: the sibling function `extractVehicleModelsForBrand` despite its name returns
 * **chassis codes** (G80, 992, C8) — kept as-is for back-compat with existing call sites.
 */
export function extractVehicleModelNamesForBrand(title: string, brand: string): string[] {
  const patterns = MODEL_PATTERNS_BY_BRAND[brand];
  if (!patterns) return [];
  const matches = new Set<string>();
  for (const { model, pattern } of patterns) {
    if (pattern.test(title)) matches.add(model);
  }
  return [...matches];
}

/**
 * Whitelist of valid chassis codes per brand+model. Used as a final filter in
 * `extractChassisForBrandAndModel` to suppress cross-pollination from multi-model
 * titles like "BMW M2 (F87) / M235i (F22) / M340i (G20)" where a single product
 * lists chassis for several different model groups.
 *
 * If a model has no entry here, the per-segment extraction passes through unfiltered.
 */
const VALID_CHASSIS_BY_BRAND_MODEL: Record<string, Record<string, string[]>> = {
  Porsche: {
    "911":      ["991", "992", "996", "997"],
    "718":      ["718", "981", "982"],
    "Cayenne":  ["92A", "958", "9YA", "9YB", "E3"],
    "Macan":    ["95B", "536"],
    "Panamera": ["970", "971", "972"],
    "Taycan":   ["J1"],
  },
  BMW: {
    "M2":           ["F87", "G87"],
    "M3":           ["E36", "E46", "E90", "E92", "E93", "F80", "G80", "G81"],
    "M4":           ["F82", "F83", "G82", "G83"],
    "M5":           ["E28", "E34", "E39", "E60", "F10", "F90", "G90"],
    "M8":           ["F91", "F92", "F93"],
    "X3 M":         ["F97"],
    "X4 M":         ["F98"],
    "X5 M":         ["F95"],
    "X6 M":         ["F96"],
    "Z4":           ["G29"],
    "M135i/M140i":  ["F20", "F21", "F40"],
    "M235i/M240i":  ["F22", "F23", "G42"],
    "M340i/M340d":  ["G20", "G21"],
    "M440i/M440d":  ["G22", "G23"],
    "M550i":        ["G30"],
    "M850i":        ["G14", "G15", "G16"],
  },
  Audi: {
    "RS3":   ["8V", "8Y"],
    "RS4":   ["B7", "B8", "B9"],
    "RS5":   ["B8", "B9"],
    "RS6":   ["C5", "C6", "C7", "C8"],
    "RS7":   ["C7", "C8"],
    "TT-RS": ["8J", "8S"],
    "R8":    ["4S", "4M"],
    "RS Q3": ["8U", "F3"],
    "RS Q5": ["FY"],
    "RS Q8": ["F1"],
    "S3":    ["8V", "8Y"],
    "S4":    ["B8", "B9"],
    "S5":    ["B8", "B9"],
  },
  "Mercedes-AMG": {
    "A45":    ["W176", "W177"],
    "CLA45":  ["C117", "X117", "C118", "X118"],
    "GLA45":  ["X156", "X247", "H247"],
    "C63":    ["W204", "C204", "S204", "W205", "C205", "S205", "A205", "W206", "S206"],
    "E63":    ["W211", "S211", "W212", "S212", "W213", "S213"],
    "GLC63":  ["X253", "C253", "X254"],
    "GLE63":  ["W166", "W167", "C167"],
    "G63":    ["W463", "W463A", "W465"],
    "S63":    ["W221", "W222", "W223"],
    "SL63":   ["R231", "R232"],
    "AMG GT": ["C190", "C192", "X290"],
  },
  Toyota: {
    "GR Supra": ["A90", "A91"],
  },
  Nissan: {
    "GT-R": ["R35"],
    "370Z": ["Z34"],
  },
  Chevrolet: {
    "Corvette": ["C5", "C6", "C7", "C8"],
  },
};

export const LINE_PATTERNS: { key: string; label: string; patterns: RegExp[] }[] = [
  { key: "sound-kit", label: "Sound & Control Kit", patterns: [/sound\s*(control\s*)?kit/i, /exhaust\s+sound\s+control/i, /control\s+kit/i, /valve\s+(actuator\s+)?control/i, /(?:central\s+)?valve\s+actuator\s+kit/i, /control\s+system/i] },
  { key: "mounting-kit", label: "Mounting Kit", patterns: [/mounting\s*kit/i] },
  { key: "mid-pipe", label: "Mid Pipe", patterns: [/mid[- ]?pipe/i] },
  { key: "manifold", label: "Exhaust Manifold", patterns: [/manifold/i] },
  { key: "exhaust-system", label: "Exhaust System", patterns: [/\bexhaust\s+system\b/i] },
  { key: "evolution", label: "Evolution Line", patterns: [/evolution\s*(line|link|header)/i] },
  { key: "slip-on-race", label: "Slip-On Race Line", patterns: [/slip[- ]?on\s*race/i] },
  { key: "slip-on", label: "Slip-On Line", patterns: [/slip[- ]?on\s*line/i, /slip[- ]?on\b/i] },
  { key: "link-pipe", label: "Link Pipe", patterns: [/link\s*pipe/i] },
  { key: "downpipe", label: "Downpipe", patterns: [/downpipe/i] },
  { key: "tail-pipe", label: "Tail Pipe Set", patterns: [/tail\s*pipe/i, /\bTP-/i] },
  { key: "rear-wing", label: "Rear Wing", patterns: [/rear\s*wing/i, /rear\s*spoiler/i] },
  { key: "mirror-caps", label: "Mirror Caps", patterns: [/mirror\s*cap/i] },
  { key: "diffuser", label: "Diffuser", patterns: [/diffuser/i] },
  { key: "accessories", label: "Accessories & Merch", patterns: [/rear\s+section\s+guard/i, /\bcap\b/i, /flash\s+drive/i, /\bpolo\s+shirt\b/i, /\bshirt\b/i, /\busb\b/i] },
];

export function extractVehicleBrand(title: string): string | null {
  const afterFor = title.match(/\bfor\s+(.+)$/i)?.[1] ?? title;
  for (const { key, patterns } of BRAND_PATTERNS) {
    for (const rx of patterns) {
      if (rx.test(afterFor)) return key;
    }
  }
  if (afterFor !== title) {
    for (const { key, patterns } of BRAND_PATTERNS) {
      for (const rx of patterns) {
        if (rx.test(title)) return key;
      }
    }
  }
  return null;
}

export function extractVehicleBrands(title: string): string[] {
  const afterFor = title.match(/\bfor\s+(.+)$/i)?.[1] ?? title;
  const matches: string[] = [];
  for (const { key, patterns } of BRAND_PATTERNS) {
    if (patterns.some((rx) => rx.test(afterFor))) {
      matches.push(key);
    }
  }
  return matches;
}

export function extractProductLine(title: string): string | null {
  for (const { key, patterns } of LINE_PATTERNS) {
    for (const rx of patterns) {
      if (rx.test(title)) return key;
    }
  }
  return null;
}

function extractChassisFromParentheses(inner: string): string | null {
  return extractChassisCodesFromParentheses(inner)[0] ?? null;
}

function extractChassisCodesFromParentheses(inner: string): string[] {
  const normalized = inner.trim();
  if (/^\d{4}[-–]\d{4}$/.test(normalized)) return [];
  if (/^\d{4}$/.test(normalized)) return [];
  if (/^(Titanium|Stainless Steel|Carbon|Gloss|Matte|ECE|OPF|GPF|without)/i.test(normalized)) return [];

  const matches = normalized.match(/[A-Z]?\d{1,3}[A-Z]?(?:\.\d+)?/gi) ?? [];
  return Array.from(
    new Set(matches.map((match) => match.replace(/\.\d+$/, "").toUpperCase()))
  );
}

function inferBrandsFromVehicleSegment(segment: string): string[] {
  const matches = new Set<string>();
  for (const { key, patterns } of BRAND_PATTERNS) {
    if (patterns.some((rx) => rx.test(segment))) {
      matches.add(key);
    }
  }

  if (/\bZ4\b|\bM[2-8]\b|\bX[3-7]\s*M?\b/i.test(segment)) {
    matches.add("BMW");
  }
  if (/\bGR\s*SUPRA\b|\bSUPRA\b|\bA90\b/i.test(segment)) {
    matches.add("Toyota");
  }

  return [...matches];
}

function findVehicleSegmentBeforeParen(afterFor: string, parenIndex: number): string {
  const before = afterFor.slice(0, parenIndex);
  const separators = [...before.matchAll(/[\/,;|]/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);

  for (let i = separators.length - 1; i >= 0; i -= 1) {
    const candidate = before.slice(separators[i] + 1);
    if (inferBrandsFromVehicleSegment(candidate).length > 0) {
      return candidate;
    }
  }

  const lastSeparator = separators.at(-1);
  return lastSeparator == null ? before : before.slice(lastSeparator + 1);
}

const BRAND_MODEL_FALLBACKS: { brand: string; match: RegExp; model: string }[] = [
  { brand: "BMW", match: /\bBMW\s+Z4(?:\s+M40i)?\b/i, model: "G29" },
];

/**
 * Marketing trim names (M440i, X5M, A45, RS6 …) ↔ chassis codes (G22/G23, F95, W177, C8 …).
 *
 * Used when a title references the trim only, with no chassis code in parentheses.
 * Brands like Porsche/Ferrari are not listed because their model name doubles as the chassis
 * (992, 488, F8 …). Entries with `chassis: []` are recognised model designations that should
 * NOT be promoted to chassis codes (e.g. Porsche GT3 / GT3 RS) — they fall through to "Other".
 */
const TRIM_TO_CHASSIS: Record<string, { brand: string; chassis: string[] }> = {
  // BMW
  M135I: { brand: "BMW", chassis: ["F40"] },
  M140I: { brand: "BMW", chassis: ["F20"] },
  M235I: { brand: "BMW", chassis: ["F22"] },
  M240I: { brand: "BMW", chassis: ["F22", "G42"] },
  M340I: { brand: "BMW", chassis: ["G20", "G21"] },
  M340D: { brand: "BMW", chassis: ["G20", "G21"] },
  M440I: { brand: "BMW", chassis: ["G22", "G23"] },
  M440D: { brand: "BMW", chassis: ["G22", "G23"] },
  M550I: { brand: "BMW", chassis: ["G30"] },
  M850I: { brand: "BMW", chassis: ["G14", "G15", "G16"] },
  X3M: { brand: "BMW", chassis: ["F97"] },
  X4M: { brand: "BMW", chassis: ["F98"] },
  X5M: { brand: "BMW", chassis: ["F95"] },
  X6M: { brand: "BMW", chassis: ["F96"] },
  // Audi
  RS3: { brand: "Audi", chassis: ["8Y"] },
  RS6: { brand: "Audi", chassis: ["C8"] },
  RS7: { brand: "Audi", chassis: ["C8"] },
  // Mercedes-AMG
  A45: { brand: "Mercedes-AMG", chassis: ["W177"] },
  A45S: { brand: "Mercedes-AMG", chassis: ["W177"] },
  CLA45: { brand: "Mercedes-AMG", chassis: ["C118"] },
  CLA45S: { brand: "Mercedes-AMG", chassis: ["C118"] },
  // Porsche — model designations that aren't chassis codes; suppress from the dropdown.
  GT3: { brand: "Porsche", chassis: [] },
  GT3RS: { brand: "Porsche", chassis: [] },
  GT4: { brand: "Porsche", chassis: [] },
  GT4RS: { brand: "Porsche", chassis: [] },
};

/**
 * Natural sort for chassis/model keys.
 *
 * Groups chassis-like keys (containing a digit) before pure-text fallbacks (Cayenne, Macan, Yaris…),
 * then within each group: letter-prefix groups alphabetically, with numeric-aware ordering inside
 * the group so e.g. BMW chassis come out as E82 → E90 → E92 → … → F06 → F10 → … → F87N → F90 → … → G09 → G20 → … → G99.
 */
const MODEL_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function compareVehicleModelKeys(a: string, b: string): number {
  const aHasDigit = /\d/.test(a);
  const bHasDigit = /\d/.test(b);
  if (aHasDigit !== bHasDigit) return aHasDigit ? -1 : 1;
  return MODEL_COLLATOR.compare(a, b);
}

function applyTrimToChassisFallback(brand: string, segment: string, sink: Set<string>): boolean {
  let added = false;
  for (const [trim, info] of Object.entries(TRIM_TO_CHASSIS)) {
    if (info.brand !== brand) continue;
    if (info.chassis.length === 0) continue;
    const re = new RegExp(`\\b${trim}\\b`, "i");
    if (re.test(segment)) {
      info.chassis.forEach((c) => sink.add(c));
      added = true;
    }
  }
  return added;
}

export function extractVehicleModelsForBrand(title: string, brand: string): string[] {
  const afterFor = title.match(/\bfor\s+(.+)$/i)?.[1] ?? title;
  const titleBrands = extractVehicleBrands(title);
  const models = new Set<string>();
  const parenMatches = [...afterFor.matchAll(/\(([^)]+)\)/g)];

  for (const match of parenMatches) {
    const matchedModels = extractChassisCodesFromParentheses(match[1] ?? "");
    if (matchedModels.length === 0 || match.index == null) continue;

    const segment = findVehicleSegmentBeforeParen(afterFor, match.index);
    const segmentBrands = inferBrandsFromVehicleSegment(segment);

    if (segmentBrands.includes(brand)) {
      matchedModels.forEach((model) => models.add(model));
      continue;
    }

    if (segmentBrands.length === 0 && titleBrands.length <= 1 && titleBrands.includes(brand)) {
      matchedModels.forEach((model) => models.add(model));
    }
  }

  for (const fallback of BRAND_MODEL_FALLBACKS) {
    if (fallback.brand === brand && fallback.match.test(afterFor)) {
      models.add(fallback.model);
    }
  }

  // Trim-name fallback (e.g. "BMW M440i (OPF vehicles)" → G22/G23, "BMW X4M" → F98)
  if (models.size === 0 && (titleBrands.length === 0 || titleBrands.includes(brand))) {
    applyTrimToChassisFallback(brand, afterFor, models);
  }

  if (models.size > 0) {
    return [...models];
  }

  if (titleBrands.length > 1) {
    return [];
  }

  const fallback = extractVehicleModel(title);
  return fallback && fallback !== "Other" ? [fallback] : [];
}

/**
 * Extract chassis codes attributable to a specific (brand, model) pair from a single title.
 *
 * Unlike `extractVehicleModelsForBrand`, which returns every chassis the title mentions
 * regardless of which model it belongs to, this function looks at *which segment of the
 * title* each parenthesised chassis follows, and only includes chassis whose segment
 * matches the requested model. So for "BMW M2 (F87) / M3 (G80)" with model="M2", you
 * get [F87] — not [F87, G80].
 *
 * Then a final whitelist (`VALID_CHASSIS_BY_BRAND_MODEL`) drops any chassis that the
 * brand+model genuinely never used, catching titles that bundle several models in a
 * single chassis list like "BMW M2 / M235i / M340i (F87/F22/G20)".
 */
export function extractChassisForBrandAndModel(
  title: string,
  brand: string,
  model: string
): string[] {
  const afterFor = title.match(/\bfor\s+(.+)$/i)?.[1] ?? title;
  const modelPatterns = MODEL_PATTERNS_BY_BRAND[brand];
  if (!modelPatterns) return [];
  const modelPattern = modelPatterns.find((p) => p.model === model)?.pattern;
  if (!modelPattern) return [];

  const titleBrands = extractVehicleBrands(title);
  const chassis = new Set<string>();

  // Per-paren attribution: split the title into model-paren groups bounded by
  // parentheses. The "context" for each chassis paren is the text from the end
  // of the previous paren (or start of afterFor) up to this paren's open. This
  // lets "PORSCHE 911 Carrera / S / 4 / 4S / GTS (991)" still attribute 991 to
  // 911 — the simpler "last separator" heuristic only saw "GTS ".
  for (const match of afterFor.matchAll(/\(([^)]+)\)/g)) {
    const matchedChassis = extractChassisCodesFromParentheses(match[1] ?? "");
    if (matchedChassis.length === 0 || match.index == null) continue;

    const before = afterFor.slice(0, match.index);
    const lastParenEnd = before.lastIndexOf(")");
    const context = before.slice(lastParenEnd + 1);
    if (modelPattern.test(context)) {
      matchedChassis.forEach((c) => chassis.add(c));
    }
  }

  // Brand-specific override fallbacks (e.g. BMW Z4 → G29 even without parens)
  for (const fb of BRAND_MODEL_FALLBACKS) {
    if (fb.brand === brand && fb.match.test(afterFor) && modelPattern.test(afterFor)) {
      chassis.add(fb.model);
    }
  }

  // Trim-name fallback (e.g. "BMW M440i (OPF vehicles)" → G22/G23) — only when no
  // chassis came from parens AND the trim's model matches the requested model.
  if (chassis.size === 0 && (titleBrands.length === 0 || titleBrands.includes(brand))) {
    if (modelPattern.test(afterFor)) {
      for (const [trim, info] of Object.entries(TRIM_TO_CHASSIS)) {
        if (info.brand !== brand || info.chassis.length === 0) continue;
        const re = new RegExp(`\\b${trim}\\b`, "i");
        if (re.test(afterFor)) {
          info.chassis.forEach((c) => chassis.add(c));
        }
      }
    }
  }

  // Final whitelist filter to drop cross-pollinated chassis from multi-model titles.
  const whitelist = VALID_CHASSIS_BY_BRAND_MODEL[brand]?.[model];
  if (whitelist) {
    return [...chassis].filter((c) => whitelist.includes(c));
  }
  return [...chassis];
}

/**
 * Extract chassis code from parentheses in Akrapovič titles.
 * Examples:
 *   "... for BMW M3 (G80/G81)" → "G80"
 *   "... for PORSCHE 911 Carrera (992)" → "992"
 *   "... for BMW M8 (F91/F92/F93)" → "F91"
 *   "... for PORSCHE Cayenne (958 FL)" → "958"
 *   "... for PORSCHE 911 GT3RS (991.2)" → "991"
 * Returns the primary chassis code (first one if multiple).
 */
export function extractVehicleModel(title: string): string {
  const afterFor = title.match(/\bfor\s+(.+)$/i)?.[1] ?? null;
  // Find all parenthesized groups
  const parenMatches = title.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const pm of parenMatches) {
      const inner = pm.slice(1, -1).trim();
      // Skip year ranges like (2019-2024), pure years, or text like "Titanium", "ECE Approved"
      if (/^\d{4}[-–]\d{4}$/.test(inner)) continue;
      if (/^\d{4}$/.test(inner)) continue;
      if (/^(Titanium|Stainless Steel|Carbon|Gloss|Matte|ECE|OPF|GPF|without)/i.test(inner)) continue;

      // Extract first chassis code — F30, G80, E3, W177, C118, 991, 992, 718, 536, A90
      const chassis = extractChassisFromParentheses(inner);
      if (chassis) return chassis;
    }
  }

  if (afterFor) {
    const inlineTokens = [...afterFor.matchAll(/\b([A-Z]{0,4}\d{1,3}[A-Z]{0,4})\b/gi)]
      .map((m) => m[1].toUpperCase());
    const realChassis = inlineTokens.find((t) => !TRIM_TO_CHASSIS[t]);
    if (realChassis) return realChassis;
    const mappedTrim = inlineTokens.find((t) => (TRIM_TO_CHASSIS[t]?.chassis.length ?? 0) > 0);
    if (mappedTrim) return TRIM_TO_CHASSIS[mappedTrim].chassis[0];
  }

  const fallbackModelPatterns: { match: RegExp; value: string }[] = [
    { match: /\bCAYENNE\b/i, value: "Cayenne" },
    { match: /\bPANAMERA\b/i, value: "Panamera" },
    { match: /\bMACAN\b/i, value: "Macan" },
    { match: /\bTAYCAN\b/i, value: "Taycan" },
    { match: /\bGIULIA\b/i, value: "Giulia" },
    { match: /\bSTELVIO\b/i, value: "Stelvio" },
    { match: /\bFORMENTOR\b/i, value: "Formentor" },
    { match: /\bGRMN?\s+YARIS\b|\bYARIS\b/i, value: "Yaris" },
    { match: /\bF8\b/i, value: "F8" },
    { match: /\b296\b/i, value: "296" },
  ];

  for (const fallback of fallbackModelPatterns) {
    if (fallback.match.test(title)) {
      return fallback.value;
    }
  }

  return "Other";
}
