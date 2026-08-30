const HIDDEN_BRAND_NAMES = new Set(
  [
    "aFe Power",
    "Gruppe-M",
    "Bell Intercoolers",
    "BE bearings",
    "Circle D",
    "Hamann",
    "Lingenfelter",
    "MCA Suspension",
    "Mountune",
    "Raliw Forged",
    "Ronin Design",
    "SooQoo",
    "YPG",
  ].map((name) => name.toLocaleLowerCase("en"))
);

export function isPublicBrand(name: string): boolean {
  return !HIDDEN_BRAND_NAMES.has(name.trim().toLocaleLowerCase("en"));
}
