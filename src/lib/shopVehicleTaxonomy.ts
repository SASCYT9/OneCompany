import { normalizeShopSearchText } from "@/lib/shopSearch";
import { SHOP_VEHICLE_MODEL_CORRECTIONS, formatVehicleModelLabel } from "./shopVehicleModelCorrections";
import generationAliases from "./shopVehicleGenerationAliases.json";

const VEHICLE_MAKE_ALIAS_GROUPS = {
  "Alfa Romeo": ["alfa romeo", "alfa-romeo"],
  BMW: ["bmw"],
  BYD: ["byd"],
  Citroën: ["citroen", "citroën"],
  DS: ["ds"],
  Ford: ["ford", "ford usa"],
  GMC: ["gmc"],
  INEOS: ["ineos"],
  "Land Rover": ["land rover", "land-rover", "range rover"],
  LDV: ["ldv"],
  McLaren: ["mclaren"],
  "Mercedes-Benz": ["mercedes benz", "mercedes-benz", "mercedes amg", "mercedes-amg"],
  MINI: ["mini"],
  NIO: ["nio"],
  "Rolls-Royce": ["rolls royce", "rolls-royce"],
  SEAT: ["seat"],
  Volkswagen: ["volkswagen", "vw"],
} as const;

const CANONICAL_VEHICLE_MAKE_BY_ALIAS = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(VEHICLE_MAKE_ALIAS_GROUPS)) {
  for (const alias of aliases) CANONICAL_VEHICLE_MAKE_BY_ALIAS.set(normalizeShopSearchText(alias), canonical);
}

