/**
 * Cross-shop fitment matcher.
 *
 * Given a product on one brand store, find products from OTHER brand stores
 * that fit the same vehicle (e.g. an ADRO M3 G80 bumper → iPE M3 G80 exhaust,
 * Akrapovic M3 G80 system, Ohlins M3 G80 coilovers, GiroDisc M3 G80 rotors).
 *
 * Each brand has its own fitment extractor (Adro, iPE, CSF, GiroDisc, Ohlins,
 * Akrapovic, etc). This module delegates to them when the product belongs to
 * that brand, and falls back to generic title-based detection otherwise.
 *
 * Urban, Brabus, and Turn14 are intentionally excluded from cross-shop
 * recommendations on both sides — they have bespoke catalogs whose fitment
 * signals don't align with the rest of the lineup.
 */

import type { ShopProduct } from "@/lib/shopCatalog";
import { detectAdroMakes, detectAdroModels, isAdroProduct } from "@/lib/adroCatalog";
import { resolveIpeVehicleBrand, resolveIpeVehicleModel } from "@/lib/ipeCatalog";
import { extractCsfCatalogFitment } from "@/lib/csfCatalog";
import { detectOhlinsMake } from "@/lib/ohlinsCatalog";
import {
  extractVehicleBrand,
  extractVehicleModel,
  extractVehicleModelNamesForBrand,
  extractVehicleModelsForBrand,
} from "@/lib/akrapovicFilterUtils";

/* ── Excluded brands (no recommendations to or from these) ───── */

const EXCLUDED_BRAND_TOKENS = ["urban", "brabus", "turn14", "turn 14"];

export function isExcludedFromCrossShop(product: Pick<ShopProduct, "brand" | "vendor">) {
  const brand = String(product.brand ?? "")
    .trim()
    .toLowerCase();
  const vendor = String(product.vendor ?? "")
    .trim()
    .toLowerCase();
  return EXCLUDED_BRAND_TOKENS.some((token) => brand.includes(token) || vendor.includes(token));
}

/* ── Chassis-code dictionary (shared across brands) ───────────── */

const CHASSIS_CODES = new Set([
  // BMW
  "E30",
  "E34",
  "E36",
  "E39",
  "E46",
  "E84",
  "E60",
  "E63",
  "E64",
  "E82",
  "E87",
  "E90",
  "E91",
  "E92",
  "E93",
  "E9X",
  "F06",
  "F10",
  "F12",
  "F13",
  "F15",
  "F16",
  "F20",
  "F21",
  "F22",
  "F23",
  "F30",
  "F31",
  "F32",
  "F33",
  "F34",
  "F36",
  "F39",
  "F40",
  "F48",
  "F80",
  "F82",
  "F83",
  "F85",
  "F86",
  "F87",
  "F87N",
  "F90",
  "F91",
  "F92",
  "F93",
  "F95",
  "F96",
  "F97",
  "F98",
  "G01",
  "G02",
  "G05",
  "G06",
  "G07",
  "G08",
  "G09",
  "G11",
  "G12",
  "G14",
  "G15",
  "G16",
  "G20",
  "G21",
  "G22",
  "G23",
  "G26",
  "G29",
  "G30",
  "G31",
  "G32",
  "G42",
  "G43",
  "G70",
  "G80",
  "G81",
  "G82",
  "G83",
  "G87",
  "G8X",
  "G90",
  "G99",
  "U10",
  "U11",
  // Audi / VW
  "B5",
  "B7",
  "B8",
  "B8.5",
  "B9",
  "B9.5",
  "C5",
  "C6",
  "C7",
  "C8",
  "D5",
  "PQ35",
  "8V",
  "8V.1",
  "8V.2",
  "8Y",
  "8Y.1",
  "8Y.2",
  "8S",
  "8R",
  "4M",
  "4G",
  "4F",
  "8J",
  "4S",
  "FY",
  "F1",
  "8U",
  "F3",
  "8T",
  // VW chassis
  "MQB",
  "MK7",
  "MK7.5",
  "MK8",
  "VAG",
  // Porsche
  "991",
  "991.1",
  "991.2",
  "992",
  "992.1",
  "992.2",
  "718",
  "981",
  "982",
  "987",
  "987.1",
  "987.2",
  "986",
  "996",
  "997",
  "997.1",
  "997.2",
  "930",
  "964",
  "993",
  "928",
  "944",
  "914",
  "955",
  "957",
  "958",
  "971",
  "976",
  "E3",
  "MACAN",
  "CAYENNE",
  "9YA",
  "9Y0",
  "9YB",
  "9PA",
  "95B",
  "95B.1",
  "95B.2",
  "536",
  "970",
  "972",
  "J1",
  // Mercedes
  "W124",
  "W201",
  "W202",
  "W203",
  "W204",
  "W205",
  "W206",
  "W210",
  "W211",
  "W212",
  "W213",
  "W214",
  "W220",
  "W221",
  "W222",
  "W223",
  "W163",
  "W164",
  "W166",
  "W167",
  "W463",
  "W463A",
  "W464",
  "W465",
  "W176",
  "W177",
  "C118",
  "Z117",
  "W246",
  "W247",
  "C124",
  "C140",
  "C190",
  "C197",
  "C217",
  "C167",
  "X167",
  "R107",
  "R129",
  "R171",
  "R172",
  "R230",
  "R231",
  "R232",
  "C117",
  "X117",
  "X118",
  "X156",
  "X247",
  "H247",
  "X253",
  "C253",
  "X254",
  "C192",
  "X290",
  // Range Rover / Land Rover
  "L405",
  "L460",
  "L461",
  "L462",
  "L494",
  "L538",
  "L551",
  "L663",
  // Lamborghini
  "LP610",
  "LP640",
  "LP700",
  "LP740",
  "LP750",
  // Toyota
  "A80",
  "A90",
  "A91",
  "AE86",
  "GR86",
  "ZN6",
  "ZN8",
  "JZA80",
  "JZA90",
  "E210",
  "GXPA16",
  "GZEA14",
  // Subaru
  "GC",
  "GD",
  "GE",
  "GH",
  "GR",
  "GV",
  "VA",
  "VB",
  "VAB",
  "VAG",
  "VAF",
  "ZD8",
  "ZC6",
  // Honda
  "FK8",
  "FL5",
  "FK7",
  "FN2",
  "FE1",
  // Nissan
  "R32",
  "R33",
  "R34",
  "R35",
  "RZ34",
  "Z33",
  "Z34",
  // Chevrolet
  "C5",
  "C6",
  "C7",
  "C8",
  // Mazda
  "NA",
  "NB",
  "NC",
  "ND",
  // Mini
  "R56",
  "R57",
  "R58",
  "R59",
  "F54",
  "F55",
  "F56",
  "F57",
  "F60",
  // Cupra
  "VZ5",
]);

/* ── Make detection (shared) ──────────────────────────────────── */

const MAKE_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "BMW",
    patterns: [
      /\bBMW\b/i,
      /\bM[2-5]\b/i,
      /\bX[3-6]M\b/i,
      /\bS1000\s*(?:RR|R|XR)\b/i,
      /\bM1000\s*(?:RR|R|XR)\b/i,
      /\bR1250\s*GS\b/i,
      /\bR1300\s*GS\b/i,
    ],
  },
  {
    label: "Porsche",
    patterns: [
      /\bporsche\b/i,
      /\b911\b/i,
      /\b992\b/i,
      /\b991\b/i,
      /\b718\b/i,
      /\bcayenne\b/i,
      /\bpanamera\b/i,
      /\bmacan\b/i,
      /\btaycan\b/i,
    ],
  },
  {
    label: "Toyota",
    patterns: [/\btoyota\b/i, /\bsupra\b/i, /\bgr86\b/i, /\bgr\s*yaris\b/i, /\bgr\s*corolla\b/i],
  },
  { label: "Subaru", patterns: [/\bsubaru\b/i, /\bbrz\b/i, /\bsti\b/i, /\bwrx\b/i] },
  { label: "Tesla", patterns: [/\btesla\b/i, /\bmodel[\s-]+[3sxy]\b/i] },
  {
    label: "Ford",
    patterns: [
      /\bford\b/i,
      /\bmustang\b/i,
      /\bfocus\s*rs\b/i,
      /\bfocus\s*st\b/i,
      /\bfiesta\s*st\b/i,
      /\bmondeo\b/i,
    ],
  },
  { label: "Kia", patterns: [/\bkia\b/i, /\bstinger\b/i, /\bk5\b/i] },
  { label: "Honda", patterns: [/\bhonda\b/i, /\bcivic\b/i, /\btype[-\s]r\b/i] },
  {
    label: "Hyundai",
    patterns: [/\bhyundai\b/i, /\belantra\b/i, /\bveloster\b/i, /\bi30\s*n\b/i, /\bioniq\s*5\b/i],
  },
  {
    label: "Genesis",
    patterns: [/\bgenesis\b/i, /\bgv70\b/i, /\bgv80\b/i, /\bg70\b/i, /\bg80\b/i, /\bg90\b/i],
  },
  { label: "Chevrolet", patterns: [/\bchevrolet\b/i, /\bcorvette\b/i, /\bcamaro\b/i] },
  {
    label: "Audi",
    patterns: [/\baudi\b/i, /\brs[3-7]\b/i, /\brsq[3-8]\b/i, /\br8\b/i, /\btt\s*rs\b/i],
  },
  {
    label: "Volkswagen",
    patterns: [
      /\bvolkswagen\b/i,
      /\bvw\b/i,
      /\bgolf\s*r\b/i,
      /\bgolf\s*gti\b/i,
      /\bgolf\b/i,
      /\bpassat\b/i,
      /\bvag\b/i,
      /\bmqb\b/i,
      /\bea888\b/i,
    ],
  },
  {
    label: "Mercedes-AMG",
    patterns: [
      /\bmercedes[\s–-]*amg\b/i,
      /\bamg\s*(c63|e63|gt|s63|cla|gle|gls)\b/i,
      /\bc63\b/i,
      /\be63\b/i,
      /\bg63\b/i,
      /\bgt\s*63\b/i,
    ],
  },
  {
    label: "Mercedes-Benz",
    patterns: [/\bmercedes[\s–-]*benz\b/i, /\bmercedes\b/i],
  },
  {
    label: "Lamborghini",
    patterns: [
      /\blamborghini\b/i,
      /\baventador\b/i,
      /\bhuracan\b/i,
      /\bhuracán\b/i,
      /\burus\b/i,
      /\brevuelto\b/i,
    ],
  },
  {
    label: "McLaren",
    patterns: [/\bmclaren\b/i, /\b570s\b/i, /\b600lt\b/i, /\b720s\b/i, /\b765lt\b/i, /\bartura\b/i],
  },
  {
    label: "Ferrari",
    patterns: [
      /\bferrari\b/i,
      /\b458\b/i,
      /\b488\b/i,
      /\bf8\b/i,
      /\b296\b/i,
      /\b812\b/i,
      /\bportofino\b/i,
      /\bpurosangue\b/i,
      /\broma\b/i,
    ],
  },
  {
    label: "Maserati",
    patterns: [/\bmaserati\b/i, /\bgranturismo\b/i, /\bgrecale\b/i, /\blevante\b/i],
  },
  {
    label: "Aston Martin",
    patterns: [/\baston[\s–-]*martin\b/i, /\baston\b/i, /\bvantage\b/i, /\bdb11\b/i, /\bdbx\b/i],
  },
  {
    label: "Nissan",
    patterns: [/\bnissan\b/i, /\bgt-r\b/i, /\bgtr\b/i, /\b370z\b/i, /\b350z\b/i, /\bz\s*nismo\b/i],
  },
  { label: "Mitsubishi", patterns: [/\bmitsubishi\b/i, /\blancer\s*evo\b/i, /\bevo\s*[ixv]+\b/i] },
  { label: "Mazda", patterns: [/\bmazda\b/i, /\bmx[-\s]?5\b/i, /\bmiata\b/i] },
  {
    label: "Lotus",
    patterns: [/\blotus\b/i, /\belise\b/i, /\bexige\b/i, /\bemira\b/i, /\bevora\b/i],
  },
  {
    label: "Land Rover",
    patterns: [/\bland[\s–-]*rover\b/i, /\bdefender\b/i, /\bdiscovery\b/i],
  },
  {
    label: "Range Rover",
    patterns: [/\brange[\s–-]*rover\b/i, /\bevoque\b/i, /\bvelar\b/i, /\brrs\b/i],
  },
  {
    label: "Alfa Romeo",
    patterns: [/\balfa[\s–-]*romeo\b/i, /\balfa\b/i, /\bgiulia\b/i, /\bstelvio\b/i],
  },
  {
    label: "Saab",
    patterns: [/\bsaab\b/i],
  },
  {
    label: "Volvo",
    patterns: [/\bvolvo\b/i],
  },
  {
    label: "Citroen",
    patterns: [/\bcitroen\b/i, /\bcitroën\b/i],
  },
  {
    label: "DS",
    patterns: [/\bds\s*3\b/i, /\bds\s*4\b/i, /\bds\s*7\b/i, /\bds\b/i],
  },
  {
    label: "Dodge",
    patterns: [/\bdodge\b/i, /\bram\b/i],
  },
  {
    label: "Jaguar",
    patterns: [/\bjaguar\b/i, /\bf-type\b/i],
  },
  {
    label: "Jeep",
    patterns: [/\bjeep\b/i, /\bwrangler\b/i, /\bgladiator\b/i, /\bcherokee\b/i],
  },
  {
    label: "Mini",
    patterns: [/\bmini\b/i, /\bcooper\b/i],
  },
  {
    label: "Cupra",
    patterns: [/\bcupra\b/i, /\bformentor\b/i],
  },
  {
    label: "SEAT",
    patterns: [/\bseat\b/i, /\bibiza\b/i, /\bleon\b/i, /\baltea\b/i],
  },
  {
    label: "Opel",
    patterns: [/\bopel\b/i],
  },
  {
    label: "Peugeot",
    patterns: [/\bpeugeot\b/i],
  },
  {
    label: "Skoda",
    patterns: [/\bskoda\b/i, /\bškoda\b/i],
  },
  {
    label: "Smart",
    patterns: [/\bsmart\b/i],
  },
  {
    label: "Suzuki",
    patterns: [/\bsuzuki\b/i],
  },
  {
    label: "Lexus",
    patterns: [/\blexus\b/i],
  },
  {
    label: "Cadillac",
    patterns: [/\bcadillac\b/i, /\bats-v\b/i, /\bcts-v\b/i],
  },
  {
    label: "Alpine",
    patterns: [/\balpine\b/i],
  },
  {
    label: "Abarth",
    patterns: [/\babarth\b/i],
  },
  {
    label: "Renault",
    patterns: [/\brenault\b/i, /\bmegane\b/i, /\bclio\b/i],
  },
  {
    label: "INEOS",
    patterns: [/\bineos\b/i, /\bgrenadier\b/i],
  },
  {
    label: "Isuzu",
    patterns: [/\bisuzu\b/i],
  },
  {
    label: "Bentley",
    patterns: [/\bbentley\b/i],
  },
  {
    label: "Rolls-Royce",
    patterns: [/\brolls[\s–-]*royce\b/i],
  },
  {
    label: "Fiat",
    patterns: [/\bfiat\b/i],
  },
  {
    label: "GMC",
    patterns: [/\bgmc\b/i],
  },
  {
    label: "Iveco",
    patterns: [/\biveco\b/i],
  },
  {
    label: "Ducati",
    patterns: [
      /\bducati\b/i,
      /\bpanigale\b/i,
      /\bdiavel\b/i,
      /\bstreetfighter\b/i,
      /\bmultistrada\b/i,
    ],
  },
  {
    label: "Yamaha",
    patterns: [/\byamaha\b/i],
  },
  {
    label: "Kawasaki",
    patterns: [/\bkawasaki\b/i, /\bninja\b/i],
  },
  {
    label: "Acura",
    patterns: [/\bacura\b/i],
  },
  {
    label: "Infiniti",
    patterns: [/\binfiniti\b/i],
  },
  {
    label: "Buick",
    patterns: [/\bbuick\b/i],
  },
  {
    label: "Lancia",
    patterns: [/\blancia\b/i, /\bypsilon\b/i, /\bdelta\b/i],
  },
  {
    label: "Dacia",
    patterns: [
      /\bdacia\b/i,
      /\blogan\b/i,
      /\bduster\b/i,
      /\bsandero\b/i,
      /\blodgy\b/i,
      /\bdokker\b/i,
    ],
  },
  {
    label: "SsangYong",
    patterns: [
      /\bssangyong\b/i,
      /\bkyron\b/i,
      /\bactyon\b/i,
      /\brodius\b/i,
      /\bkorando\b/i,
      /\brexton\b/i,
    ],
  },
  {
    label: "Daewoo",
    patterns: [/\bdaewoo\b/i, /\blacetti\b/i],
  },
  {
    label: "Tata",
    patterns: [/\btata\b/i, /\bindica\b/i, /\bsumo\b/i],
  },
  {
    label: "Chrysler",
    patterns: [/\bchrysler\b/i, /\bvoyager\b/i, /\b300c\b/i],
  },
];

