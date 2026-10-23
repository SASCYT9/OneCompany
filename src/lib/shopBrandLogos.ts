/**
 * Brand logos of the shop catalogue (filters, product cards) and product pages:
 * theme-specific artwork and the per-brand treatment that keeps each mark
 * legible on dark and light surfaces.
 */
export const normalizeBrandLogoName = (brandName: string) =>
  brandName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getBrandLogoPath = (brandName: string): string | null => {
  const b = normalizeBrandLogoName(brandName);
  if (b.includes("akrapovic")) return "/logos/akrapovic.svg";
  if (b.includes("bmc")) return "/logos/bmc-filters.png";
  if (b.includes("adro")) return "/images/shop/adro/adro-logo-white.svg";
  if (b.includes("brabus")) return "/logos/brabus.svg";
  if (b.includes("racechip")) return "/logos/racechip.png";
  if (b.includes("revozport")) return "/logos/revozport-official-white.png";
  if (b.includes("wheelforce")) return "/logos/wheelforce.svg";
  if (b === "mst" || b.includes("mst performance")) return "/logos/mst-performance.png";
  if (b.includes("do88")) return "/logos/do88.png";
  if (b.includes("csf")) return "/images/shop/csf/csf-logo.svg";
  if (b.includes("ohlins")) return "/logos/ohlins.svg";
  if (b.includes("girodisc")) return "/images/shop/girodisc/girodisc-logo-white.svg";
  if (b.includes("ilmberger")) return "/logos/ilmberger-carbon-dark.png";
  if (b.includes("ipe exhaust") || b === "ipe" || b.includes("innotech performance"))
    return "/images/shop/ipe/ipe-logo.png";
  if (b.includes("burger")) return "/logos/burger-motorsport.svg";
  if (b.includes("kw")) return "/logos/kw-suspension.svg";
  if (b.includes("urban")) return "/logos/urban-automotive.svg";
  if (b.includes("vf engineering") || b.includes("vf-engineering"))
    return "/logos/vf-engineering.png";
  if (b.includes("vorsteiner")) return "/logos/vorsteiner.png";
  if (b.includes("stopflex")) return "/logos/stopflex.png";
  if (b.includes("eventuri")) return "/logos/eventuri-official.svg";
  if (b.includes("remus")) return "/logos/remus-dark.png";
  if (b.includes("fi exhaust") || b.includes("fi-exhaust")) return "/logos/fi-exhaust.svg";
  if (b.includes("bootmod3")) return "/logos/bootmod3.webp";
  if (b.includes("g-sport") || b.includes("gsport")) return "/logos/gsport-by-gesi.png";
  if (b.includes("dinan")) return "/logos/dinan.avif";
  if (b === "apr" || b === "apr performance") return "/logos/apr-performance-white.png";
  if (b.includes("link ecu")) return "/logos/link-ecu.svg";
  if (b.includes("ct carbon")) return "/logos/ct-carbon-white.png";
  if (b.includes("valvetronic designs")) return "/logos/valvetronic-designs-white.png";
  return null;
};

export const getBrandLightLogoPath = (brandName: string, fallback: string): string => {
  const b = normalizeBrandLogoName(brandName);
  if (b.includes("adro")) return "/images/shop/adro/adro-logo.svg";
  if (b.includes("csf")) return "/images/shop/csf/csf-logo.svg";
  if (b.includes("girodisc")) return "/logos/girodisc.webp";
  if (b.includes("ilmberger")) return "/logos/ilmberger-carbon-transparent.webp";
  if (b.includes("ipe exhaust") || b === "ipe" || b.includes("innotech performance"))
    return "/images/shop/ipe/ipe-logo.png";
  if (b.includes("remus")) return "/logos/remus.png";
  if (b.includes("revozport")) return "/logos/revozport-official-black.png";
  if (b.includes("eventuri")) return "/brands/eventuri-logo-email.png";
  if (b.includes("dinan")) return "/logos/dinan-black.png";
  if (b === "apr" || b === "apr performance") return "/logos/apr-performance-black.png";
  if (b.includes("ct carbon")) return "/logos/ct-carbon-black.png";
  if (b.includes("valvetronic designs")) return "/logos/valvetronic-designs-black.png";
  return fallback;
};

const LOGO_CONTRAST_LIFT_BRANDS = [
  "akrapovic",
  "akrapovi",
  "burger",
  "girodisc",
  "ipe",
  "kw",
  "remus",
  "urban",
  "vf engineering",
  "vorsteiner",
];

const LOGO_INVERT_BRANDS = ["brabus", "wheelforce"];

const LOGO_LIGHT_INVERT_BRANDS = ["racechip", "do88", "urban"];

const LOGO_LIGHT_OUTLINE_BRANDS = ["akrapovic", "akrapovi", "bmc", "burger"];

const LOGO_WIDE_MARK_BRANDS = [
  "akrapovic",
  "akrapovi",
  "brabus",
  "burger",
  "girodisc",
  "ilmberger",
  "ohlins",
  "racechip",
  "revozport",
  "remus",
  "stopflex",
  "urban",
  "valvetronic designs",
];

export function brandLogoNeedsContrastLift(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_CONTRAST_LIFT_BRANDS.some((brand) => normalized.includes(brand));
}

export function brandLogoNeedsInvert(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_INVERT_BRANDS.some((brand) => normalized.includes(brand));
}

export function brandLogoNeedsLightInvert(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_LIGHT_INVERT_BRANDS.some((brand) => normalized.includes(brand));
}

export function brandLogoNeedsLightOutline(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_LIGHT_OUTLINE_BRANDS.some((brand) => normalized.includes(brand));
}

export function brandLogoNeedsWideBoost(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_WIDE_MARK_BRANDS.some((brand) => normalized.includes(brand));
}

export function getBrandLogoBackdropClass(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  // Keep mixed-color artwork legible without inverting its brand colors.
  if (
    normalized.includes("bmc") ||
    normalized.includes("csf") ||
    normalized.includes("ipe exhaust") ||
    normalized === "ipe" ||
    normalized.includes("innotech performance")
  )
    return normalized.includes("bmc")
      ? "rounded-sm bg-white p-0.5"
      : "rounded-sm bg-neutral-950 p-0.5";
  if (
    normalized.includes("g-sport") ||
    normalized.includes("gsport") ||
    normalized.includes("link ecu")
  )
    return "rounded-sm bg-white p-0.5";
  return "";
}
