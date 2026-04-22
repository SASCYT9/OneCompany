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
  { key: "Toyota", patterns: [/\bTOYOTA\b/i] },
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

export function extractProductLine(title: string): string | null {
  for (const { key, patterns } of LINE_PATTERNS) {
    for (const rx of patterns) {
      if (rx.test(title)) return key;
    }
  }
  return null;
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
      const chassisMatch = inner.match(/^([A-Z]?\d{1,3}[A-Z]?)(?:\.\d+)?/i);
      if (chassisMatch) {
        return chassisMatch[1].toUpperCase();
      }
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