const CHASSIS_BY_MAKE: Record<string, Set<string>> = {
  BMW: new Set([
    "E30",
    "E34",
    "E36",
    "E39",
    "E46",
    "E84",
    "E60",
    "E63",
    "E64",
    "E82",
    "E87",
    "E90",
    "E91",
    "E92",
    "E93",
    "E9X",
    "F06",
    "F10",
    "F12",
    "F13",
    "F15",
    "F16",
    "F20",
    "F21",
    "F22",
    "F23",
    "F30",
    "F31",
    "F32",
    "F33",
    "F34",
    "F36",
    "F39",
    "F40",
    "F48",
    "F80",
    "F82",
    "F83",
    "F85",
    "F86",
    "F87",
    "F87N",
    "F90",
    "F91",
    "F92",
    "F93",
    "F95",
    "F96",
    "F97",
    "F98",
    "G01",
    "G02",
    "G05",
    "G06",
    "G07",
    "G08",
    "G09",
    "G11",
    "G12",
    "G14",
    "G15",
    "G16",
    "G20",
    "G21",
    "G22",
    "G23",
    "G26",
    "G29",
    "G30",
    "G31",
    "G32",
    "G42",
    "G43",
    "G70",
    "G80",
    "G81",
    "G82",
    "G83",
    "G87",
    "G8X",
    "G90",
    "G99",
    "U10",
    "U11",
  ]),
  Porsche: new Set([
    "991",
    "991.1",
    "991.2",
    "992",
    "992.1",
    "992.2",
    "718",
    "981",
    "982",
    "987",
    "987.1",
    "987.2",
    "986",
    "996",
    "997",
    "997.1",
    "997.2",
    "930",
    "964",
    "993",
    "928",
    "944",
    "914",
    "955",
    "957",
    "958",
    "971",
    "976",
    "E3",
    "MACAN",
    "CAYENNE",
    "9YA",
    "9Y0",
    "9YB",
    "9PA",
    "95B",
    "95B.1",
    "95B.2",
    "536",
    "970",
    "972",
    "J1",
  ]),
  Audi: new Set([
    "B5",
    "B7",
    "B8",
    "B8.5",
    "B9",
    "B9.5",
    "C5",
    "C6",
    "C7",
    "C8",
    "D5",
    "PQ35",
    "8V",
    "8V.1",
    "8V.2",
    "8Y",
    "8Y.1",
    "8Y.2",
    "8S",
    "8R",
    "4M",
    "4G",
    "4F",
    "8J",
    "4S",
    "FY",
    "F1",
    "8U",
    "F3",
    "8T",
  ]),
  Volkswagen: new Set(["MQB", "MK7", "MK7.5", "MK8", "PQ35", "B7", "B8", "VAG"]),
  "Mercedes-Benz": new Set([
    "W124",
    "W201",
    "W202",
    "W203",
    "W204",
    "W205",
    "W206",
    "W210",
    "W211",
    "W212",
    "W213",
    "W214",
    "W220",
    "W221",
    "W222",
    "W223",
    "W163",
    "W164",
    "W166",
    "W167",
    "W463",
    "W463A",
    "W464",
    "W465",
    "W176",
    "W177",
    "C118",
    "Z117",
    "W246",
    "W247",
    "C124",
    "C140",
    "C190",
    "C197",
    "C217",
    "C167",
    "X167",
    "R107",
    "R129",
    "R171",
    "R172",
    "R230",
    "R231",
    "R232",
  ]),
  "Mercedes-AMG": new Set([
    "W204",
    "C204",
    "S204",
    "W205",
    "C205",
    "S205",
    "A205",
    "W206",
    "S206",
    "W211",
    "S211",
    "W212",
    "S212",
    "W213",
    "S213",
    "X253",
    "C253",
    "X254",
    "W166",
    "W167",
    "C167",
    "W463",
    "W463A",
    "W465",
    "W221",
    "W222",
    "W223",
    "R231",
    "R232",
    "C190",
    "C192",
    "X290",
    "W176",
    "W177",
    "C117",
    "X117",
    "C118",
    "X118",
    "X156",
    "X247",
    "H247",
    "C217",
    "X167",
    "W464",
    "Z117",
  ]),
  Toyota: new Set([
    "A80",
    "A90",
    "A91",
    "AE86",
    "GR86",
    "ZN6",
    "ZN8",
    "JZA80",
    "JZA90",
    "E210",
    "GXPA16",
    "GZEA14",
  ]),
  Subaru: new Set([
    "GC",
    "GD",
    "GE",
    "GH",
    "GR",
    "GV",
    "VA",
    "VB",
    "VAB",
    "VAG",
    "VAF",
    "ZD8",
    "ZC6",
    "ZN6",
  ]),
  Honda: new Set(["FK8", "FL5", "FK7", "FN2", "FE1"]),
  Nissan: new Set(["R32", "R33", "R34", "R35", "RZ34", "Z33", "Z34"]),
  Chevrolet: new Set(["C5", "C6", "C7", "C8"]),
  Mazda: new Set(["NA", "NB", "NC", "ND"]),
  Mini: new Set(["R56", "R57", "R58", "R59", "F54", "F55", "F56", "F57", "F60"]),
  "Land Rover": new Set(["L405", "L460", "L461", "L462", "L494", "L538", "L551", "L663"]),
  "Range Rover": new Set(["L405", "L460", "L461", "L462", "L494", "L538", "L551", "L663"]),
  Lamborghini: new Set(["LP610", "LP640", "LP700", "LP740", "LP750"]),
  Cupra: new Set(["VZ5"]),
  Tesla: new Set(["model 3", "model y", "model s", "model x"]),
  "Alfa Romeo": new Set(["955"]),
  Citroen: new Set(["C8"]),
  Ferrari: new Set(["F12", "F40"]),
};