export function canonicalVehicleMakeLabel(value: string) {
  const trimmed = value.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (!trimmed) return "";
  return CANONICAL_VEHICLE_MAKE_BY_ALIAS.get(normalizeShopSearchText(trimmed)) ??
    trimmed.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function vehicleMakeAliases(value: string) {
  const canonical = canonicalVehicleMakeLabel(value);
  const aliases = VEHICLE_MAKE_ALIAS_GROUPS[canonical as keyof typeof VEHICLE_MAKE_ALIAS_GROUPS];
  return aliases ? [...new Set([canonical, ...aliases])] : [canonical];
}

export function canonicalizeVehicleMakes(values: readonly string[]) {
  return [...new Set(values.map(canonicalVehicleMakeLabel).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "en", { sensitivity: "base" })
  );
}

/** Stable identity for vehicle aliases such as `RS Q8`/`RSQ8` and `3-series`/`3 Series`. */
export function vehicleModelKey(value: string) {
  return normalizeShopSearchText(value).replace(/[^a-z0-9]+/g, "");
}

const VEHICLE_MODEL_ALIAS_GROUPS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  bentley: {
    "Continental GT": ["Continental GT", "Continental Gt Urban"],
    "Flying Spur": ["Flying Spur", "Continental Flying Spur"],
  },
  bmw: {
    "1 Series M Coupé": ["1 Series M Coupé", "1M", "1 Series M"],
    "1 Series": ["1 Series", "M135i/M140i"],
    "2 Series": ["2 Series", "M235i/M240i"],
    "2 Series Active Tourer": ["2 Series Active Tourer", "2 Active Tourer", "2-series-active-gran-tourer"],
    "3 Series": ["3 Series", "3-series", "M340i/M340d"],
    "4 Series": ["4 Series", "4-series", "M440i/M440d"],
    "5 Series": ["5 Series", "5-series", "M550i", "520i", "540i"],
    "8 Series": ["8 Series", "8-series", "M850i"],
    i4: ["i4", "I4"],
    i8: ["i8", "I8"],
    Z4: ["Z4", "Z Series", "Z4 Roadster"],
    "2 Gran Coupe": ["2 Gran Coupe", "2-series-gran-coupe"],
    "2 Series Gran Tourer": ["2 Series Gran Tourer", "2 Gran Tourer", "2-series-active-gran-tourer"],
    "6 Gran Turismo": ["6 Gran Turismo", "6-gran-turismo"],
    M2: ["M2", "m2", "M2 Competition", "M2 CS F87"],
    M3: ["M3", "m3"],
    M4: ["M4", "m4", "M4 (Titanium)"],
    M5: ["M5", "m5", "M5 LCI"],
    M6: ["M6", "m6"],
    M8: ["M8", "m8"],
    X1: ["X1", "x1"],
    X2: ["X2", "x2"],
    X3: ["X3", "x3", "X3 M50i"],
    "X3 M": ["X3 M", "x3-m"],
    X4: ["X4", "x4", "X4 30i", "X4 M40i"],
    "X4 M": ["X4 M", "x4-m", "X4M LCI"],
    X5: ["X5", "x5"],
    "X5 M": ["X5 M", "x5-m", "X5M LCI / X6M LCI"],
    X6: ["X6", "x6"],
    "X6 M": ["X6 M", "x6-m", "X5M LCI / X6M LCI"],
    X7: ["X7", "x7"],
  },
  ford: {
    GT: ["GT", "Gt"],
  },
  "land rover": {
    Defender: ["Defender", "Defender Oem Black", "Urban Leather Defender"],
    "Defender 110": ["Defender 110", "Defender 110 Wide"],
    "Discovery 5": ["Discovery 5", "Discovery 5 5", "Discovery 5 Black", "Discovery 5 Urban"],
    "Range Rover Sport": ["Range Rover Sport", "Sport", "Sport Linear", "Sport Matrix", "Sport Pur", "Sport Sv"],
  },
  lamborghini: {
    Urus: ["Urus", "Urus Urus"],
    "Urus SE": ["Urus SE", "Urus Se Urban"],
    "Urus S": ["Urus S", "Urus S Without"],
  },
  maserati: {
    Ghibli: ["Ghibli", "Ghibli Iii", "Ghibli Iii S", "Ghibli Iii S Q4"],
  },
  "mercedes benz": {
    "190 E": ["190 E", "190e"],
    "AMG A 45": ["AMG A 45", "A45"],
    "AMG GT": ["AMG GT", "Amg Gt"],
    "AMG GT C": ["AMG GT C", "Amg Gt C"],
    "AMG GT R": ["AMG GT R", "Amg Gt R"],
    "AMG GT 4-Door Coupé": ["AMG GT 4-Door Coupé", "Amg Gt 4 Door"],
    "AMG C 43": ["AMG C 43", "C43 AMG", "C43", "C43 Amg"],
    "AMG C 63": ["AMG C 63", "C63"],
    "C 450 AMG": ["C 450 AMG", "C450"],
    "CL-Class": ["CL-Class", "CL", "Cl Class"],
    "CLA-Class": ["CLA-Class", "CLA"],
    "CLK-Class": ["CLK-Class", "Clk Class"],
    "AMG CLS 53": ["AMG CLS 53", "CLS53"],
    "AMG E 53": ["AMG E 53", "E53"],
    "AMG E 63": ["AMG E 63", "E63"],
    EQC: ["EQC", "Eqc Visual Carbon", "Eqc Gloss"],
    "GLA-Class": ["GLA-Class", "GLA"],
    "AMG G 63": ["AMG G 63", "G63"],
    "G 500": ["G 500", "G500"],
    "AMG GLA 35": ["AMG GLA 35", "GLA 35", "Gla 35"],
    "AMG GLA 45": ["AMG GLA 45", "GLA 45"],
    "GLB-Class": ["GLB-Class", "Glb", "Glb Class"],
    "GLK-Class": ["GLK-Class", "Glk Class"],
    "GLS-Class": ["GLS-Class", "Gls"],
    "GLS 450": ["GLS 450", "Gls 450"],
    "M-Class": ["M-Class", "M Class"],
    "SL-Class": ["SL-Class", "SL", "Sl Class"],
    SLC: ["SLC", "Slc"],
    "SLK-Class": ["SLK-Class", "SLK", "Slk Class"],
    "AMG S 63": ["AMG S 63", "S63"],
  },
  nissan: {
    Armada: ["Armada", "Armada Infiniti Qx56 04-1"],
  },
  porsche: {
    "718 Boxster": ["718 Boxster", "718 Boxster/Cayman"],
    "718 Cayman": ["718 Cayman", "718 Boxster/Cayman"],
  },
  seat: {
    Ibiza: ["Ibiza", "Ibiza Cupra 1 8 Tsi"],
  },
  volkswagen: {
    "Jetta GLI": ["Jetta GLI", "Jetta Gli"],
    Polo: ["Polo", "Polo 2 0 Tsi Ea888", "Polo 5", "Polo 6"],
    Scirocco: ["Scirocco", "Scirocco 3"],
    Transporter: [
      "Transporter",
      "T6",
      "T6 1 Black Lower",
      "Transporter T6 1",
      "Transporter T6 1 Black",
      "Transporter T6 1 Lwb",
      "Transporter T6 1 Urban",
    ],
  },
  volvo: {
    "740": ["740", "740 940"],
    "940": ["940", "740 940"],
    "850": ["850", "850 S70 V70 C70 P80"],
    C30: ["C30", "C30 C70 S40 V50 P1"],
    C70: ["C70", "850 S70 V70 C70 P80", "C30 C70 S40 V50 P1", "S70 V70 C70 Xc70 P80"],
    "960": ["960", "960 S90 V90"],
    S40: ["S40", "C30 C70 S40 V50 P1", "S40 V40"],
    S60: ["S60", "S60 V70 S80 Xc70 P2", "S60 V70 Xc60 P3", "Sv60 Sv90 Xc60 Xc90 Spa"],
    S70: ["S70", "850 S70 V70 C70 P80", "S70 V70 C70 Xc70 P80"],
    S80: ["S80", "S60 V70 S80 Xc70 P2", "V70 S80 Xc70 P3"],
    S90: ["S90", "960 S90 V90", "Sv60 Sv90 Xc60 Xc90 Spa"],
    V40: ["V40", "V40 P1", "S40 V40"],
    V50: ["V50", "C30 C70 S40 V50 P1"],
    V60: ["V60", "Sv60 Sv90 Xc60 Xc90 Spa"],
    V70: ["V70", "850 S70 V70 C70 P80", "S60 V70 S80 Xc70 P2", "S60 V70 Xc60 P3", "S70 V70 C70 Xc70 P80", "V70 S80 Xc70 P3"],
    V90: ["V90", "960 S90 V90"],
    XC60: ["XC60", "S60 V70 Xc60 P3", "Sv60 Sv90 Xc60 Xc90 Spa"],
    XC70: ["XC70", "S60 V70 S80 Xc70 P2", "S70 V70 C70 Xc70 P80", "V70 S80 Xc70 P3"],
    XC90: ["XC90", "Sv60 Sv90 Xc60 Xc90 Spa"],
  },
};

