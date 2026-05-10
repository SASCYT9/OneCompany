export const normalizeBrandName = (value: string): string => {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

import { isDarkLogo } from "@/lib/darkLogos";
import { isSolidLogo } from "@/lib/solidLogos";

const INVERT_BRANDS_NORMALIZED = new Set(
  [
    "ABT",
    "BRABUS",
    "AC Schnitzer",
    "ADRO",
    "Airlift",
    "AVANTGARDE",
    "CAPRISTO",
    "KOTOUC",
    "LEIB Engineering",
    "Libery Walk",
    "Liberty Walk",
    "Oettinger",
    "RYFT",
    "VF Engineering",
    "WheelForce",
    "1221 Wheels",
    "AC Schnitzer",
    "Avant Garde Wheels",
    // Added 2026-05-07: dark logos misclassified as also-solid by the auto
    // detector, so the runtime !isSolid guard suppresses auto-invert. Force
    // invert via the manual list — they all have dark wordmarks on dark
    // backgrounds otherwise.
    "1016 Industries",
    "AEM Factory",
    "BMC filters",
    "Cobb tuning",
    "Melotti Racing",
    "Raliw Forged",
    "Remus",
    "Rizoma",
    "RS-R",
    "STOPART ceramic",
    "Vargas Turbo",
    "Verus Engineering",
    "XDI fuel systems",
    // Added 2026-05-07 (post-merge fix): SooQoo source PNG is black-ink
    // on an opaque white background — chroma-keyed the white to
    // transparent so the modal's auto-invert produces a clean white
    // silhouette. The category grid uses the MANUAL invert list only
    // (not the dark-logo auto-detect), so without this entry the grid
    // tile shows faint black ink on dark and the modal shows a white
    // square. Force grid-invert here too.
    "SooQoo",
    // NOTE: Onyx Concept, Fore Innovations, BootMod3 are NOT inverted —
    // their source PNGs are essentially solid dark rectangles with no
    // real logo content (≥85% near-black pixels). Inverting them produces
    // a glaring white block. Better to leave them dark (mostly invisible
    // on the dark theme) until proper logo files are sourced. See issues
    // #19, #24, #26 for follow-up.
  ].map(normalizeBrandName)
);

const INVERT_BRAND_ALIASES: Record<string, string> = {
  // common variants / typos
  "libery walk": "liberty walk",
  liberywalk: "liberty walk",
  libertywalk: "liberty walk",

  // brand naming differences
  "abt sportsline": "abt",
  "ac schnitzer": "ac schnitzer",
};

const NO_INVERT_BRANDS_NORMALIZED = new Set(
  ["GTHaus", "Hardrace", "Extreme Performance Tyres"].map(normalizeBrandName)
);

export const shouldInvertBrand = (brandName: string | undefined | null): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped =
    INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, "")] ??
    INVERT_BRAND_ALIASES[normalized] ??
    normalized;

  return INVERT_BRANDS_NORMALIZED.has(mapped);
};

export const shouldInvertBrandOrLogo = (
  brandName: string | undefined | null,
  logoPath?: string | null
): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped =
    INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, "")] ??
    INVERT_BRAND_ALIASES[normalized] ??
    normalized;
  if (NO_INVERT_BRANDS_NORMALIZED.has(mapped)) return false;

  // Manual brand list always wins
  if (shouldInvertBrand(brandName)) return true;

  // Auto-invert: only for dark logos that are NOT solid-background
  if (logoPath && isDarkLogo(logoPath) && !isSolidLogo(logoPath)) {
    return true;
  }

  return false;
};

const SMART_INVERT_BRANDS_NORMALIZED = new Set(
  [
    // 3D Design removed 2026-05-07: replaced source PNG with a clean
    // white-on-transparent silhouette extracted from the brand catalog.
    // Smart-invert would now turn the white into black, breaking the
    // dark-theme card. See issue #18.
    "BE bearings",
    "Marchesini",
    "SparkExhaust",
  ].map(normalizeBrandName)
);

export const shouldSmartInvertBrand = (brandName: string | undefined | null): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped =
    INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, "")] ??
    INVERT_BRAND_ALIASES[normalized] ??
    normalized;

  return SMART_INVERT_BRANDS_NORMALIZED.has(mapped);
};

// Brands whose source logo files have light/white backgrounds (typically
// JPG, or PNG/WebP/AVIF without alpha). filter:invert() can't fix these
// (it produces a solid white block — both bg and dark logo collapse to
// black under brightness(0), then invert(1) flips both to white). So we
// render them on a white container instead — the file's white bg blends
// with the container, keeping the dark/colored logo visible.
const LIGHT_BG_LOGO_BRANDS_NORMALIZED = new Set(
  [
    "Arrow",
    "Accossato",
    "Alpha Racing",
    "Big Boost",
    "BootMod3",
    "Domino",
    "Dorch Engineering",
    "EVR",
    "Ilmberger Carbon",
    "KAHN design",
    "Killer B Motorsport",
    "KLM Race",
    "KW Suspension",
    "Link ECU",
    "MST Performance",
    "New Rage Cycles",
    "Samco Sport",
    "TWM",
    "Whipple Superchargers",
    "YPG",
  ].map(normalizeBrandName)
);

export const hasLightBackgroundLogo = (brandName: string | undefined | null): boolean => {
  if (!brandName) return false;

  const normalized = normalizeBrandName(brandName);
  const mapped =
    INVERT_BRAND_ALIASES[normalized.replace(/\s+/g, "")] ??
    INVERT_BRAND_ALIASES[normalized] ??
    normalized;

  return LIGHT_BG_LOGO_BRANDS_NORMALIZED.has(mapped);
};