const VALID_MODELS_BY_MAKE: Record<string, Set<string>> = {
  "Aston Martin": new Set([
    "Vantage",
    "DB11",
    "DBX",
    "DBS",
    "DB12",
    "Vanquish",
    "Rapide",
    "DB9",
    "Valkyrie",
    "Valhalla",
  ]),
  BMW: new Set([
    "1 Series",
    "1 Series M",
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "6 Series",
    "7 Series",
    "8 Series",
    "M135i",
    "M140i",
    "M235i",
    "M240i",
    "M340i",
    "M340d",
    "M440i",
    "M440d",
    "M550i",
    "M850i",
    "M135i/M140i",
    "M235i/M240i",
    "M340i/M340d",
    "M440i/M440d",
    "M2",
    "M3",
    "M4",
    "M5",
    "M6",
    "M8",
    "Z4",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
    "X3 M",
    "X4 M",
    "X5 M",
    "X6 M",
    "Xm",
    "S1000RR",
    "S1000R",
    "S1000XR",
    "M1000RR",
    "M1000R",
    "M1000XR",
    "R1300GS / Adventure",
    "R1300R / RS",
    "F 900 R",
    "M1000r",
    "M1000rr",
    "M1000xr",
    "R1300gs",
    "R1300r",
    "S1000r",
    "S1000rr",
    "S1000xr",
  ]),
  Porsche: new Set([
    "911",
    "718 Boxster/Cayman",
    "Cayenne",
    "Macan",
    "Panamera",
    "Taycan",
    "914-6",
    "718",
    "GT3",
    "GT3RS",
    "GT4",
    "GT4RS",
    "GT2",
    "GT2RS",
    "Carrera",
    "GTS",
    "Turbo",
    "Turbo S",
    "928",
    "944",
    "968",
    "Boxster",
    "Cayman",
  ]),
  Audi: new Set([
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "S3",
    "S4",
    "S5",
    "S6",
    "S7",
    "RS3",
    "RS4",
    "RS5",
    "RS6",
    "RS7",
    "RS Q8",
    "SQ7",
    "SQ8",
    "TT",
    "TT-RS",
    "TTS",
    "R8",
    "80",
    "Q3",
    "Q5",
    "Q7",
    "Q8",
    "RSQ3",
    "RSQ8",
    "SQ5",
    "SQ7",
    "SQ8",
  ]),
  Volkswagen: new Set([
    "Golf",
    "Jetta Gli",
    "Tiguan R",
    "Scirocco",
    "Polo",
    "Passat",
    "GTI",
    "Golf GTI",
    "Golf R",
    "R",
    "GLI",
    "CC",
    "Tiguan",
    "Taos",
    "Transporter",
    "T6",
    "T6.1",
    "Arteon",
    "Touareg",
    "Caddy",
    "Amarok",
  ]),
  "Mercedes-AMG": new Set([
    "A45",
    "CLA45",
    "GLA45",
    "C63",
    "E63",
    "GLC63",
    "GLE63",
    "G63",
    "S63",
    "SL63",
    "AMG GT",
    "CLS53",
    "CLS63",
    "E53",
    "G500",
  ]),
  "Mercedes-Benz": new Set([
    "190e",
    "A-Class",
    "C-Class",
    "E-Class",
    "G-Class",
    "G-Wagon",
    "CLA-Class",
    "CLS-Class",
    "GLC-Class",
    "GLE-Class",
    "S-Class",
    "SL",
    "EQC",
    "CLA",
    "CLS",
    "GLC",
    "GLE",
    "GLA",
    "GLS",
    "A45",
    "CLA45",
    "GLA45",
    "C63",
    "E63",
    "GLC63",
    "GLE63",
    "G63",
    "S63",
    "SL63",
    "AMG GT",
    "CLS53",
    "CLS63",
    "E53",
    "Sprinter",
    "Vito",
    "V-Class",
    "CLK",
    "SLK",
    "SLS",
    "M-Class",
    "ML",
    "GLK",
    "GLB",
    "CL",
    "SLC",
    "C43",
    "C450",
    "CLK-Class",
    "SLK-Class",
    "GLK-Class",
    "GLB-Class",
    "CL-Class",
    "SLC-Class",
  ]),
  Toyota: new Set([
    "GR Supra",
    "GR Yaris",
    "GR Corolla",
    "GT86",
    "GR86",
    "Land Cruiser",
    "Tacoma",
    "Tundra",
    "4runner",
    "Fj Cruiser",
    "Sequoia",
    "Highlander",
    "Crown",
    "Vellfire",
    "Hilux",
    "Yaris",
    "Corolla",
    "Supra",
    "Rav4",
    "Camry",
    "Prius",
  ]),
  Subaru: new Set(["brz", "forester", "impreza", "legacy", "outback", "sti", "wrx", "wrx sti"]),
  Honda: new Set(["civic", "civic si", "civic type r", "s2000"]),
  Nissan: new Set([
    "350z",
    "370z",
    "frontier",
    "gt-r",
    "pathfinder",
    "rz34 400z",
    "skyline gt-r",
    "titan",
    "xterra",
    "Armada",
    "Patrol",
    "Rogue",
    "Navara",
    "Note",
    "Almera",
    "Primera",
    "Qashqai",
    "Juke",
    "Leaf",
    "Z",
    "350Z",
    "370Z",
    "GTR",
  ]),
  Chevrolet: new Set(["Camaro", "Corvette", "Gmc Sierra Hd", "Silverado Hd"]),
  Mazda: new Set([
    "miata",
    "rx-8",
    "MX-5",
    "MX-5 Miata",
    "Miata",
    "RX-7",
    "RX-8",
    "CX-30",
    "CX-5",
    "CX-60",
    "CX-70",
    "CX-80",
    "CX-90",
    "Mazda 3",
    "Mazda 6",
  ]),
  Mini: new Set(["Cooper"]),
  Lamborghini: new Set(["Huracán", "Aventador", "Urus"]),
  Cupra: new Set(["formentor", "Leon", "Ateca", "Born"]),
  Tesla: new Set(["Model 3", "Model Y", "Model S", "Model X"]),
  Ferrari: new Set([
    "296",
    "360 Modena",
    "458",
    "488",
    "812",
    "F12",
    "F355",
    "F430",
    "F8",
    "Ff",
    "Gtc4lusso T",
    "Portofino",
    "Purosangue",
    "Roma",
  ]),
  Acura: new Set(["RSX", "NSX", "Integra", "TLX", "MDX"]),
  Cadillac: new Set(["CTS-V"]),
  Dodge: new Set(["RAM"]),
  Ducati: new Set([
    "Diavel V4",
    "Multistrada V4",
    "Panigale V2",
    "Panigale V4",
    "Streetfighter V2",
    "Streetfighter V4",
    "Monster",
    "DesertX",
    "SuperSport",
    "Diavel",
    "Diavel 1260",
    "Panigale",
    "Streetfighter",
    "Multistrada",
    "Scrambler",
    "Hypermotard",
  ]),
  Ford: new Set([
    "Bronco",
    "F-150 Raptor",
    "Fiesta St",
    "Focus Rs",
    "Focus St",
    "Gt",
    "Mustang",
    "Ranger",
    "Maverick",
    "Mondeo",
    "Everest",
    "F-150",
    "F-250",
    "F-350",
    "Super Duty",
    "Focus",
    "Fiesta",
    "Kuga",
    "Puma",
    "Explorer",
    "Transit",
  ]),
  Genesis: new Set(["G70", "G80", "G90", "GV70", "GV80"]),
  Hyundai: new Set([
    "Elantra N",
    "Genesis",
    "Ioniq 5 N",
    "Veloster N",
    "i30 N",
    "i30",
    "Tucson",
    "Santa Fe",
    "Kona",
  ]),
  Infiniti: new Set([
    "G35",
    "G37",
    "Q50",
    "Q60",
    "Q70",
    "QX50",
    "QX60",
    "QX70",
    "QX80",
    "EX",
    "FX",
  ]),
  Jeep: new Set([
    "Gladiator",
    "Wrangler",
    "Grand Cherokee",
    "Cherokee",
    "Wagoneer",
    "Grand Wagoneer",
    "Compass",
    "Patriot",
    "Renegade",
  ]),
  Kia: new Set([
    "K5",
    "Stinger",
    "Ceed",
    "Sportage",
    "Sorento",
    "Rio",
    "Cerato",
    "Optima",
    "Proceed",
  ]),
  Lexus: new Set(["GX", "LX", "IS", "LC", "RC", "LS", "RX", "NX"]),
  Maserati: new Set(["Ghibli", "GranTurismo", "Levante", "Quattroporte"]),
  McLaren: new Set([
    "540C",
    "570S",
    "570GT",
    "600LT",
    "650S",
    "675LT",
    "720S",
    "750S",
    "765LT",
    "Artura",
    "Senna",
    "P1",
    "GT",
    "GTS",
  ]),
  Mitsubishi: new Set(["Lancer Evolution", "Evo", "Evo X", "ASX", "Outlander"]),
  Renault: new Set([
    "Clio",
    "Megane",
    "Scenic",
    "Grand Scenic",
    "Captur",
    "Koleos",
    "Talisman",
    "Espace",
    "Vel Satis",
    "Laguna",
    "Twingo",
    "Kangoo",
    "Master",
    "Traffic",
    "Trafic",
  ]),
  "Alfa Romeo": new Set([
    "Giulia",
    "Stelvio",
    "Giulietta",
    "Mito",
    "Giulia Quadrifoglio",
    "Stelvio Quadrifoglio",
  ]),
  Lotus: new Set(["Elise", "Exige", "Emira", "Evora"]),
  Volvo: new Set([
    "C30",
    "C70",
    "S40",
    "V40",
    "V50",
    "S60",
    "V60",
    "XC60",
    "V70",
    "XC70",
    "S80",
    "S90",
    "V90",
    "XC90",
    "740",
    "940",
    "850",
  ]),
  Opel: new Set([
    "Insignia",
    "Astra",
    "Vectra",
    "Calibra",
    "Movano",
    "Corsa",
    "Mokka",
    "Zafira",
    "Adam",
    "Grandland",
  ]),
  SEAT: new Set(["Leon", "Ibiza", "Ateca", "Arona", "Altea"]),
  "Land Rover": new Set(["Defender", "Discovery", "Freelander"]),
  "Range Rover": new Set(["Evoque", "Velar", "Sport", "Vogue", "L460", "L405", "L494"]),
  Suzuki: new Set(["Jimny", "Swift", "Vitara", "Ignis", "Grand Vitara"]),
  Isuzu: new Set(["D-Max"]),
  Skoda: new Set([
    "Superb",
    "Octavia",
    "Fabia",
    "Rapid",
    "Yeti",
    "Roomster",
    "Scala",
    "Kodiaq",
    "Karoq",
    "Kamiq",
  ]),
  Peugeot: new Set([
    "208",
    "308",
    "508",
    "2008",
    "3008",
    "5008",
    "Partner",
    "Expert",
    "Boxer",
    "307",
    "107",
    "108",
    "206",
    "207",
    "301",
    "306",
    "407",
    "4007",
    "4008",
  ]),
  Dacia: new Set(["Logan", "Duster", "Sandero", "Lodgy", "Dokker"]),
  Lancia: new Set([
    "Ypsilon",
    "Delta",
    "Phedra",
    "Voyager",
    "Thema",
    "Lybra",
    "Thesis",
    "Musa",
    "Kappa",
  ]),
  Fiat: new Set([
    "Scudo",
    "Freemont",
    "Bravo",
    "Palio",
    "Tipo",
    "Punto",
    "Doblo",
    "Ducato",
    "500",
    "Idea",
    "Viaggio",
    "Sedici",
    "Panda",
    "Fiorino",
    "124 Spider",
    "Marea",
    "Croma",
  ]),
  Smart: new Set(["Fortwo", "Forfour", "#1", "#3"]),
  Daewoo: new Set(["Lacetti"]),
  Tata: new Set(["Indica", "Sumo", "Indigo", "Safari", "Xenon"]),
  SsangYong: new Set(["Kyron", "Actyon", "Rodius", "Korando", "Rexton", "Stavic"]),
  GMC: new Set(["Sierra", "Canyon"]),
  Citroen: new Set([
    "C3",
    "C4",
    "C5",
    "C8",
    "DS3",
    "DS4",
    "Berlingo",
    "Jumper",
    "C1",
    "C2",
    "C-Crosser",
    "Nemo",
    "Saxo",
    "Xsara",
  ]),
  Jaguar: new Set(["E-Pace", "F-Pace", "XE", "XF", "X-Type", "F-Type", "I-Pace", "XJ", "XK"]),
  "Rolls-Royce": new Set(["Cullinan", "Ghost", "Wraith", "Phantom", "Dawn"]),
  Bentley: new Set(["Continental GT", "Continental GTC", "Bentayga", "Flying Spur", "Mulsanne"]),
  Saab: new Set(["9-3", "9-5", "900", "9000"]),
  DS: new Set(["DS3", "DS5", "DS7", "DS 3 Crossback", "DS 7 Crossback"]),
  Chrysler: new Set(["Grand Voyager", "300C", "Crossfire"]),
  Alpine: new Set(["A110", "A110GT", "A110S"]),
  INEOS: new Set(["Grenadier"]),
  Buick: new Set(["Envista", "Regal", "Enclave"]),
  Iveco: new Set(["Massif", "Daily"]),
  Abarth: new Set(["500", "595", "695", "124 Spider", "Punto", "Grande Punto"]),
};

const CHASSIS_TO_MAKE: Record<string, string> = {};
for (const [make, set] of Object.entries(CHASSIS_BY_MAKE)) {
  for (const code of set) {
    if (["PQ35", "B7", "B8", "ZN6", "GD", "C8"].includes(code)) {
      continue;
    }
    if (!CHASSIS_TO_MAKE[code]) {
      CHASSIS_TO_MAKE[code] = make;
    }
  }
}

/* ── Public API ───────────────────────────────────────────────── */

export type Fitment = {
  /** Canonical make label, e.g. "BMW", "Porsche". */
  make: string | null;
  /** Distinct model labels (lowercased & deduped). */
  models: string[];
  /** Chassis codes (uppercased & deduped). */
  chassisCodes: string[];
};

function uniq<T>(values: ReadonlyArray<T>): T[] {
  return Array.from(new Set(values));
}

function lower(value: string) {
  return value.trim().toLowerCase();
}

/** Strip year ranges, "from"/"to" connectives, and excess whitespace from a
 *  model label so "S Class W221 2005 To 2013" → "S Class W221". */
function stripYearNoise(value: string) {
  return value
    .replace(/\b(?:from|to|до|з)\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)?\d{2,4}/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(product: ShopProduct): string {
  return [
    product.title?.en,
    product.title?.ua,
    product.shortDescription?.en,
    product.shortDescription?.ua,
    product.longDescription?.en,
    product.longDescription?.ua,
    product.collection?.en,
    product.collection?.ua,
    product.category?.en,
    product.category?.ua,
    product.productType,
    product.vendor,
    ...(product.tags ?? []),
    ...(product.highlights ?? []).flatMap((item) => [item.en, item.ua]),
    ...(product.collections ?? []).flatMap((item) => [
      item.handle,
      item.title?.en,
      item.title?.ua,
      item.brand,
    ]),
    ...(product.variants ?? []).flatMap((variant) => [
      variant.title,
      variant.sku,
      variant.optionValues?.join(" "),
    ]),
    product.slug,
    product.sku,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" | ");
}

function detectMakeGeneric(text: string): string | null {
  for (const entry of MAKE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return entry.label;
    }
  }
  return null;
}

function extractChassisFromText(text: string): string[] {
  const found = new Set<string>();
  // Match in parens: (G80), (G80/G81), (F82, F83)
  const parens = text.matchAll(/\(([^)]{1,80})\)/g);
  for (const match of parens) {
    const inside = match[1];
    const tokens = inside.split(/[/,;\s]+/);
    for (const raw of tokens) {
      const upper = raw
        .trim()
        .toUpperCase()
        .replace(/[.,]+$/, "");
      if (CHASSIS_CODES.has(upper)) {
        found.add(upper);
      }
    }
  }
  // Bare codes anywhere in text (G80, F82 even without parens)
  const bareTokens = text.toUpperCase().split(/[^A-Z0-9.]+/);
  for (const token of bareTokens) {
    if (CHASSIS_CODES.has(token)) {
      found.add(token);
    }
  }
  return [...found];
}

function extractTagModels(product: ShopProduct): string[] {
  const tags = product.tags ?? [];
  const models: string[] = [];
  for (const tag of tags) {
    const normalized = String(tag ?? "")
      .trim()
      .toLowerCase();
    if (normalized.startsWith("car_model:")) {
      models.push(normalized.slice("car_model:".length).replace(/[-_]/g, " "));
    }
  }
  return models;
}