const MODEL_GROUP_CACHE = new Map<string, Record<string, string[]>>();
function modelAliasGroups(make: string) {
  const key = normalizeShopSearchText(canonicalVehicleMakeLabel(make));
  const cached = MODEL_GROUP_CACHE.get(key);
  if (cached) return cached;
  const groups: Record<string, string[]> = Object.fromEntries(
    Object.entries(VEHICLE_MODEL_ALIAS_GROUPS[key] ?? {}).map(([label, aliases]) => [label, [...aliases]])
  );
  for (const [raw, labels] of Object.entries(SHOP_VEHICLE_MODEL_CORRECTIONS[key] ?? {})) {
    for (const label of labels) groups[label] = [...new Set([...(groups[label] ?? []), label, raw])];
  }
  // Generation remains available through the separate chassis/year selectors.
  // Keep supplier values for queries, while presenting a single model family.
  for (const [raw, family] of Object.entries(generationAliases[canonicalVehicleMakeLabel(make) as keyof typeof generationAliases] ?? {})) {
    if (!isSelectableVehicleModel(make, raw)) continue;
    const label = formatVehicleModelLabel(family);
    groups[label] = [...new Set([...(groups[label] ?? []), label, label.replace(/\s+/g, "-"), raw])];
  }
  MODEL_GROUP_CACHE.set(key, groups);
  return groups;
}

