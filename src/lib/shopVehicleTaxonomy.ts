import { normalizeShopSearchText } from "@/lib/shopSearch";

/** Stable identity for vehicle aliases such as `RS Q8`/`RSQ8` and `3-series`/`3 Series`. */
export function vehicleModelKey(value: string) {
  return normalizeShopSearchText(value).replace(/[^a-z0-9]+/g, "");
}

const CANONICAL_MODEL_LABELS: Readonly<Record<string, string>> = {
  "cupra:formentor": "Formentor",
  "honda:civic": "Civic",
  "honda:civictyper": "Civic Type R",
  "honda:s2000": "S2000",
  "hyundai:i30n": "i30 N",
  "mazda:cx9": "CX-9",
  "mercedes benz:aclass": "A-Class",
  "mercedes benz:cclass": "C-Class",
  "mercedes benz:claclass": "CLA-Class",
  "mercedes benz:eqc": "EQC",
  "mercedes benz:gclass": "G-Class",
  "mercedes benz:gla45": "GLA 45",
  "mercedes benz:sclass": "S-Class",
  "nissan:gtr": "GT-R",
  "nissan:skylinegtr": "Skyline GT-R",
  "subaru:brz": "BRZ",
  "subaru:impreza": "Impreza",
  "subaru:legacy": "Legacy",
  "subaru:sti": "STI",
  "subaru:wrx": "WRX",
  "toyota:grcorolla": "GR Corolla",
  "toyota:gryaris": "GR Yaris",
  "volkswagen:gti": "GTI",
};

export function canonicalVehicleModelLabel(make: string, value: string) {
  const key = vehicleModelKey(value);
  const makeKey = normalizeShopSearchText(make);
  const knownLabel = CANONICAL_MODEL_LABELS[`${makeKey}:${key}`];
  if (knownLabel) return knownLabel;
  if (makeKey === "bmw") {
    const series = key.match(/^([1-8])series$/);
    if (series) return `${series[1]} Series`;
    if (key === "xm") return "XM";
    if (key === "xseries") return "X Series";
    if (key === "zseries") return "Z Series";
  }
  if (makeKey === "audi") {
    const rsQ = key.match(/^rsq(\d)$/);
    if (rsQ) return `RS Q${rsQ[1]}`;
    const rs = key.match(/^rs(\d)$/);
    if (rs) return `RS ${rs[1]}`;
    const sq = key.match(/^sq(\d)$/);
    if (sq) return `SQ${sq[1]}`;
    if (key === "ttrs") return "TT RS";
  }
  return value.trim().replace(/\s+/g, " ");
}

export function canonicalizeVehicleModels(make: string, values: readonly string[]) {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const key = vehicleModelKey(value);
    if (!key) continue;
    byKey.set(key, canonicalVehicleModelLabel(make, byKey.get(key) ?? value));
  }
  return [...byKey.values()].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" })
  );
}