function extractTagMake(product: ShopProduct): string | null {
  const tags = product.tags ?? [];
  // Pass 1: prefer the dedicated `car_make:` tag.
  for (const tag of tags) {
    const normalized = String(tag ?? "")
      .trim()
      .toLowerCase();
    if (!normalized.startsWith("car_make:")) continue;
    const slug = normalized.slice("car_make:".length);
    const match = MAKE_PATTERNS.find((entry) => entry.label.toLowerCase() === slug);
    if (match) return match.label;
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }
  // Pass 2: fall back to `brand:` only when it names a known vehicle make.
  // Some catalogs (Burger) overload `brand:bmw` to mean vehicle make; others
  // (Girodisc) use `brand:girodisc` for the vendor — that latter case must NOT
  // be misread as a vehicle make.
  for (const tag of tags) {
    const normalized = String(tag ?? "")
      .trim()
      .toLowerCase();
    if (!normalized.startsWith("brand:")) continue;
    const slug = normalized.slice("brand:".length);
    const match = MAKE_PATTERNS.find((entry) => entry.label.toLowerCase() === slug);
    if (match) return match.label;
  }
  return null;
}

/**
 * Extract fitment from any product, delegating to the brand-specific
 * extractor when available and falling back to generic detection.
 */
const MODEL_PATTERNS: Record<string, RegExp[]> = {
  "Aston Martin": [
    /\bvantage\b/i,
    /\bdb11\b/i,
    /\bdbx\b/i,
    /\bdbs\b/i,
    /\bdb12\b/i,
    /\bvanquish\b/i,
    /\brapide\b/i,
    /\bdb9\b/i,
    /\bvalkyrie\b/i,
    /\bvalhalla\b/i,
  ],
  "Mercedes-AMG": [
    /\ba45\b/i,
    /\bcla45\b/i,
    /\bgla45\b/i,
    /\bc63\b/i,
    /\be63\b/i,
    /\bg63\b/i,
    /\bs63\b/i,
    /\bsl63\b/i,
    /\bamg\s*gt\b/i,
    /\bcls53\b/i,
    /\bcls63\b/i,
    /\be53\b/i,
    /\bg500\b/i,
  ],
  "Mercedes-Benz": [
    /\b190e\b/i,
    /\ba\s*-?\s*class\b/i,
    /\bc\s*-?\s*class\b/i,
    /\be\s*-?\s*class\b/i,
    /\bg\s*-?\s*class\b/i,
    /\bg-wagon\b/i,
    /\bcla\s*-?\s*class\b/i,
    /\bcls\s*-?\s*class\b/i,
    /\bglc\s*-?\s*class\b/i,
    /\bgle\s*-?\s*class\b/i,
    /\bs\s*-?\s*class\b/i,
    /\bsl\b/i,
    /\beqc\b/i,
    /\bcla\b/i,
    /\bcls\b/i,
    /\bglc\b/i,
    /\bgle\b/i,
    /\bgla\b/i,
    /\bgls\b/i,
    /\ba\s*45\b/i,
    /\bcla\s*45\b/i,
    /\bgla\s*45\b/i,
    /\bc\s*63\b/i,
    /\be\s*63\b/i,
    /\bg\s*63\b/i,
    /\bs\s*63\b/i,
    /\bsl\s*63\b/i,
    /\bamg\s*gt\b/i,
    /\bcls\s*53\b/i,
    /\bcls\s*63\b/i,
    /\be\s*53\b/i,
    /\ba45\b/i,
    /\bcla45\b/i,
    /\bgla45\b/i,
    /\bc63\b/i,
    /\be63\b/i,
    /\bg63\b/i,
    /\bs63\b/i,
    /\bsl63\b/i,
    /\bcls53\b/i,
    /\bcls63\b/i,
    /\be53\b/i,
    /\bsprinter\b/i,
    /\bvito\b/i,
    /\bv\s*-?\s*class\b/i,
    /\bclk\b/i,
    /\bslk\b/i,
    /\bsls\b/i,
    /\bm\s*-?\s*class\b/i,
    /\bml\b/i,
    /\bglk\b/i,
    /\bglk\s*-?\s*class\b/i,
    /\bglb\b/i,
    /\bglb\s*-?\s*class\b/i,
    /\bcl\b/i,
    /\bcl\s*-?\s*class\b/i,
    /\bslc\b/i,
    /\bslc\s*-?\s*class\b/i,
    /\bc\s*43\b/i,
    /\bc43\b/i,
    /\bc\s*450\b/i,
    /\bc450\b/i,
  ],
  Ferrari: [
    /\b296\b/i,
    /\b360\b/i,
    /\b458\b/i,
    /\b488\b/i,
    /\b812\b/i,
    /\bf12\b/i,
    /\bf355\b/i,
    /\bf430\b/i,
    /\bf8\b/i,
    /\bff\b/i,
    /\bgtc4lusso\b/i,
    /\bportofino\b/i,
    /\bpurosangue\b/i,
    /\broma\b/i,
  ],
  Lamborghini: [/\bhuracan\b/i, /\bhuracán\b/i, /\baventador\b/i, /\burus\b/i],
  McLaren: [
    /\b540c\b/i,
    /\b570s\b/i,
    /\b570gt\b/i,
    /\b600lt\b/i,
    /\b650s\b/i,
    /\b675lt\b/i,
    /\b720s\b/i,
    /\b750s\b/i,
    /\b765lt\b/i,
    /\bartura\b/i,
    /\bsenna\b/i,
    /\bp1\b/i,
    /\bgt\b/i,
    /\bgts\b/i,
  ],
  Maserati: [/\bghibli\b/i, /\bgranturismo\b/i, /\blevante\b/i, /\bquattroporte\b/i],
  Lexus: [/\bgx\b/i, /\blx\b/i, /\bis\b/i, /\blc\b/i, /\brc\b/i, /\bls\b/i, /\brx\b/i, /\bnx\b/i],
  Subaru: [
    /\bbrz\b/i,
    /\bforester\b/i,
    /\bimpreza\b/i,
    /\blegacy\b/i,
    /\boutback\b/i,
    /\bsti\b/i,
    /\bwrx\b/i,
  ],
  Honda: [/\bcivic\b/i, /\bs2000\b/i],
  Nissan: [
    /\b350z\b/i,
    /\b370z\b/i,
    /\bfrontier\b/i,
    /\bgt-r\b/i,
    /\bgtr\b/i,
    /\bpathfinder\b/i,
    /\b400z\b/i,
    /\btitan\b/i,
    /\bxterra\b/i,
    /\barmada\b/i,
    /\bpatrol\b/i,
    /\brogue\b/i,
    /\bnavara\b/i,
    /\bnote\b/i,
    /\balmera\b/i,
    /\bprimera\b/i,
    /\bqashqai\b/i,
    /\bjuke\b/i,
    /\bleaf\b/i,
    /\bz\b/i,
  ],
  Chevrolet: [/\bcamaro\b/i, /\bcorvette\b/i, /\bsilverado\b/i, /\bsierra\b/i],
  Ford: [
    /\bbronco\b/i,
    /\braptor\b/i,
    /\bfiesta\b/i,
    /\bfocus\b/i,
    /\bgt\b/i,
    /\bmustang\b/i,
    /\branger\b/i,
    /\bmaverick\b/i,
    /\bmondeo\b/i,
    /\beverest\b/i,
    /\bf\s*-?\s*150\b/i,
    /\bf\s*-?\s*250\b/i,
    /\bf\s*-?\s*350\b/i,
    /\bsuper\s*duty\b/i,
    /\bexplorer\b/i,
    /\btransit\b/i,
    /\bkuga\b/i,
    /\bpuma\b/i,
  ],
  Tesla: [/\bmodel\s*3\b/i, /\bmodel\s*y\b/i, /\bmodel\s*s\b/i, /\bmodel\s*x\b/i],
  Porsche: [
    /\bgt3\s*rs\b/i,
    /\bgt3\b/i,
    /\bgt4\s*rs\b/i,
    /\bgt4\b/i,
    /\bgt2\s*rs\b/i,
    /\bgt2\b/i,
    /\bcarrera\s*s?\b/i,
    /\bgts\b/i,
    /\bturbo\s*s?\b/i,
    /\b928\b/i,
    /\b944\b/i,
    /\b968\b/i,
    /\bboxster\b/i,
    /\bcayman\b/i,
    /\b911\b/i,
    /\b718\b/i,
    /\bmacan\b/i,
    /\bcayenne\b/i,
    /\bpanamera\b/i,
    /\btaycan\b/i,
  ],
  BMW: [
    /\bm2c\b/i,
    /\bm2\b/i,
    /\bm3\b/i,
    /\bm4\b/i,
    /\bm5\b/i,
    /\bm8\b/i,
    /\bx3\s*m\b/i,
    /\bx4\s*m\b/i,
    /\bx5\s*m\b/i,
    /\bx6\s*m\b/i,
    /\bm135i\b/i,
    /\bm140i\b/i,
    /\bm235i\b/i,
    /\bm240i\b/i,
    /\bm340i\b/i,
    /\bm340d\b/i,
    /\bm440i\b/i,
    /\bm440d\b/i,
    /\bm550i\b/i,
    /\bm850i\b/i,
    /\bz4\b/i,
    /\bx1\b/i,
    /\bx2\b/i,
    /\bx3\b/i,
    /\bx4\b/i,
    /\bx5\b/i,
    /\bx6\b/i,
    /\bx7\b/i,
    /\b1\s*-?\s*series\b/i,
    /\b2\s*-?\s*series\b/i,
    /\b3\s*-?\s*series\b/i,
    /\b4\s*-?\s*series\b/i,
    /\b5\s*-?\s*series\b/i,
    /\b6\s*-?\s*series\b/i,
    /\b7\s*-?\s*series\b/i,
    /\b8\s*-?\s*series\b/i,
    /\b1er\b/i,
    /\b2er\b/i,
    /\b3er\b/i,
    /\b4er\b/i,
    /\b5er\b/i,
    /\b6er\b/i,
    /\b7er\b/i,
    /\b8er\b/i,
  ],
  Audi: [
    /\brs3\b/i,
    /\brs4\b/i,
    /\brs5\b/i,
    /\brs6\b/i,
    /\brs7\b/i,
    /\bs3\b/i,
    /\bs4\b/i,
    /\bs5\b/i,
    /\bs6\b/i,
    /\bs7\b/i,
    /\ba3\b/i,
    /\ba4\b/i,
    /\ba5\b/i,
    /\ba6\b/i,
    /\ba7\b/i,
    /\btt\s*rs\b/i,
    /\btt\s*s\b/i,
    /\btt\b/i,
    /\bq3\b/i,
    /\bq5\b/i,
    /\bq7\b/i,
    /\bq8\b/i,
    /\brsq3\b/i,
    /\brsq8\b/i,
    /\brs\s*q8\b/i,
    /\bsq5\b/i,
    /\bsq7\b/i,
    /\bsq8\b/i,
  ],
  Volkswagen: [
    /\bgolf\s*gti\b/i,
    /\bgolf\s*r\b/i,
    /\bgolf\b/i,
    /\bgti\b/i,
    /\bjetta\b/i,
    /\btaos\b/i,
    /\btiguan\b/i,
    /\bscirocco\b/i,
    /\bpolo\b/i,
    /\bpassat\b/i,
    /\barteon\b/i,
    /\btouareg\b/i,
    /\btransporter\b/i,
    /\bt6\.?1?\b/i,
    /\bamarok\b/i,
    /\bcaddy\b/i,
    /\bgl[id]\b/i,
    /\br\b/i,
  ],
  Toyota: [
    /\bsupra\b/i,
    /\bgr\s*yaris\b/i,
    /\bgr\s*corolla\b/i,
    /\bgr86\b/i,
    /\bgt86\b/i,
    /\bhighlander\b/i,
    /\bcrown\b/i,
    /\bvellfire\b/i,
    /\bhilux\b/i,
    /\byaris\b/i,
    /\bcorolla\b/i,
    /\brav4\b/i,
    /\bcamry\b/i,
    /\bprius\b/i,
    /\btacoma\b/i,
    /\btundra\b/i,
    /\b4runner\b/i,
    /\bsequoia\b/i,
    /\bland\s+cruiser\b/i,
  ],
  Lotus: [/\belise\b/i, /\bexige\b/i, /\bemira\b/i, /\bevora\b/i],
  Volvo: [
    /\bc30\b/i,
    /\bc70\b/i,
    /\bs40\b/i,
    /\bv40\b/i,
    /\bv50\b/i,
    /\bs60\b/i,
    /\bv60\b/i,
    /\bxc60\b/i,
    /\bv70\b/i,
    /\bxc70\b/i,
    /\bs80\b/i,
    /\bs90\b/i,
    /\bv90\b/i,
    /\bxc90\b/i,
    /\b740\b/i,
    /\b940\b/i,
    /\b850\b/i,
  ],
  Opel: [
    /\binsignia\b/i,
    /\bastra\b/i,
    /\bvectra\b/i,
    /\bcalibra\b/i,
    /\bmovano\b/i,
    /\bcorsa\b/i,
    /\bmokka\b/i,
    /\bzafira\b/i,
    /\badam\b/i,
    /\bgrandland\b/i,
  ],
  SEAT: [/\bleon\b/i, /\bibiza\b/i, /\bateca\b/i, /\barona\b/i, /\baltea\b/i],
  "Land Rover": [/\bdefender\b/i, /\bdiscovery\b/i, /\bfreelander\b/i],
  "Range Rover": [
    /\bevoque\b/i,
    /\bvelar\b/i,
    /\bsport\b/i,
    /\bvogue\b/i,
    /\bl460\b/i,
    /\bl405\b/i,
    /\bl494\b/i,
  ],
  Suzuki: [/\bjimny\b/i, /\bswift\b/i, /\bvitara\b/i, /\bignis\b/i, /\bgrand\s+vitara\b/i],
  Isuzu: [/\bd-max\b/i],
  Skoda: [
    /\bsuperb\b/i,
    /\boctavia\b/i,
    /\bfabia\b/i,
    /\brapid\b/i,
    /\byeti\b/i,
    /\broomster\b/i,
    /\bscala\b/i,
    /\bkodiaq\b/i,
    /\bkaroq\b/i,
    /\bkamiq\b/i,
  ],
  Peugeot: [
    /\b208\b/i,
    /\b308\b/i,
    /\b508\b/i,
    /\b2008\b/i,
    /\b3008\b/i,
    /\b5008\b/i,
    /\bpartner\b/i,
    /\bexpert\b/i,
    /\bboxer\b/i,
    /\b307\b/i,
    /\b107\b/i,
    /\b108\b/i,
    /\b206\b/i,
    /\b207\b/i,
    /\b301\b/i,
    /\b306\b/i,
    /\b407\b/i,
    /\b4007\b/i,
    /\b4008\b/i,
  ],
  Dacia: [/\blogan\b/i, /\bduster\b/i, /\bsandero\b/i, /\blodgy\b/i, /\bdokker\b/i],
  Lancia: [
    /\bypsilon\b/i,
    /\bdelta\b/i,
    /\bphedra\b/i,
    /\bvoyager\b/i,
    /\bthema\b/i,
    /\blybra\b/i,
    /\bthesis\b/i,
    /\bmusa\b/i,
    /\bkappa\b/i,
  ],
  Fiat: [
    /\bscudo\b/i,
    /\bfreemont\b/i,
    /\bbravo\b/i,
    /\bpalio\b/i,
    /\btipo\b/i,
    /\bpunto\b/i,
    /\bdoblo\b/i,
    /\bducato\b/i,
    /\b500\b/i,
    /\bidea\b/i,
    /\bviaggio\b/i,
    /\bsedici\b/i,
    /\bpanda\b/i,
    /\bfiorino\b/i,
    /\b124\s*spider\b/i,
    /\bmarea\b/i,
    /\bcroma\b/i,
  ],
  Smart: [/\bfortwo\b/i, /\bforfour\b/i, /#\s*1\b/i, /#\s*3\b/i],
  Daewoo: [/\blacetti\b/i],
  Tata: [/\bindica\b/i, /\bsumo\b/i, /\bingo\b/i, /\bindigo\b/i, /\bsafari\b/i, /\bxenon\b/i],
  SsangYong: [
    /\bkyron\b/i,
    /\bactyon\b/i,
    /\brodius\b/i,
    /\bkorando\b/i,
    /\brexton\b/i,
    /\bstavic\b/i,
  ],
  GMC: [/\bsierra\b/i, /\bcanyon\b/i],
  Cupra: [/\bformentor\b/i, /\bleon\b/i, /\bateca\b/i, /\bborn\b/i],
  Kia: [
    /\bk5\b/i,
    /\bstinger\b/i,
    /\bceed\b/i,
    /\bsportage\b/i,
    /\bsorento\b/i,
    /\brio\b/i,
    /\bcerato\b/i,
    /\boptima\b/i,
    /\bproceed\b/i,
  ],
  Hyundai: [
    /\elantra\s*n\b/i,
    /\bgenesis\b/i,
    /\bioniq\s*5\s*n\b/i,
    /\bveloster\s*n\b/i,
    /\bi30\s*n\b/i,
    /\bi30\b/i,
    /\btucson\b/i,
    /\bsanta\s*fe\b/i,
    /\bkona\b/i,
  ],
  "Alfa Romeo": [/\bgiulia\b/i, /\bstelvio\b/i, /\bgiulietta\b/i, /\bmito\b/i],
  Mitsubishi: [/\blancer\s+evolution\b/i, /\bevo\b/i, /\bevo\s+x\b/i, /\basx\b/i, /\boutlander\b/i],
  Renault: [
    /\bclio\b/i,
    /\bmegane\b/i,
    /\bscenic\b/i,
    /\bcaptur\b/i,
    /\bkoleos\b/i,
    /\btalisman\b/i,
    /\bespace\b/i,
    /\bvel\s*satis\b/i,
    /\blaguna\b/i,
    /\btwingo\b/i,
    /\bkangoo\b/i,
    /\bmaster\b/i,
    /\btraffic\b/i,
    /\btrafic\b/i,
  ],
  Citroen: [
    /\bc1\b/i,
    /\bc2\b/i,
    /\bc3\b/i,
    /\bc4\b/i,
    /\bc5\b/i,
    /\bc8\b/i,
    /\bds3\b/i,
    /\bds4\b/i,
    /\bberlingo\b/i,
    /\bjumper\b/i,
    /\bnemo\b/i,
    /\bsaxo\b/i,
    /\bxsara\b/i,
  ],
  Jaguar: [
    /\be\s*-?\s*pace\b/i,
    /\bf\s*-?\s*pace\b/i,
    /\bi\s*-?\s*pace\b/i,
    /\bxe\b/i,
    /\bxf\b/i,
    /\bx\s*-?\s*type\b/i,
    /\bf\s*-?\s*type\b/i,
    /\bxj\b/i,
    /\bxk\b/i,
  ],
  "Rolls-Royce": [/\bcullinan\b/i, /\bghost\b/i, /\bwraith\b/i, /\bphantom\b/i, /\bdawn\b/i],
  Bentley: [/\bcontinental\s*gtc?\b/i, /\bbentayga\b/i, /\bflying\s*spur\b/i, /\bmulsanne\b/i],
  Saab: [/\b9-3\b/i, /\b9-5\b/i, /\b900\b/i, /\b9000\b/i],
  DS: [/\bds3\b/i, /\bds5\b/i, /\bds7\b/i, /\bds\s*3\s*crossback\b/i, /\bds\s*7\s*crossback\b/i],
  Chrysler: [/\bgrand\s+voyager\b/i, /\b300\s*c\b/i, /\bcrossfire\b/i],
  Acura: [/\brsx\b/i, /\bnsx\b/i, /\bintegra\b/i, /\btlx\b/i, /\bmdx\b/i],
  Alpine: [/\ba110\s*s?\b/i, /\ba110gt\b/i],
  INEOS: [/\bgrenadier\b/i],
  Buick: [/\benvista\b/i, /\bregal\b/i, /\benclave\b/i],
  Iveco: [/\bmassif\b/i, /\bdaily\b/i],
  Abarth: [
    /\b500\b/i,
    /\b595\b/i,
    /\b695\b/i,
    /\b124\s*spider\b/i,
    /\bpunto\b/i,
    /\bgrande\s+punto\b/i,
  ],
  Ducati: [
    /\bdiavel\b/i,
    /\bpanigale\b/i,
    /\bstreetfighter\b/i,
    /\bmultistrada\b/i,
    /\bmonster\b/i,
    /\bdesertx\b/i,
    /\bsupersport\b/i,
    /\bscrambler\b/i,
    /\bhypermotard\b/i,
  ],
};

function detectModelsFromText(text: string, make: string | null): string[] {
  if (!make) return [];
  const normalizedMake = make === "VW" ? "Volkswagen" : make;
  const patterns = MODEL_PATTERNS[normalizedMake];
  if (!patterns) return [];

  const found: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      found.push(match[0].toLowerCase());
    }
  }
  return found;
}

