/**
 * Burger Motorsports is a BMW-only tuner. Their products are tagged with
 * raw BMW chassis codes (`chassis:G20`, `chassis:F30`, etc.) without an
 * explicit make. This map translates a chassis code to the BMW model
 * family (1-Series, 3-Series, M3, etc.) so /shop/stock vehicle filter
 * can serve Burger products under Make=BMW + Model=<series>.
 *
 * Source: BMW chassis-code naming convention + Burger product audit
 * 2026-05.
 */

const NORM = (raw: string) =>
  String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

/** Chassis code → BMW model family. */
export const BURGER_CHASSIS_TO_BMW_MODEL: Record<string, string> = {
  // 1-Series
  E81: "1-Series",
  E82: "1-Series",
  E87: "1-Series",
  E88: "1-Series",
  F20: "1-Series",
  F21: "1-Series",
  F40: "1-Series",
  // 2-Series
  F22: "2-Series",
  F23: "2-Series",
  F44: "2-Series",
  F45: "2-Series",
  F46: "2-Series",
  G42: "2-Series",
  // 3-Series
  E36: "3-Series",
  E46: "3-Series",
  E90: "3-Series",
  E91: "3-Series",
  E92: "3-Series",
  E93: "3-Series",
  F30: "3-Series",
  F31: "3-Series",
  F34: "3-Series",
  G20: "3-Series",
  G21: "3-Series",
  // 4-Series
  F32: "4-Series",
  F33: "4-Series",
  F36: "4-Series",
  G22: "4-Series",
  G23: "4-Series",
  G26: "4-Series",
  // 5-Series
  E39: "5-Series",
  E60: "5-Series",
  E61: "5-Series",
  F10: "5-Series",
  F11: "5-Series",
  G30: "5-Series",
  G31: "5-Series",
  // 6-Series
  E63: "6-Series",
  E64: "6-Series",
  F06: "6-Series",
  F12: "6-Series",
  F13: "6-Series",
  G32: "6-Series",
  // 7-Series
  E38: "7-Series",
  E65: "7-Series",
  E66: "7-Series",
  F01: "7-Series",
  F02: "7-Series",
  G11: "7-Series",
  G12: "7-Series",
  G70: "7-Series",
  // 8-Series
  E31: "8-Series",
  G14: "8-Series",
  G15: "8-Series",
  G16: "8-Series",
  // X-Series
  E70: "X5",
  E71: "X6",
  F15: "X5",
  F16: "X6",
  F25: "X3",
  F26: "X4",
  F39: "X2",
  F48: "X1",
  F85: "X5 M",
  F86: "X6 M",
  G01: "X3",
  G02: "X4",
  G05: "X5",
  G06: "X6",
  G07: "X7",
  // Z-Series
  E85: "Z4",
  E86: "Z4",
  E89: "Z4",
  G29: "Z4",
  // M cars (separate models in Burger UI)
  E46M3: "M3",
  E90M3: "M3",
  E92M3: "M3",
  E93M3: "M3",
  F80: "M3",
  G80: "M3",
  G81: "M3",
  F82: "M4",
  F83: "M4",
  G82: "M4",
  G83: "M4",
  E60M5: "M5",
  F10M5: "M5",
  F90: "M5",
  G90: "M5",
  E63M6: "M6",
  E64M6: "M6",
  F06M6: "M6",
  F12M6: "M6",
  F13M6: "M6",
  F87: "M2",
  G87: "M2",
  // i-Series (EV) — leave out, Burger doesn't tune those
};

/** Map raw chassis tag (`G20`, `g 20`) to BMW model name. */
export function burgerChassisToBmwModel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return BURGER_CHASSIS_TO_BMW_MODEL[NORM(raw)] ?? null;
}