export function isSelectableVehicleModel(make: string, value: string) {
  const makeKey = normalizeShopSearchText(canonicalVehicleMakeLabel(make));
  return !Object.entries(SHOP_VEHICLE_MODEL_CORRECTIONS[makeKey] ?? {}).some(
    ([raw, labels]) => labels.length === 0 && vehicleModelKey(raw) === vehicleModelKey(value)
  );
}

function knownCanonicalVehicleModelLabels(make: string, value: string) {
  const requestedKey = vehicleModelKey(value);
  const labels: string[] = [];
  for (const [canonical, aliases] of Object.entries(modelAliasGroups(make))) {
    if (aliases.some((alias) => vehicleModelKey(alias) === requestedKey)) labels.push(canonical);
  }
  return labels;
}

export function vehicleModelAliases(make: string, value: string) {
  const canonicals = knownCanonicalVehicleModelLabels(make, value);
  const labels = canonicals.length ? canonicals : [value.trim()];
  return [...new Set([value.trim(), value.trim().replace(/\s+/g, "-"), ...labels.flatMap(label => modelAliasGroups(make)[label] ?? [label])])];
}

const CANONICAL_MODEL_LABELS: Readonly<Record<string, string>> = {
  "cupra:formentor": "Formentor",
  "honda:civic": "Civic",
  "honda:civictyper": "Civic Type R",
  "honda:s2000": "S2000",
  "hyundai:i30n": "i30 N",
  "mazda:cx9": "CX-9",
  "mercedes benz:aclass": "A-Class",
  "mercedes benz:aclasssaloon": "A-Class Saloon",
  "mercedes benz:cclass": "C-Class",
  "mercedes benz:cclassconvertible": "C-Class Convertible",
  "mercedes benz:cclasscoupe": "C-Class Coupe",
  "mercedes benz:cclasstmodel": "C-Class T-Model",
  "mercedes benz:claclass": "CLA-Class",
  "mercedes benz:eclass": "E-Class",
  "mercedes benz:eclassconvertible": "E-Class Convertible",
  "mercedes benz:eclasscoupe": "E-Class Coupe",
  "mercedes benz:eclasstmodel": "E-Class T-Model",
  "mercedes benz:eqc": "EQC",
  "mercedes benz:gclass": "G-Class",
  "mercedes benz:gclassclosedoffroadvehicle": "G-Class Closed Off-Road Vehicle",
  "mercedes benz:gclassconvertible": "G-Class Convertible",
  "mercedes benz:glaclass": "GLA-Class",
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
  const makeKey = normalizeShopSearchText(canonicalVehicleMakeLabel(make));
  const aliasLabel = knownCanonicalVehicleModelLabels(make, value)[0];
  if (aliasLabel) return aliasLabel;
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
    if (rsQ) return `RSQ${rsQ[1]}`;
    const rs = key.match(/^rs(\d)$/);
    if (rs) return `RS${rs[1]}`;
    const sq = key.match(/^sq(\d)$/);
    if (sq) return `SQ${sq[1]}`;
    if (key === "ttrs") return "TTRS";
  }
  return formatVehicleModelLabel(value);
}

export function canonicalizeVehicleModels(make: string, values: readonly string[]) {
  const byKey = new Map<string, string>();
  for (const value of values) {
    if (!isSelectableVehicleModel(make, value)) continue;
    const canonicals = knownCanonicalVehicleModelLabels(make, value);
    for (const canonical of canonicals.length ? canonicals : [canonicalVehicleModelLabel(make, value)]) {
      const key = vehicleModelKey(canonical);
      if (!key) continue;
      byKey.set(key, canonical);
    }
  }
  return [...byKey.values()].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" })
  );
}