export function porsche911SubmodelsCompatible(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.includes("911") && y.includes("911")) {
    const gt3A = x.includes("gt3");
    const gt3B = y.includes("gt3");
    const turboA = x.includes("turbo");
    const turboB = y.includes("turbo");
    const carreraA = x.includes("carrera");
    const carreraB = y.includes("carrera");

    if (gt3A && (turboB || carreraB)) return false;
    if (turboA && (gt3B || carreraB)) return false;
    if (carreraA && (gt3B || turboB)) return false;
  }
  return true;
}

/**
 * Extract fitment from any product, delegating to the brand-specific
 * extractor when available and falling back to generic detection.
 */
function cleanAndSplitModel(model: string): string[] {
  let initial = model.toLowerCase();

  // Remove brand prefixes
  const brandPipeIndex = initial.indexOf("|");
  if (brandPipeIndex !== -1) {
    initial = initial.slice(brandPipeIndex + 1);
  }
  const brandColonIndex = initial.indexOf(":");
  if (brandColonIndex !== -1) {
    initial = initial.slice(brandColonIndex + 1);
  }

  // Strip parentheses and asterisks BEFORE splitting
  initial = initial.replace(/\([^)]*\)/g, " ");
  initial = initial.replace(/\*[^*]*\*/g, " ");

  // Now split by slash, pipe, or the word 'or'
  const parts = initial.split(/\s*[\/|]\s*|\s+\bor\b\s+/i);
  const results: string[] = [];

  for (const part of parts) {
    let cleaned = part;

    // Strip engine sizes, generation codes, fuel types
    cleaned = cleaned
      .replace(/\b\d+\.\d+\s*[lt]?\b/g, " ") // 3.0, 3.0l, 3.0 l, 2.0
      .replace(/\b\d+[t]\b/g, " ") // 3.0t, 2.0t, 4.0t
      .replace(/\b[l]\d+\b/g, " ") // l4
      .replace(
        /\b(?:turbo\s+diesel|diesel|turbo|super\s+duty|cat\s+pipe\s+only|4matic|2wd|awd|rwd|fwd)\b/g,
        " "
      )
      .replace(/\b(?:v6|v8|v10|v12)\b/g, " ");

    cleaned = stripYearNoise(cleaned);

    cleaned = cleaned
      .replace(/\b(?:only|also|bodykit|with|generation|gen|spec|version)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned && cleaned.length > 1 && cleaned !== "other") {
      results.push(cleaned);
    }
  }

  return results;
}

function inferModelFromChassis(make: string, chassis: string): string | null {
  const upper = chassis.toUpperCase();
  if (make === "BMW") {
    if (["E81", "E82", "E87", "E88", "F20", "F21", "F40"].includes(upper)) return "1 Series";
    if (["F22", "F23", "G42"].includes(upper)) return "2 Series";
    if (
      ["E36", "E46", "E90", "E91", "E92", "E93", "F30", "F31", "F34", "G20", "G21"].includes(upper)
    )
      return "3 Series";
    if (["F32", "F33", "F36", "G22", "G23", "G26"].includes(upper)) return "4 Series";
    if (["E34", "E39", "E60", "F10", "G30", "G31"].includes(upper)) return "5 Series";
    if (["E63", "E64", "F06", "F12", "F13", "G32"].includes(upper)) return "6 Series";
    if (["G11", "G12", "G70"].includes(upper)) return "7 Series";
    if (["G14", "G15", "G16"].includes(upper)) return "8 Series";
    if (upper === "F97") return "X3 M";
    if (upper === "F98") return "X4 M";
    if (upper === "F95") return "X5 M";
    if (upper === "F96") return "X6 M";
    if (["G01", "G08"].includes(upper)) return "X3";
    if (upper === "G02") return "X4";
    if (upper === "G05") return "X5";
    if (upper === "G06") return "X6";
    if (upper === "G07") return "X7";
    if (upper === "G29") return "Z4";
    if (upper === "G09") return "Xm";
    if (["F87", "F87N", "G87"].includes(upper)) return "M2";
    if (["F80", "G80", "G81"].includes(upper)) return "M3";
    if (["F82", "F83", "G82", "G83"].includes(upper)) return "M4";
    if (["F90", "G90"].includes(upper)) return "M5";
    if (["F91", "F92", "F93"].includes(upper)) return "M8";
  } else if (make === "Porsche") {
    if (
      [
        "991",
        "991.1",
        "991.2",
        "992",
        "992.1",
        "992.2",
        "996",
        "997",
        "997.1",
        "997.2",
        "930",
        "964",
        "993",
      ].includes(upper)
    )
      return "911";
    if (["718", "981", "982", "987", "986"].includes(upper)) return "718 Boxster/Cayman";
    if (["955", "957", "958", "E3", "9YA", "9Y0", "9YB", "9PA"].includes(upper)) return "Cayenne";
    if (["95B", "95B.1", "95B.2", "536"].includes(upper)) return "Macan";
    if (["970", "971", "972"].includes(upper)) return "Panamera";
    if (upper === "J1") return "Taycan";
  } else if (make === "Audi") {
    if (["8V", "8Y"].includes(upper)) return "A3";
    if (["B5", "B7", "B8", "B9"].includes(upper)) return "A4";
    if (["8T", "F5"].includes(upper)) return "A5";
    if (["C5", "C6", "C7", "C8"].includes(upper)) return "A6";
    if (upper === "4M") return "Q7";
    if (upper === "F1") return "Q8";
    if (["8J", "8S"].includes(upper)) return "TT";
  } else if (make === "Mercedes-Benz" || make === "Mercedes-AMG") {
    if (["W176", "W177"].includes(upper)) return "A-Class";
    if (["W202", "W203", "W204", "W205", "W206"].includes(upper)) return "C-Class";
    if (["W210", "W211", "W212", "W213", "W214"].includes(upper)) return "E-Class";
    if (["W220", "W221", "W222", "W223"].includes(upper)) return "S-Class";
    if (["C117", "C118", "X117", "X118"].includes(upper)) return "CLA";
    if (["C218", "C257", "W218", "W219"].includes(upper)) return "CLS";
    if (["X253", "C253", "X254"].includes(upper)) return "GLC";
    if (["W166", "W167", "C167"].includes(upper)) return "GLE";
    if (["X156", "H247"].includes(upper)) return "GLA";
    if (["X166", "X167"].includes(upper)) return "GLS";
    if (["R230", "R231", "R232"].includes(upper)) return "SL";
    if (["W463", "W463A", "W464", "W465"].includes(upper)) return "G-Class";
    if (["W901", "W902", "W903", "W904", "W905", "W906", "W907"].includes(upper)) return "Sprinter";
    if (["W638", "W639"].includes(upper)) return "Vito";
    if (upper === "W447") return "V-Class";
    if (["A209", "C209"].includes(upper)) return "CLK";
    if (["R170", "R171", "R172"].includes(upper)) return "SLK";
    if (["W163", "W164"].includes(upper)) return "M-Class";
    if (upper === "X204") return "GLK";
    if (upper === "X247") return "GLB";
    if (["C215", "C216"].includes(upper)) return "CL";
    if (upper === "C197") return "SLS";
  }
  return null;
}

