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
    const inlineModelMatch = afterFor.match(/\b([A-Z]{0,4}\d{1,3}[A-Z]{0,4})\b/i);
    if (inlineModelMatch) {
      return inlineModelMatch[1].toUpperCase();
    }
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
