/**
 * Manual CSF fitment data — corrections for the auto-extractor.
 *
 * Fill these tables as you go through the catalog. The auto-extractor still
 * runs in `csfCatalog.ts`; the maps below either *normalize* or *replace* its
 * output before it reaches the UI.
 *
 * Two layers:
 *
 *   1. CSF_MODEL_NORMALIZATION — collapse raw model strings (engine codes,
 *      chassis codes, sub-variants) to a canonical model name per make.
 *      Set the value to `""` (empty string) to DROP that label entirely
 *      (useful for engine codes that aren't models).
 *
 *   2. CSF_FITMENT_OVERRIDES — per-SKU full override of make/models/chassis/year
 *      when the auto-extractor produces something wrong or ambiguous.
 *      The override fields are merged on top of the auto result.
 */

export type CsfFitmentOverride = {
  make?: string;
  models?: string[];
  chassisCodes?: string[];
  yearStart?: number;
  yearEnd?: number;
  yearLabel?: string;
};

// Make name keys are UPPERCASE (matches MAKE_PATTERNS labels in csfCatalog.ts).
export const CSF_MODEL_NORMALIZATION: Record<string, Record<string, string>> = {
  BMW: {
    // 3 Series sedans
    "320i": "3 Series",
    "323": "3 Series",
    "325": "3 Series",
    "328": "3 Series",
    "328i N52 3.0L": "3 Series",
    "330": "3 Series",
    "335i": "3 Series",
    "340i": "3 Series",
    // 4 Series
    "435i": "4 Series",
    "440i": "4 Series",
    // M cars — collapse chassis-prefixed variants to the model
    "E30 M3": "M3",
    "E30 M3 2.7L": "M3",
    "E36 M3": "M3",
    "E46 M3": "M3",
    "E92 M3": "M3",
    "F80 M3": "M3",
    "G80 M3": "M3",
    "F82 M4": "M4",
    "F83 M4": "M4",
    "G82 M4": "M4",
    "G83 M4": "M4",
    "F87 M2": "M2",
    "G87 M2": "M2",
    // E92 alone in CSF data is mostly the M3 coupe variant
    "E92": "M3",
    "E90 325i": "3 Series",
    "E30": "3 Series",
    // Classics — hide entirely from facet (too niche for current catalog)
    "1602": "",
    "2002tii": "",
    "1M": "",
    // Engine codes — these are engines, not models. Drop from the model facet.
    "B48": "",
    "B58": "",
    "B58 Gen 1": "",
    "N52": "",
    "S58": "",
    "N54": "",
    "N55": "",
    "N55 F-Chassis": "",
    // Bare chassis codes leaking into the model facet — collapse to a series.
    "F20": "1 Series",
    "F21": "1 Series",
    "F22": "2 Series",
    "F23": "2 Series",
    "F30": "3 Series",
    "F31": "3 Series",
    "F34": "3 Series",
    "F32": "4 Series",
    "F33": "4 Series",
    "F36": "4 Series",
    "F36 Gran Coupe": "4 Series",
    "M3 E90": "M3",
    // Ambiguous / failed parses — drop.
    "GT": "",
  },
  PORSCHE: {
    // 911 family — collapse all Carrera variants to "911" (use chassis filter for 991/992).
    "Carrera": "911",
    "911 Carrera 4": "911",
    "911 Carrera S": "911",
    "Carrera 3.0T": "911",
    "Carrera 4": "911",
    "Carrera 4S": "911",
    "4S": "911",
    "4GTS": "911",
    "991 Turbo": "911 Turbo",
    "992 Carrera": "911",
    "Turbo": "911 Turbo",
    "Turbo S": "911 Turbo S",
    "911 aux.": "911",
    // GT2 / GT3 RS variants — consolidate spelling
    "GT2RS": "911 GT2 RS",
    "911 GT2RS": "911 GT2 RS",
    "GT3RS": "911 GT3 RS",
    "GT3 RS": "911 GT3 RS",
    // Cayman variants
    "GT4": "Cayman GT4",
    "GT4RS": "Cayman GT4 RS",
    "718 Cayman GT4": "Cayman GT4",
    "718 Cayman GTS": "Cayman GTS",
    // Drops
    "GTS": "", // too generic
    "S5": "", // not a Porsche model
  },
  TOYOTA: {
    "GR Supra -": "GR Supra",
    "4Runner 3.4L": "4Runner",
    "4Runner V8": "4Runner",
    "Tacoma 2.7L": "Tacoma",
    "Sequoia V8": "Sequoia",
    "Tundra V8": "Tundra",
    // Engine spec garbage
    "3.4L Automatic": "",
  },
  NISSAN: {
    "GT-R -": "GT-R",
    "GT-R R35": "GT-R",
  },
  SUBARU: {
    // Case + variant consolidation
    "STi": "STI",
    "Impreza WRX": "WRX",
    "Impreza WRX STI": "WRX STI",
  },
  FORD: {
    "Bronco 2.7L EcoBoost": "Bronco",
    "Mustang 2.3L Ecoboost": "Mustang",
    "Mustang 5.0L GT": "Mustang",
    "Mustang V6": "Mustang",
    // Engine spec garbage
    "V8": "",
  },
  HONDA: {
    "Civic Type-R": "Civic Type R",
  },
  CHEVROLET: {
    "CAMARO SS": "Camaro",
    "Camaro V8": "Camaro",
    "Corvette C6": "Corvette",
    "Stingray": "Corvette Stingray",
    "Grand Sport": "Corvette Grand Sport",
    // Engine spec garbage
    "3.6L V6": "",
  },
  AUDI: {
    "C8 RS6": "RS6",
    "SQ8 -": "SQ8",
    // Drive-type / trim leakage — not models
    "FWD": "",
    "Quattro": "",
    // Audi 80/90 chassis codes leaking from older fitments
    "B1": "80",
    "B2": "80",
    "B3": "80",
    "B4": "80",
  },
  "MERCEDES-BENZ": {
    "AMG S": "",
    "GT C": "AMG GT C",
    "SL500": "SL",
    "500SL": "SL",
    "W201 190E 2.3-16": "190E",
    "2.5-16": "190E",
  },
  MITSUBISHI: {
    "EVO 7": "Evo 7",
    "Evolution 7": "Evo 7",
    "Lancer Evolution 4": "Evo 4",
  },
  JEEP: {
    "Wrangler Heavy Duty": "Wrangler",
  },
  DODGE: {
    // CSF Dodge catalog is exclusively Ram pickup with engine variants
    "6.7L Turbo Diesel": "Ram",
    "Ram 5.9L": "Ram",
    "Ram 6.7 L": "Ram",
  },
  HYUNDAI: {
    "Genesis 3.8L": "Genesis",
  },
  FERRARI: {
    // Generic — could be 488/458/F8 Spider; chassis filter handles it.
    "Spider": "",
  },
  LEXUS: {
    "GX460 -": "GX460",
  },
  MINI: {
    "COOPER S": "Cooper S",
  },
};

// Per-SKU overrides — only fill when the auto extractor is wrong.
export const CSF_FITMENT_OVERRIDES: Record<string, CsfFitmentOverride> = {
  // Example:
  // "8400C": { make: "BMW", models: ["M340i", "GR Supra"], chassisCodes: ["G20", "G21", "A90"] },
};

export function normalizeModelLabel(make: string | null | undefined, raw: string): string | null {
  if (!raw) return null;
  if (!make) return raw;
  const map = CSF_MODEL_NORMALIZATION[make.toUpperCase()];
  if (!map) return raw;
  if (raw in map) {
    const canonical = map[raw];
    return canonical === "" ? null : canonical;
  }
  return raw;
}