const EXPECTED_CHASSIS_BY_MAKE_MODEL: Record<string, Record<string, string[]>> = {
  BMW: {
    "1 Series": ["E81", "E82", "E87", "E88", "F20", "F21", "F40"],
    "2 Series": ["F22", "F23", "G42"],
    "3 Series": ["E36", "E46", "E90", "E91", "E92", "E93", "F30", "F31", "F34", "G20", "G21"],
    "4 Series": ["F32", "F33", "F36", "G22", "G23", "G26"],
    "5 Series": ["E34", "E39", "E60", "F10", "G30", "G31"],
    "6 Series": ["E63", "E64", "F06", "F12", "F13", "G32"],
    "7 Series": ["G11", "G12", "G70"],
    "8 Series": ["G14", "G15", "G16"],
    M2: ["F87", "F87N", "G87"],
    M3: ["E36", "E46", "E90", "E92", "E93", "F80", "G80", "G81"],
    M4: ["F82", "F83", "G82", "G83"],
    M5: ["E28", "E34", "E39", "E60", "F10", "F90", "G90"],
    M6: ["E63", "E64", "F06", "F12", "F13"],
    M8: ["F91", "F92", "F93"],
    "M135i/M140i": ["F20", "F21", "F40"],
    "M235i/M240i": ["F22", "F23", "G42"],
    "M340i/M340d": ["G20", "G21"],
    "M440i/M440d": ["G22", "G23"],
    M550i: ["G30"],
    M850i: ["G14", "G15", "G16"],
    Z4: ["G29"],
    X1: ["E84", "F48", "U11"],
    X2: ["F39", "U10"],
    X3: ["G01", "G08"],
    X4: ["G02"],
    X5: ["G05"],
    X6: ["G06"],
    X7: ["G07"],
    "X3 M": ["F97"],
    "X4 M": ["F98"],
    "X5 M": ["F95"],
    "X6 M": ["F96"],
    Xm: ["G09"],
  },
  Porsche: {
    "911": ["930", "964", "993", "996", "997", "991", "991.1", "991.2", "992", "992.1", "992.2"],
    "718 Boxster/Cayman": ["718", "981", "982", "987", "986"],
    Cayenne: ["955", "957", "958", "E3", "9YA", "9Y0", "9YB", "9PA"],
    Macan: ["95B", "95B.1", "95B.2", "536"],
    Panamera: ["970", "971", "972"],
    Taycan: ["J1"],
    GT4: ["718", "981", "982"],
    GT4RS: ["718", "982"],
    "914-6": ["914"],
  },
  Audi: {
    A3: ["8P", "8V", "8V.1", "8V.2", "8Y", "8Y.1", "8Y.2"],
    S3: ["8V", "8Y"],
    RS3: ["8V", "8V.1", "8V.2", "8Y", "8Y.1", "8Y.2"],
    A4: ["B5", "B6", "B7", "B8", "B8.5", "B9", "B9.5"],
    S4: ["B5", "B6", "B7", "B8", "B8.5", "B9", "B9.5"],
    RS4: ["B5", "B7", "B8", "B9", "B9.5"],
    A5: ["8T", "F5", "B8", "B8.5", "B9", "B9.5"],
    S5: ["8T", "F5", "B8", "B8.5", "B9", "B9.5"],
    RS5: ["8T", "F5", "B8", "B9", "B9.5"],
    A6: ["C5", "C6", "C7", "C8"],
    S6: ["C6", "C7", "C8"],
    RS6: ["C5", "C6", "C7", "C8"],
    A7: ["4G", "4K", "C7", "C8"],
    S7: ["4G", "4K", "C7", "C8"],
    RS7: ["4G", "4K", "C7", "C8"],
    TT: ["8J", "8S"],
    TTS: ["8J", "8S"],
    "TT-RS": ["8J", "8S"],
    Q3: ["8U", "F3"],
    RSQ3: ["8U", "F3"],
    "RS Q3": ["8U", "F3"],
    Q5: ["8R", "FY"],
    SQ5: ["8R", "FY"],
    Q7: ["4M"],
    SQ7: ["4M"],
    Q8: ["4M", "F1"],
    SQ8: ["4M", "F1"],
    RSQ8: ["4M", "F1"],
    "RS Q8": ["4M", "F1"],
  },
  "Mercedes-Benz": {
    "A-Class": ["W176", "W177", "W247"],
    A45: ["W176", "W177"],
    "CLA-Class": ["C117", "X117", "C118", "X118"],
    "G-Class": ["W463", "W463A", "W464", "W465"],
    "G-Wagon": ["W463", "W463A", "W465"],
    "GLC-Class": ["X253", "C253", "X254"],
    "GLE-Class": ["W166", "W167", "C167"],
    GLS: ["X166", "X167"],
    "S-Class": ["W220", "W221", "W222", "W223"],
    "C-Class": ["W202", "W203", "W204", "W205", "W206"],
    "E-Class": ["W210", "W211", "W212", "W213", "W214"],
    SL: ["R230", "R231", "R232"],
    SLK: ["R170", "R171", "R172"],
    "AMG GT": ["C190"],
    "190e": ["W201"],
  },
  "Mercedes-AMG": {
    A45: ["W176", "W177"],
    CLA45: ["C117", "X117", "C118", "X118"],
    G500: ["W463", "W463A", "W464", "W465"],
    G63: ["W463", "W463A", "W465"],
    S63: ["W221", "W222", "W223"],
    C63: ["W204", "C204", "S204", "W205", "C205", "S205", "A205", "W206", "S206"],
    E53: ["W213", "S213", "W167", "C167"],
    E63: ["W211", "S211", "W212", "S212", "W213", "S213"],
    "AMG GT": ["C190", "C192", "X290"],
  },
  "Land Rover": {
    Defender: ["L663"],
  },
  "Range Rover": {
    Sport: ["L494", "L461"],
    Vogue: ["L405", "L460"],
    L405: ["L405"],
    L460: ["L460"],
    L494: ["L494"],
  },
  Toyota: {
    "GR Supra": ["A90", "A91", "JZA90"],
    GT86: ["ZN6"],
    GR86: ["ZN8"],
    "GR Yaris": ["GXPA16"],
    "GR Corolla": ["GZEA14", "E210"],
  },
  Subaru: {
    brz: ["ZC6", "ZD8"],
    BRZ: ["ZC6", "ZD8"],
    wrx: ["VA", "VB"],
    sti: ["VA", "VAB"],
  },
  Nissan: {
    "gt-r": ["R35"],
    GTR: ["R35"],
    "skyline gt-r": ["R32", "R33", "R34"],
    "350z": ["Z33"],
    "370z": ["Z34"],
    "rz34 400z": ["RZ34"],
    Note: [],
  },
  Honda: {
    civic: ["FK8", "FL5"],
    "civic type r": ["FK8", "FL5"],
    "civic si": ["FE1"],
  },
  Volkswagen: {
    Golf: ["MK7", "MK7.5", "MK8", "MQB"],
    GTI: ["MK7", "MK7.5", "MK8", "MQB"],
    Arteon: ["MQB"],
    Passat: ["MQB"],
    Tiguan: ["MQB"],
  },
  Mini: {
    Cooper: ["R56", "R57", "R58", "R59", "F54", "F55", "F56", "F57", "F60"],
  },
};

function normalizeFitmentKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getExpectedChassisForMakeModel(make: string, model: string): string[] | null {
  const makeEntry =
    EXPECTED_CHASSIS_BY_MAKE_MODEL[make] ??
    EXPECTED_CHASSIS_BY_MAKE_MODEL[
      Object.keys(EXPECTED_CHASSIS_BY_MAKE_MODEL).find(
        (key) => normalizeFitmentKey(key) === normalizeFitmentKey(make)
      ) ?? ""
    ];
  if (!makeEntry) return null;

  const modelKey = Object.keys(makeEntry).find(
    (key) => normalizeFitmentKey(key) === normalizeFitmentKey(model)
  );
  return modelKey ? makeEntry[modelKey] : null;
}

export function isExpectedChassisForMakeModel(
  make: string,
  model: string,
  chassis: string
): boolean {
  const expected = getExpectedChassisForMakeModel(make, model);
  if (!expected) return true;
  const normalizedChassis = chassis.trim().toUpperCase();
  return expected.some((code) => code.toUpperCase() === normalizedChassis);
}

/**
 * Extract fitment from any product, delegating to the brand-specific
 * extractor when available and falling back to generic detection.
 */