/**
 * Turns supplier groups such as `G90-G99`, `G90/G99`, or `G90 G99` into
 * selectable chassis codes. Descriptive generations stay intact.
 */
export function splitVehicleChassisCodes(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  if (!normalized) return [];

  const delimited = normalized.split(/\s*[,/;]\s*/g).filter(Boolean);
  const result: string[] = [];
  for (const part of delimited) {
    const range = /^([A-Z]{1,4}\d{1,4}(?:\.\d+)?)\s*-\s*([A-Z]{1,4}\d{1,4}(?:\.\d+)?)$/u.exec(part);
    if (range) {
      result.push(range[1]!, range[2]!);
      continue;
    }
    const spaced = part.split(" ");
    if (spaced.length > 1 && spaced.every((token) => /^(?=.*\d)[A-Z0-9.]+$/u.test(token))) {
      result.push(...spaced);
      continue;
    }
    result.push(part);
  }
  return [...new Set(result)];
}

const BMW_CHASSIS_BY_MODEL: Readonly<Record<string, readonly string[]>> = {
  "1 Series": ["E81", "E82", "E87", "E88", "F20", "F21", "F40", "F70"],
  "1 Series M Coupé": ["E82"],
  "2 Series": ["F22", "F23", "F44", "G42"],
  "2 Series Active Tourer": ["F45", "F46", "U06"],
  "3 Series": ["E21", "E30", "E36", "E46", "E90", "E91", "E92", "E93", "F30", "F31", "F34", "G20", "G21", "G28"],
  "4 Series": ["F32", "F33", "F36", "G22", "G23", "G26"],
  "5 Series": ["E12", "E28", "E34", "E39", "E60", "E61", "F07", "F10", "F11", "G30", "G31", "G60", "G61"],
  "6 Gran Turismo": ["G32"],
  "6 Series": ["E24", "E63", "E64", "F06", "F12", "F13"],
  "7 Series": ["E23", "E32", "E38", "E65", "E66", "F01", "F02", "G11", "G12", "G70"],
  "8 Series": ["E31", "G14", "G15", "G16"],
  i4: ["G26"],
  i8: ["I12", "I15"],
  M2: ["F87", "G87"],
  M3: ["E30", "E36", "E46", "E90", "E92", "E93", "F80", "G80", "G81"],
  M4: ["F82", "F83", "G82", "G83"],
  M5: ["E28", "E34", "E39", "E60", "E61", "F10", "F90", "G90", "G99"],
  M8: ["F91", "F92", "F93"],
  X1: ["E84", "F48", "U11"],
  X2: ["F39", "U10"],
  X3: ["E83", "F25", "G01", "G45"],
  "X3 M": ["F97"],
  X4: ["F26", "G02"],
  "X4 M": ["F98"],
  X5: ["E53", "E70", "F15", "G05"],
  "X5 M": ["E70", "F85", "F95"],
  X6: ["E71", "F16", "G06"],
  "X6 M": ["E71", "F86", "F96"],
  X7: ["G07"],
  XM: ["G09"],
  Z4: ["E85", "E86", "E89", "G29"],
};

export function canonicalizeVehicleChassisCodes(
  values: readonly string[],
  make?: string | null,
  model?: string | null
) {
  const normalized = [...new Set(values.flatMap(splitVehicleChassisCodes))];
  const canonicalMake = canonicalVehicleMakeLabel(make ?? "");
  const canonicalModel = model ? canonicalVehicleModelLabel(canonicalMake, model) : "";
  const allowed = canonicalMake === "BMW" ? BMW_CHASSIS_BY_MODEL[canonicalModel] : null;
  const filtered = allowed
    ? normalized.filter((value) => allowed.includes(value === "F87N" ? "F87" : value))
        .map((value) => value === "F87N" ? "F87" : value)
    : normalized;
  return [...new Set(filtered)].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true, sensitivity: "base" })
  );
}
