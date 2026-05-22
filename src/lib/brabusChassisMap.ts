/**
 * Map Brabus chassis codes (as they appear in product tags / titles) to
 * the Mercedes-Benz model family they belong to. Brabus is a Mercedes/
 * Smart tuner, so the make is always inferred as "Mercedes-Benz" when a
 * chassis code matches.
 *
 * Codes are normalized to "W123" form (no space) but the data has both
 * "W 177" and "W177" — `normalizeChassis` handles that.
 */

export function normalizeChassis(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Chassis → Mercedes model. Sourced from the Brabus catalog audit
 * 2026-05 + manufacturer documentation.
 */
export const BRABUS_CHASSIS_TO_MODEL: Record<string, string> = {
  // A-Class / B-Class hatch
  W177: "A-Class",
  W176: "A-Class",
  W247: "B-Class",
  W246: "B-Class",
  // CLA / GLA / GLB compact crossovers
  X117: "CLA",
  C117: "CLA",
  X156: "GLA",
  H247: "GLA",
  X247: "GLB",
  // C-Class
  W205: "C-Class",
  S205: "C-Class",
  C205: "C-Class",
  A205: "C-Class",
  W206: "C-Class",
  // E-Class
  W213: "E-Class",
  S213: "E-Class",
  C238: "E-Class",
  A238: "E-Class",
  W212: "E-Class",
  S212: "E-Class",
  // S-Class
  W222: "S-Class",
  V222: "S-Class",
  X222: "S-Class",
  Z222: "S-Class",
  C217: "S-Class",
  A217: "S-Class",
  W223: "S-Class",
  // SL / SLC / AMG GT
  R232: "SL",
  R231: "SL",
  R230: "SL",
  R172: "SLC",
  C190: "AMG GT",
  X290: "AMG GT 4-Door",
  // CLS / CLA
  C257: "CLS",
  C218: "CLS",
  // G-Class
  W463: "G-Class",
  W463A: "G-Class",
  // GLC / GLE / GLS
  X253: "GLC",
  C253: "GLC",
  X254: "GLC",
  W166: "GLE",
  C292: "GLE Coupe",
  W167: "GLE",
  C167: "GLE Coupe",
  X166: "GLS",
  X167: "GLS",
  // V-Class / Vito
  W447: "V-Class",
  V447: "V-Class",
  // Smart
  W451: "Smart fortwo",
  W453: "Smart fortwo",
  W454: "Smart forfour",
  C453: "Smart EQ fortwo",
};

/**
 * Tries to map a chassis code (any whitespace) to a Mercedes model.
 * Returns null if the code is not in the lookup table.
 */
export function brabusChassisToModel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return BRABUS_CHASSIS_TO_MODEL[normalizeChassis(raw)] ?? null;
}