export function extractProductFitment(product: ShopProduct): Fitment {
  const text = buildSearchText(product);
  const brand = String(product.brand ?? "")
    .trim()
    .toLowerCase();

  let make: string | null = null;
  let models: string[] = [];
  let chassis: string[] = [];

  // 1. Brand-specific extractor first (most accurate)
  if (isAdroProduct(product)) {
    const adroMakes = detectAdroMakes(product).filter((m) => m && m !== "Other");
    make = adroMakes[0] ?? null;
    models = detectAdroModels(product).filter((m) => m && m !== "Other");
  } else if (brand.includes("csf")) {
    const fitment = extractCsfCatalogFitment(product);
    make = fitment.make;
    models = fitment.models;
    chassis = fitment.chassisCodes;
  } else if (brand.includes("ohlins") || brand.includes("öhlins")) {
    make = detectOhlinsMake(product);
  } else if (brand === "akrapovic" || brand === "akrapovič") {
    const tokenBrand = extractVehicleBrand(product.title?.en ?? "");
    make = tokenBrand;
    if (tokenBrand) {
      const modelNames = extractVehicleModelNamesForBrand(product.title?.en ?? "", tokenBrand);
      if (modelNames.length > 0) {
        models = modelNames;
      } else {
        const tokenModel = extractVehicleModel(product.title?.en ?? "");
        if (tokenModel) models = [tokenModel];
      }
      const chassisCodes = extractVehicleModelsForBrand(product.title?.en ?? "", tokenBrand);
      if (chassisCodes.length > 0) {
        chassis = chassisCodes;
      }
    } else {
      const tokenModel = extractVehicleModel(product.title?.en ?? "");
      if (tokenModel) models = [tokenModel];
    }
  } else if (brand.includes("ipe") || brand.includes("innotech")) {
    make = resolveIpeVehicleBrand(product);
    const ipeModel = resolveIpeVehicleModel(product);
    if (ipeModel) models = [ipeModel];
  } else if (brand.includes("girodisc")) {
    make = extractTagMake(product);
    models = extractTagModels(product);
  }

  // 2. Generic fallbacks for anything still missing
  if (!make) {
    make = extractTagMake(product);
    if (!make && product.brand) {
      const brandLower = product.brand.trim().toLowerCase();
      const match = MAKE_PATTERNS.find((entry) => entry.label.toLowerCase() === brandLower);
      if (match) make = match.label;
    }
    if (!make) {
      make = detectMakeGeneric(text);
    }
  }

  if (models.length === 0) {
    models = extractTagModels(product);
    if (models.length === 0) {
      models = detectModelsFromText(text, make);
    }
  }

  if (chassis.length === 0) {
    chassis = extractChassisFromText(text);
  }

  // Fallback 3: Infer make from unique chassis codes if make is still null
  if (!make && chassis.length > 0) {
    for (const c of chassis) {
      const upperC = c.toUpperCase();
      if (CHASSIS_TO_MAKE[upperC]) {
        make = CHASSIS_TO_MAKE[upperC];
        break;
      }
    }
  }

  let cleanMake: string | null = null;
  if (make) {
    const lowerMake = make.trim().toLowerCase();
    if (lowerMake === "vw" || lowerMake === "volkswagen") {
      cleanMake = "Volkswagen";
    } else if (lowerMake === "seat") {
      cleanMake = "SEAT";
    } else if (
      lowerMake === "mercedes" ||
      lowerMake === "mercedes benz" ||
      lowerMake === "mercedes-benz" ||
      lowerMake === "mercedes – benz"
    ) {
      cleanMake = "Mercedes-Benz";
    } else if (lowerMake === "mercedes-amg" || lowerMake === "amg") {
      cleanMake = "Mercedes-AMG";
    } else if (
      lowerMake === "land-rover" ||
      lowerMake === "land rover" ||
      lowerMake === "land – rover"
    ) {
      cleanMake = "Land Rover";
    } else if (
      lowerMake === "range-rover" ||
      lowerMake === "range rover" ||
      lowerMake === "range – rover"
    ) {
      cleanMake = "Range Rover";
    } else if (lowerMake.includes("alfa") && lowerMake.includes("romeo")) {
      cleanMake = "Alfa Romeo";
    } else if (lowerMake === "ds") {
      cleanMake = "DS";
    } else if (lowerMake === "volkswagen / audi" || lowerMake === "volkswagen/audi") {
      cleanMake = text.toLowerCase().includes("audi") ? "Audi" : "Volkswagen";
    } else if (lowerMake === "universal") {
      cleanMake = null;
    } else {
      // Capitalize first letter of each word
      cleanMake = make.trim().replace(/\b\w/g, (c) => c.toUpperCase());
      if (cleanMake.toLowerCase() === "ds") cleanMake = "DS";
      if (cleanMake.toLowerCase() === "bmw") cleanMake = "BMW";
      if (cleanMake.toLowerCase() === "vw") cleanMake = "Volkswagen";
      if (cleanMake.toLowerCase() === "seat") cleanMake = "SEAT";
      if (cleanMake.toLowerCase() === "gmc") cleanMake = "GMC";
      if (cleanMake.toLowerCase() === "ineos") cleanMake = "INEOS";
    }
  }

  // Filter chassis codes strictly using CHASSIS_BY_MAKE if cleanMake is known
  const finalChassis: string[] = [];
  const makeChassisSet = cleanMake ? CHASSIS_BY_MAKE[cleanMake] || new Set<string>() : null;

  const cleanedModels: string[] = [];
  for (const m of models) {
    cleanedModels.push(...cleanAndSplitModel(m));
  }

  const finalModels: string[] = [];
  for (const m of uniq(cleanedModels)) {
    const upperM = m.toUpperCase();

    // Check if it's a general chassis code
    if (CHASSIS_CODES.has(upperM)) {
      if (cleanMake) {
        if (makeChassisSet && makeChassisSet.has(upperM)) {
          finalChassis.push(upperM);
        } else {
          // If it is in CHASSIS_CODES but NOT a chassis code for this specific make
          // (e.g. G80 for Genesis), treat it as a model!
          finalModels.push(m);
        }
      } else {
        finalChassis.push(upperM);
      }
    } else {
      finalModels.push(m);
    }
  }

  // Also filter the directly extracted chassis codes
  for (const c of uniq(chassis)) {
    const upperC = c.toUpperCase();
    if (makeChassisSet) {
      if (makeChassisSet.has(upperC)) {
        finalChassis.push(upperC);
      }
    } else if (CHASSIS_CODES.has(upperC)) {
      finalChassis.push(upperC);
    }
  }

  let normalizedModels = uniq(finalModels);

  // If no models were explicitly extracted, but we have cleanMake and chassis codes, try to infer the model!
  if (normalizedModels.length === 0 && cleanMake && finalChassis.length > 0) {
    const inferred = new Set<string>();
    for (const c of finalChassis) {
      const inferredModel = inferModelFromChassis(cleanMake, c);
      if (inferredModel) {
        inferred.add(inferredModel);
      }
    }
    if (inferred.size > 0) {
      normalizedModels = Array.from(inferred);
    }
  }

  if (cleanMake === "BMW") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Filter out non-BMW cars
      if (["a90", "brz", "gr86", "gr supra", "supra", "yaris", "corolla"].includes(lower)) {
        continue;
      }

      // Filter out motorcycle noise/code fragments like b10e, x228, v111, etc.
      const isMotoNoise =
        /^[bmvx]\d{2,3}[a-z]?\d*$/i.test(lower) &&
        ![
          "m135i",
          "m140i",
          "m235i",
          "m240i",
          "m340i",
          "m340d",
          "m440i",
          "m440d",
          "m550i",
          "m850i",
        ].includes(lower);
      if (isMotoNoise || ["xdrive", "adventure", "rs"].includes(lower)) {
        continue;
      }

      // Map series and specific models
      if (lower === "1 series m") {
        mapped.add("1 Series M");
      } else if (lower.includes("1 series") || /^1\d{2}[id]?$/i.test(lower)) {
        mapped.add("1 Series");
      } else if (lower.includes("2 series") || /^2\d{2}[id]?$/i.test(lower)) {
        mapped.add("2 Series");
      } else if (lower.includes("3 series") || /^3\d{2}[id]?$/i.test(lower)) {
        mapped.add("3 Series");
      } else if (lower.includes("4 series") || /^4\d{2}[id]?$/i.test(lower)) {
        mapped.add("4 Series");
      } else if (lower.includes("5 series") || /^5\d{2}[id]?$/i.test(lower)) {
        mapped.add("5 Series");
      } else if (lower.includes("6 series") || /^6\d{2}[id]?$/i.test(lower)) {
        mapped.add("6 Series");
      } else if (lower.includes("7 series") || /^7\d{2}[id]?$/i.test(lower)) {
        mapped.add("7 Series");
      } else if (lower.includes("8 series") || /^8\d{2}[id]?$/i.test(lower)) {
        mapped.add("8 Series");
      } else if (["m135i", "m140i", "m135i/m140i"].includes(lower)) {
        mapped.add("M135i/M140i");
      } else if (["m235i", "m240i", "m235i/m240i"].includes(lower)) {
        mapped.add("M235i/M240i");
      } else if (["m340i", "m340d", "m340i/m340d", "m340i lci", "m340d lci"].includes(lower)) {
        mapped.add("M340i/M340d");
      } else if (["m440i", "m440d", "m440i/m440d"].includes(lower)) {
        mapped.add("M440i/M440d");
      } else if (lower === "m550i") {
        mapped.add("M550i");
      } else if (lower === "m850i") {
        mapped.add("M850i");
      } else if (["m2 competition", "m2c"].includes(lower)) {
        mapped.add("M2");
      } else if (lower === "m3 m4") {
        mapped.add("M3");
        mapped.add("M4");
      } else if (["x3 m40i", "x3m"].includes(lower)) {
        mapped.add("X3 M");
      } else if (lower === "x4m") {
        mapped.add("X4 M");
      } else if (["x5 m", "x5m", "x5m pre-lci"].includes(lower)) {
        mapped.add("X5 M");
      } else if (lower === "x6m") {
        mapped.add("X6 M");
      } else if (lower.startsWith("z4")) {
        mapped.add("Z4");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Porsche") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Skip generic submodel/trim words or helper noise
      if (
        [
          "gts",
          "rs",
          "spyder",
          "spyder rs",
          "4s",
          "4 gts",
          "gt3 rs",
          "gt4 rs",
          "911 aux",
          "gts f1 edition",
          "s4",
          "s5",
        ].includes(lower)
      ) {
        continue;
      }

      if (
        lower.includes("911") ||
        ["carrera", "carrera s", "gt3", "gt2", "turbo", "gt3rs"].some((s) => lower.includes(s))
      ) {
        mapped.add("911");
      } else if (
        lower.includes("718") ||
        lower.includes("boxster") ||
        lower.includes("cayman") ||
        lower.includes("spyder")
      ) {
        mapped.add("718 Boxster/Cayman");
      } else if (lower.includes("cayenne")) {
        mapped.add("Cayenne");
      } else if (lower.includes("macan")) {
        mapped.add("Macan");
      } else if (lower.includes("panamera")) {
        mapped.add("Panamera");
      } else if (lower.includes("taycan")) {
        mapped.add("Taycan");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Mercedes-AMG") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Skip noise words or chassis code noise
      if (["coupe", "w463a", "z117", "c118"].includes(lower)) {
        continue;
      }

      if (lower.includes("a45")) {
        mapped.add("A45");
      } else if (lower.includes("cla45")) {
        mapped.add("CLA45");
      } else if (lower.includes("gla45")) {
        mapped.add("GLA45");
      } else if (lower.includes("c63")) {
        mapped.add("C63");
      } else if (lower.includes("e63")) {
        mapped.add("E63");
      } else if (lower.includes("s63")) {
        mapped.add("S63");
      } else if (lower.includes("g63")) {
        mapped.add("G63");
      } else if (lower.includes("glc63")) {
        mapped.add("GLC63");
      } else if (lower.includes("gle63")) {
        mapped.add("GLE63");
      } else if (lower.includes("cls53")) {
        mapped.add("CLS53");
      } else if (lower.includes("cls63")) {
        mapped.add("CLS63");
      } else if (lower.includes("e53")) {
        mapped.add("E53");
      } else if (lower.includes("g500")) {
        mapped.add("G500");
      } else if (
        lower.includes("gt") ||
        lower.includes("gt43") ||
        lower.includes("gt50") ||
        lower.includes("gt53")
      ) {
        mapped.add("AMG GT");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Mercedes-Benz") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Normalize AMGs that crept into Benz:
      if (
        lower.includes("c63") ||
        lower.includes("e63") ||
        lower.includes("g63") ||
        lower.includes("cla45")
      ) {
        continue;
      }

      if (lower.includes("a250") || lower.includes("a-class")) {
        mapped.add("A-Class");
      } else if (
        lower.includes("cla250") ||
        lower.includes("cla35") ||
        lower.includes("cla-class")
      ) {
        mapped.add("CLA-Class");
      } else if (lower.includes("glc")) {
        mapped.add("GLC-Class");
      } else if (lower.includes("gle")) {
        mapped.add("GLE-Class");
      } else if (lower.includes("s450") || lower.includes("s-class")) {
        mapped.add("S-Class");
      } else if (lower === "sl") {
        mapped.add("SL");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Audi") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Skip generic noise
      if (["gts", "performance facelift", "sportback"].includes(lower)) {
        continue;
      }

      if (lower.includes("rs3")) {
        mapped.add("RS3");
      } else if (lower.includes("rs4")) {
        mapped.add("RS4");
      } else if (lower.includes("rs5")) {
        mapped.add("RS5");
      } else if (lower.includes("rs6")) {
        mapped.add("RS6");
      } else if (lower.includes("rs7")) {
        mapped.add("RS7");
      } else if (lower.includes("rs q8")) {
        mapped.add("RS Q8");
      } else if (lower.includes("sq7")) {
        mapped.add("SQ7");
      } else if (lower.includes("sq8")) {
        mapped.add("SQ8");
      } else if (lower.includes("s3")) {
        mapped.add("S3");
      } else if (lower.includes("s4")) {
        mapped.add("S4");
      } else if (lower.includes("s5")) {
        mapped.add("S5");
      } else if (lower.includes("s6")) {
        mapped.add("S6");
      } else if (lower.includes("s7")) {
        mapped.add("S7");
      } else if (lower.includes("a6")) {
        mapped.add("A6");
      } else if (lower.includes("a7")) {
        mapped.add("A7");
      } else if (lower.includes("a4") || lower.includes("b5 a4")) {
        mapped.add("A4");
      } else if (lower.includes("a5")) {
        mapped.add("A5");
      } else if (lower.includes("a3")) {
        mapped.add("A3");
      } else if (lower.includes("tt rs") || lower.includes("ttrs")) {
        mapped.add("TT-RS");
      } else if (lower.includes("tt s") || lower.includes("tts")) {
        mapped.add("TTS");
      } else if (lower === "tt") {
        mapped.add("TT");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Toyota") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Remove non-Toyota models
      if (["m340i", "m440i", "brz"].includes(lower)) {
        continue;
      }

      if (lower.includes("supra")) {
        mapped.add("GR Supra");
      } else if (lower.includes("landcruiser") || lower.includes("land cruiser")) {
        mapped.add("Land Cruiser");
      } else if (lower.includes("corolla")) {
        mapped.add("GR Corolla");
      } else if (lower.includes("yaris")) {
        mapped.add("GR Yaris");
      } else if (lower === "gr86" || lower === "gt86") {
        mapped.add(lower.toUpperCase());
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Volkswagen") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();

      // Remove platform noise
      if (["vag mqb"].includes(lower)) {
        continue;
      }

      if (lower.includes("golf")) {
        mapped.add("Golf");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Ferrari") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();
      if (["challenge", "challenge stradale", "gts", "pista", "spider"].includes(lower)) {
        continue;
      }
      if (lower.includes("296")) {
        mapped.add("296");
      } else if (lower.includes("488")) {
        mapped.add("488");
      } else if (lower.includes("812")) {
        mapped.add("812");
      } else if (lower.includes("f12")) {
        mapped.add("F12");
      } else if (lower.includes("f8")) {
        mapped.add("F8");
      } else if (lower.includes("458")) {
        mapped.add("458");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Lamborghini") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();
      if (["550", "560", "570"].includes(lower)) {
        continue;
      }
      if (lower.includes("huracan") || lower.includes("huracán")) {
        mapped.add("Huracán");
      } else if (lower.includes("aventador")) {
        mapped.add("Aventador");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Lexus") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();
      if (lower.startsWith("gx")) {
        mapped.add("GX");
      } else if (lower.startsWith("lx")) {
        mapped.add("LX");
      } else if (lower.startsWith("is")) {
        mapped.add("IS");
      } else if (lower.startsWith("lc")) {
        mapped.add("LC");
      } else if (lower.startsWith("rc")) {
        mapped.add("RC");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Chevrolet") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();
      if (lower.includes("corvette")) {
        mapped.add("Corvette");
      } else if (lower.includes("camaro")) {
        mapped.add("Camaro");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Ford") {
    const mapped = new Set<string>();
    for (const m of normalizedModels) {
      const lower = m.toLowerCase();
      if (lower.includes("f-150") || lower.includes("raptor")) {
        mapped.add("F-150 Raptor");
      } else if (lower.includes("mustang")) {
        mapped.add("Mustang");
      } else if (lower.includes("ranger")) {
        mapped.add("Ranger");
      } else {
        const clean = m.replace(/\b\w/g, (c) => c.toUpperCase());
        mapped.add(clean);
      }
    }
    normalizedModels = Array.from(mapped);
  } else if (cleanMake === "Mini") {
    normalizedModels = ["Cooper"];
  }

  // 3. Validation step: filter out any model that is NOT in the allowed list for this make (and apply canonical casing)
  if (cleanMake) {
    const allowed = VALID_MODELS_BY_MAKE[cleanMake];
    if (allowed) {
      normalizedModels = normalizedModels
        .map((m) => {
          for (const allowedVal of allowed) {
            if (allowedVal.toLowerCase() === m.toLowerCase()) {
              return allowedVal;
            }
          }
          return null;
        })
        .filter((m): m is string => m !== null);
    }
  }

  return {
    make: cleanMake,
    models: normalizedModels,
    chassisCodes: uniq(finalChassis.map((c) => c.toUpperCase()).filter(Boolean)),
  };
}

/* ── Cross-shop matching ──────────────────────────────────────── */

const SCORE_CHASSIS = 60;
const SCORE_MODEL_EXACT = 30;
const SCORE_MODEL_TOKEN = 18;
const SCORE_MAKE = 6;

/** Normalize a model label so "M3 (G80)" and "M3 G80" and "m3-g80" compare equal. */
function normalizeModelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()/]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coarse model token (e.g. "m3" from "m3 g80") for partial matches.
 *  Returns '' for tokens shorter than 3 chars OR pure year-style numbers,
 *  to avoid false matches like the "S" suffix in "Mercedes S-Class" hitting
 *  every "Porsche 911 S". */
function modelHeadToken(value: string): string {
  const normalized = normalizeModelKey(value);
  for (const token of normalized.split(" ").filter(Boolean)) {
    if (token.length < 3) continue;
    if (/^(19|20)\d{2}$/.test(token)) continue;
    if (token === "class" || token === "series") continue;
    return token;
  }
  return "";
}

/** Threshold beyond which a candidate is considered "fits-everything" — used
 *  to push generic catch-all parts below truly chassis-specific matches. */
const SPECIFICITY_THRESHOLD = 8;
const SPECIFICITY_PENALTY = 2;

export function areChassisCompatible(a: string, b: string): boolean {
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  if (x === y) return true;

  // MQB platform compatibility
  const isMqbA =
    x === "MQB" ||
    x === "MK7" ||
    x === "MK7.5" ||
    x === "MK8" ||
    x === "8V" ||
    x === "8Y" ||
    x === "8S";
  const isMqbB =
    y === "MQB" ||
    y === "MK7" ||
    y === "MK7.5" ||
    y === "MK8" ||
    y === "8V" ||
    y === "8Y" ||
    y === "8S";
  if (isMqbA && isMqbB) return true;

  // BMW F8X platform compatibility
  const isF8xA = x === "F80" || x === "F82" || x === "F83" || x === "F87" || x === "F8X";
  const isF8xB = y === "F80" || y === "F82" || y === "F83" || y === "F87" || y === "F8X";
  if (isF8xA && isF8xB) return true;

  // BMW G8X platform compatibility
  const isG8xA =
    x === "G80" || x === "G81" || x === "G82" || x === "G83" || x === "G87" || x === "G8X";
  const isG8xB =
    y === "G80" || y === "G81" || y === "G82" || y === "G83" || y === "G87" || y === "G8X";
  if (isG8xA && isG8xB) return true;

  // Porsche sub-generations
  if (x.startsWith(y) || y.startsWith(x)) return true;

  return false;
}

function scoreMatch(target: Fitment, candidate: Fitment): number {
  let score = 0;
  if (target.make && candidate.make && target.make === candidate.make) {
    score += SCORE_MAKE;
  }

  // Chassis match: add base score once if compatible, and a small bonus for each exact match.
  let hasChassisCompatibility = false;
  let exactChassisHits = 0;
  for (const code of target.chassisCodes) {
    if (candidate.chassisCodes.some((candCode) => areChassisCompatible(code, candCode))) {
      hasChassisCompatibility = true;
      if (candidate.chassisCodes.includes(code)) {
        exactChassisHits += 1;
      }
    }
  }

  if (hasChassisCompatibility) {
    score += SCORE_CHASSIS;
    score += exactChassisHits * 10; // exact match bonus
  }

  // Model match: exact normalized hit > head-token-only hit
  const targetKeys = new Set(target.models.map(normalizeModelKey).filter(Boolean));
  const candidateKeys = new Set(candidate.models.map(normalizeModelKey).filter(Boolean));
  let exactHits = 0;
  let tokenHits = 0;
  for (const key of targetKeys) {
    if (candidateKeys.has(key)) {
      if (porsche911SubmodelsCompatible(key, key)) {
        exactHits += 1;
      }
      continue;
    }
    const headToken = modelHeadToken(key);
    if (!headToken) continue;
    if (
      [...candidateKeys].some(
        (cand) => modelHeadToken(cand) === headToken && porsche911SubmodelsCompatible(key, cand)
      )
    ) {
      tokenHits += 1;
    }
  }
  score += exactHits * SCORE_MODEL_EXACT + tokenHits * SCORE_MODEL_TOKEN;

  // Hard constraint: when the target has chassis codes (specific platform like
  // M3 G80), require the candidate to share at least one chassis code OR an
  // exact-normalized model.
  const chassisHits = hasChassisCompatibility ? 1 : 0;
  if (target.chassisCodes.length > 0 && chassisHits === 0 && exactHits === 0) {
    return 0;
  }

  // Specificity penalty: a candidate that fits 30+ chassis codes is technically
  // compatible but not "made for your car". Push it below truly platform-
  // specific matches like an iPE exhaust dedicated to M3/M4 G80/G82.
  if (candidate.chassisCodes.length > SPECIFICITY_THRESHOLD) {
    score -= (candidate.chassisCodes.length - SPECIFICITY_THRESHOLD) * SPECIFICITY_PENALTY;
  }

  return Math.max(0, score);
}

export type CrossShopMatch = {
  product: ShopProduct;
  brand: string;
  score: number;
  fitment: Fitment;
};

export type CrossShopGroup = {
  /** Lowercased brand key (e.g. "ipe", "ohlins"). */
  brandKey: string;
  /** Display label as it appears on the product (e.g. "iPE", "Öhlins"). */
  brandLabel: string;
  matches: CrossShopMatch[];
};

const BRAND_DISPLAY_OVERRIDES: Record<string, string> = {
  ipe: "iPE",
  "innotech performance exhaust": "iPE",
  ohlins: "Öhlins",
  öhlins: "Öhlins",
  girodisc: "GiroDisc",
  csf: "CSF Racing",
  "csf racing": "CSF Racing",
  do88: "DO88",
  adro: "ADRO",
  akrapovic: "Akrapovič",
  akrapovič: "Akrapovič",
  racechip: "RaceChip",
  burger: "Burger Motorsports",
  "burger motorsports": "Burger Motorsports",
};

function brandDisplay(rawBrand: string): { key: string; label: string } {
  const key = rawBrand.trim().toLowerCase();
  const label = BRAND_DISPLAY_OVERRIDES[key] ?? rawBrand.trim();
  return { key, label };
}

/**
 * Find products from OTHER brands that fit the same vehicle as `currentProduct`.
 * Returns groups by brand, each capped at `perBrand` matches, total capped at
 * `totalLimit` products.
 */
export function findCrossShopFitmentMatches(
  currentProduct: ShopProduct,
  allProducts: ReadonlyArray<ShopProduct>,
  options: { perBrand?: number; totalLimit?: number; minScore?: number } = {}
): CrossShopGroup[] {
  // Default minScore = SCORE_MODEL_TOKEN: require at least a head-token model
  // hit OR a chassis match. Make-only (BMW + BMW) doesn't qualify, since
  // that pulls in unrelated parts for any BMW.
  const { perBrand = 3, totalLimit = 12, minScore = SCORE_MODEL_TOKEN } = options;

  if (isExcludedFromCrossShop(currentProduct)) return [];

  const targetFitment = extractProductFitment(currentProduct);
  if (
    !targetFitment.make &&
    targetFitment.models.length === 0 &&
    targetFitment.chassisCodes.length === 0
  ) {
    return [];
  }

  const currentBrandKey = String(currentProduct.brand ?? "")
    .trim()
    .toLowerCase();
  const seenSlugs = new Set<string>([currentProduct.slug]);
  const allMatches: CrossShopMatch[] = [];

  for (const candidate of allProducts) {
    if (!candidate?.slug || seenSlugs.has(candidate.slug)) continue;
    if (isExcludedFromCrossShop(candidate)) continue;

    const candidateBrandKey = String(candidate.brand ?? "")
      .trim()
      .toLowerCase();
    if (!candidateBrandKey || candidateBrandKey === currentBrandKey) continue;

    const candidateFitment = extractProductFitment(candidate);
    const score = scoreMatch(targetFitment, candidateFitment);
    if (score < minScore) continue;

    seenSlugs.add(candidate.slug);
    allMatches.push({
      product: candidate,
      brand: candidate.brand ?? "",
      score,
      fitment: candidateFitment,
    });
  }

  // Primary: higher price wins (prefer premium tuning parts). Secondary: higher score.
  // Tiebreak: prefer candidate with narrower chassis list.
  allMatches.sort((a, b) => {
    const priceA = a.product.price
      ? a.product.price.eur || a.product.price.usd || a.product.price.uah || 0
      : 0;
    const priceB = b.product.price
      ? b.product.price.eur || b.product.price.usd || b.product.price.uah || 0
      : 0;
    if (priceB !== priceA) return priceB - priceA;

    if (b.score !== a.score) return b.score - a.score;
    return a.fitment.chassisCodes.length - b.fitment.chassisCodes.length;
  });

  // Group by brand, cap each, then cap total
  const grouped = new Map<string, CrossShopGroup>();
  let totalKept = 0;
  for (const match of allMatches) {
    if (totalKept >= totalLimit) break;
    const { key, label } = brandDisplay(match.brand);
    let group = grouped.get(key);
    if (!group) {
      group = { brandKey: key, brandLabel: label, matches: [] };
      grouped.set(key, group);
    }
    if (group.matches.length >= perBrand) continue;
    group.matches.push(match);
    totalKept += 1;
  }

  // Order groups by their best match score (descending)
  const groups = [...grouped.values()].sort((a, b) => {
    const aBest = a.matches[0]?.score ?? 0;
    const bBest = b.matches[0]?.score ?? 0;
    return bBest - aBest;
  });

  return groups;
}

/**
 * Capitalize a model label, uppercasing any embedded chassis codes
 * (G80, F82, 992, etc.) regardless of separators. Handles "m3 (g80 / g81)"
 * and "m3 g80" alike.
 */
export function prettifyVehicleLabel(value: string): string {
  // Step 1: uppercase any token that matches a known chassis code, anywhere.
  const withChassisUpper = value.replace(/[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?/g, (token) => {
    const upper = token.toUpperCase();
    return CHASSIS_CODES.has(upper) ? upper : token;
  });
  // Step 2: title-case the rest by capitalizing the first letter of each word
  // group (separated by space, slash, dash, or paren).
  return withChassisUpper.replace(/(?:^|[\s\/(\-])([a-z])/g, (match) => match.toUpperCase());
}

function prettifyModelLabel(value: string): string {
  return prettifyVehicleLabel(value);
}

/**
 * Convenience helper: returns the headline summarizing what vehicle the
 * cross-shop section is targeting (e.g. "Підходить вашому BMW M3 (G80)").
 */
export function buildCrossShopHeading(fitment: Fitment, locale: "ua" | "en"): string {
  const isUa = locale === "ua";
  const lead = isUa ? "Також підходить:" : "Also fits:";
  const parts: string[] = [];
  if (fitment.make) parts.push(fitment.make);

  if (fitment.models.length > 0) {
    const best = [...fitment.models].sort((a, b) => b.length - a.length)[0];
    parts.push(prettifyModelLabel(best));
  }

  if (fitment.chassisCodes.length > 0) {
    const lastPart = parts[parts.length - 1] || "";
    const chassis = fitment.chassisCodes[0];
    if (!lastPart.toLowerCase().includes(chassis.toLowerCase())) {
      parts.push(`(${chassis.toUpperCase()})`);
    }
  }

  if (parts.length === 0) {
    return isUa ? "Може зацікавити з інших магазинів" : "You may also like from other stores";
  }
  return `${lead} ${parts.join(" ")}`;
}
