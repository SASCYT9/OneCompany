import type { SupplierCopyVehicle } from "@/lib/supplierCatalogCopy";

/**
 * Supplier pages name vehicles by trim and platform ("330i xDrive", "GTI",
 * "A3 quattro", "E90/E92/E93", "MQB"); the catalogue's vehicle picker matches
 * make, model and chassis literally ("3 Series" + "E90", "Golf GTI" + "MK7",
 * "A3" + "8V"). These rules turn a supplier vehicle into the picker's terms so
 * a product is found under the car it fits.
 */

const MAKE_ALIASES: Record<string, string> = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  mini: "MINI",
  skoda: "Škoda",
  škoda: "Škoda",
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  "mercedes-amg": "Mercedes-Benz",
  mclaren: "McLaren",
};

/** Engine families and platforms that some pages list where a car model belongs. */
const NOT_A_MODEL =
  /\b\d\.\dT\b|\bEA\d{3}\b|\bMQB\b|\bcylinder\b|\b[BN][ -]series\b|\bHaldex\b|\bmodels$/i;

/** Platform codes, not chassis codes: resolved per model below or dropped. */
const PLATFORM = /^(?:MQB(?: ?EVO)?|PQ3[45]|PQ46|MLB(?: ?EVO)?|MSB|PL7[12]|MEB|A0)$/i;

function canonicalMake(make: string) {
  const trimmed = make.trim();
  return MAKE_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** "E90/E92/E93" → three codes; "E36/7" (Z3 roadster) stays one code. */
export function splitSupplierChassisCodes(value: string | null | undefined): Array<string | null> {
  const text = String(value ?? "").trim();
  if (!text) return [null];
  const parts = text
    .split(/\s*[/,]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const codes: string[] = [];
  for (const part of parts) {
    if (/^\d$/.test(part) && codes.length) {
      codes[codes.length - 1] = `${codes[codes.length - 1]}/${part}`;
    } else {
      codes.push(part);
    }
  }
  return codes.length ? codes : [null];
}

function bmwModel(model: string): string {
  const text = model.replace(/\s+/g, " ").trim();
  if (/^1 ?(?:series )?M(?: coup[eé])?$|^1M$/i.test(text)) return "1 Series";
  const mCar = text.match(/^M([2-8])(?![0-9])/i);
  if (mCar) return `M${mCar[1]}`;
  const xM = text.match(/^X([3-6]) ?M(?![0-9a-z])/i);
  if (xM) return `X${xM[1]} M`;
  if (/^XM\b/i.test(text)) return "XM";
  const x = text.match(/^X([1-7])(?![0-9])/i);
  if (x) return `X${x[1]}`;
  const z = text.match(/^Z([1348])(?![0-9])/i);
  if (z) return `Z${z[1]}`;
  const i = text.match(/^i([3-8])(?![0-9])/);
  if (i) return `i${i[1]}`;
  const alpina = text.match(/^Alpina B([3-8])/i);
  if (alpina) return `${alpina[1]} Series`;
  const alpinaX = text.match(/^Alpina XB([1-7])/i);
  if (alpinaX) return `X${alpinaX[1]}`;
  const hybrid = text.match(/^ActiveHybrid ([3-7])/i);
  if (hybrid) return `${hybrid[1]} Series`;
  if (/^6\d{2}\w* .*Gran Turismo|^6 Gran Turismo/i.test(text)) return "6 Gran Turismo";
  const series = text.match(/^([1-8])[ -]?Series\b/i);
  if (series) return `${series[1]} Series`;
  const trim = text.match(/^M?([1-8])\d{2}[a-zA-Z]{0,3}\b/);
  if (trim) return `${trim[1]} Series`;
  return text;
}

function audiModel(model: string): string {
  let text = model
    .replace(/\s+quattro\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:a[46] )?allroad$/i.test(text)) return "Allroad";
  text = text.replace(/^TT ?RS$/i, "TTRS").replace(/^RS ?Q([38])$/i, "RSQ$1");
  if (/ PHEV$/i.test(text)) text = text.replace(/ PHEV$/i, "");
  if (/^A3 Sportback e-tron$/i.test(text)) return "A3 Sportback";
  // The picker lists these Sportbacks as models of their own; other Sportbacks
  // and Avants are the base model.
  if (/^(?:A3|A5|RS5|Q3) Sportback$/i.test(text)) return text;
  return text.replace(/ (?:Sportback|Avant)$/i, "");
}

function volkswagenModel(model: string): string {
  const text = model.replace(/\s+/g, " ").trim();
  if (/^GTI$/i.test(text)) return "Golf GTI";
  if (/^Golf (?:Sport ?Wagen|Alltrack|Variant)$/i.test(text)) return "Golf Estate";
  if (/^(?:Golf )?R32$|^e-Golf$/i.test(text)) return "Golf";
  if (/^Jetta GLI$/i.test(text)) return "Jetta";
  if (/^Tiguan Limited$/i.test(text)) return "Tiguan";
  if (/^New Beetle$/i.test(text)) return "Beetle";
  return text;
}

function miniModel(model: string): string {
  const text = model.replace(/\s+/g, " ").trim();
  const body = text.match(/\b(Clubman|Countryman|Paceman)\b/i);
  if (body) return body[1].charAt(0).toUpperCase() + body[1].slice(1).toLowerCase();
  // John Cooper Works hatches share the Cooper S platform and the picker's entry.
  if (/^(?:Cooper )?(?:JCW|John Cooper Works)$/i.test(text)) return "Cooper S";
  return text;
}

function subaruModel(model: string, chassis: string | null): string {
  if (!/impreza|wrx/i.test(model)) return model;
  const code = (chassis ?? "").toUpperCase();
  if (/^G[CF]8/.test(code)) return "Impreza I";
  if (/^G[DG]/.test(code)) return "Impreza II";
  if (/^G[RVHE]/.test(code)) return "Impreza III";
  if (/^VA/.test(code)) return "WRX";
  return model;
}

function mitsubishiModel(model: string, chassis: string | null, yearFrom: number | null): string {
  if (!/lancer evolution/i.test(model)) return model;
  const code = (chassis ?? "").toUpperCase();
  if (code === "CN9A") return "Lancer Evolution IV";
  if (code === "CP9A")
    return yearFrom !== null && yearFrom <= 1998 ? "Lancer Evolution V" : "Lancer Evolution VI";
  if (code === "CT9A") {
    if (yearFrom !== null && yearFrom >= 2005) return "Lancer Evolution IX";
    if (yearFrom !== null && yearFrom >= 2003) return "Lancer Evolution VIII";
    return "Lancer Evolution VII";
  }
  if (code === "CZ4A") return "Lancer Evolution X";
  return model;
}

function hondaModel(model: string, chassis: string | null): string {
  const code = (chassis ?? "").toUpperCase();
  if (/^civic$/i.test(model)) {
    if (/^EG/.test(code)) return "Civic V";
    if (/^E[KJ]/.test(code)) return "Civic VI";
    if (/^E[PMSU]/.test(code)) return "Civic VII";
    if (/^F[DN]/.test(code)) return "Civic VIII";
    if (/^(?:FB|FK[123])\b/.test(code)) return "Civic IX";
    if (/^(?:FC|FK[78])/.test(code)) return "Civic X";
    if (/^FL/.test(code)) return "Civic XI";
  }
  if (/^prelude$/i.test(model)) {
    if (/^BB[1-4]$/.test(code)) return "Prelude IV";
    if (/^BB[6-8]$/.test(code)) return "Prelude V";
  }
  return model;
}

/** Ferrari body and edition names ("488 Pista", "F12berlinetta") belong to the picker's model. */
function ferrariModel(model: string): string {
  const rules: Array<[RegExp, string]> = [
    [/^296\b/i, "296"],
    [/^458\b/i, "458"],
    [/^488\b/i, "488"],
    [/^812\b/i, "812"],
    [/^F12/i, "F12"],
    [/^F430\b/i, "F430"],
    [/^F8 (?:Spider|Tributo Spider)$/i, "F8"],
    [/^GTC4/i, "GTC4"],
    [/^SF90\b(?! Stradale$)/i, "SF90"],
    [/^California\b/i, "California"],
  ];
  return rules.find(([pattern]) => pattern.test(model))?.[1] ?? model;
}

/**
 * Mercedes-AMG cars sit under "AMG <class> <number>" in the picker ("E63 AMG" → "AMG E 63");
 * the S versions only where the picker lists them.
 */
function mercedesModel(model: string): string {
  if (/^G\s?63\b/i.test(model)) return "AMG G 63";
  if (/^G\s?500$/i.test(model)) return "G 500";
  if (/^G\s?550$/i.test(model)) return "G-Class";
  if (/^CLS\s?63\b/i.test(model)) return "CLS-Class";
  const amg = model
    .replace(/\bAMG\b/gi, " ")
    .trim()
    .match(/^(C|E|S|GLC|GLE|GT)\s?(35|43|45|53|63)\s?(S)?$/i);
  if (amg) {
    const [, series, number, s] = amg;
    const name = `AMG ${series.toUpperCase()} ${number}`;
    return s && ["C", "GLC", "GLE"].includes(series.toUpperCase()) ? `${name} S` : name;
  }
  return model;
}

function porscheModel(model: string, chassis: string | null, yearFrom: number | null): string {
  if (/^911 Carrera 4 ?S?$/i.test(model)) return "911 Carrera";
  if (/^930$/.test(model)) return "911";
  if (/^(?:GT3|GT3 RS|GT2 RS|Carrera|Turbo|Turbo S)$/i.test(model)) {
    return `911 ${model.replace(/^carrera$/i, "Carrera").replace(/^turbo/i, "Turbo")}`;
  }
  const code = String(chassis ?? "").toUpperCase();
  // 718 (982) Boxster / Cayman from 2016; the 981 and older keep the plain name.
  const is718 = /^(?:718|982)/.test(code) || (!code && (yearFrom ?? 0) >= 2017);
  if (/^Cayman GT4 RS$/i.test(model)) return "718 Cayman GT4 RS";
  if (/^(?:Boxster )?Spyder RS$/i.test(model)) return "718 Spyder RS";
  const base = model.match(/^(Boxster|Cayman)\b/i)?.[1];
  if (base) {
    const name = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
    return is718 ? `718 ${name}` : name;
  }
  return model;
}

function modelFor(make: string, model: string, chassis: string | null, yearFrom: number | null) {
  switch (make) {
    case "Ferrari":
      return ferrariModel(model);
    case "Lamborghini":
      if (/^Aventador\b/i.test(model)) return "Aventador";
      if (/^Gallardo\b(?! Spyder$)/i.test(model)) return "Gallardo";
      return model;
    case "McLaren":
      return /^MP4-?12C$/i.test(model) ? "MP4 12C" : model;
    case "Mercedes-Benz":
      return mercedesModel(model);
    case "Jeep":
      return /^Wrangler$/i.test(model) && /^JL/i.test(chassis ?? "") ? "Wrangler IV" : model;
    case "Lexus":
      return /^RC ?F$/i.test(model) ? "RC" : model;
    case "BMW":
      return bmwModel(model);
    case "Audi":
      return audiModel(model);
    case "Volkswagen":
      return volkswagenModel(model);
    case "MINI":
      return miniModel(model);
    case "Toyota":
      if (/^(?:GR )?Supra$/i.test(model)) {
        return /^A9[01]$/i.test(chassis ?? "") || (yearFrom ?? 0) >= 2019 ? "GR Supra" : "Supra";
      }
      return /^86$/.test(model) ? "GT 86" : model;
    case "Porsche":
      return porscheModel(model, chassis, yearFrom);
    case "Subaru":
      return subaruModel(model, chassis);
    case "Mitsubishi":
      return mitsubishiModel(model, chassis, yearFrom);
    case "Honda":
      return hondaModel(model, chassis);
    case "Nissan":
      return /^Skyline GT-?R$/i.test(model) ? "Skyline" : model;
    case "Tesla":
      return /^[3SXY]$/i.test(model) ? `Model ${model.toUpperCase()}` : model;
    default:
      return model;
  }
}

/** M cars have chassis codes of their own: a page's "X5 (F95)" is the X5 M. */
const BMW_M_CHASSIS: Record<string, string> = {
  F87: "M2",
  G87: "M2",
  F80: "M3",
  G80: "M3",
  G81: "M3",
  F82: "M4",
  F83: "M4",
  G82: "M4",
  G83: "M4",
  F90: "M5",
  F91: "M8",
  F92: "M8",
  F93: "M8",
  F97: "X3 M",
  F98: "X4 M",
  F85: "X5 M",
  F95: "X5 M",
  F86: "X6 M",
  F96: "X6 M",
};

/**
 * Generations by model year (US model years, as the brands' pages give them).
 * A vehicle with years but no chassis gets the generations those years cover,
 * so a 2014–2018 X5 part is found under F15 and not under G05.
 */
type Generation = [codes: string[], from: number, to: number | null];
const GENERATIONS: Record<string, Record<string, Generation[]>> = {
  BMW: {
    "1 Series": [
      [["E82", "E88"], 2008, 2013],
      [["F20", "F21"], 2011, 2019],
      [["F40"], 2019, null],
    ],
    "2 Series": [
      [["F22", "F23"], 2014, 2021],
      [["F44"], 2020, null],
      [["G42"], 2022, null],
    ],
    "3 Series": [
      [["E36"], 1992, 1999],
      [["E46"], 1999, 2006],
      [["E90", "E91", "E92", "E93"], 2006, 2013],
      [["F30", "F31", "F34"], 2012, 2019],
      [["G20", "G21"], 2019, null],
    ],
    "4 Series": [
      [["F32", "F33", "F36"], 2014, 2020],
      [["G22", "G23", "G26"], 2021, null],
    ],
    "5 Series": [
      [["E34"], 1989, 1995],
      [["E39"], 1997, 2003],
      [["E60", "E61"], 2004, 2010],
      [["F10", "F11", "F07"], 2010, 2017],
      [["G30", "G31"], 2017, 2023],
      [["G60", "G61"], 2024, null],
    ],
    "6 Series": [
      [["E63", "E64"], 2004, 2010],
      [["F06", "F12", "F13"], 2011, 2018],
    ],
    "7 Series": [
      [["E38"], 1995, 2001],
      [["E65", "E66"], 2002, 2008],
      [["F01", "F02"], 2009, 2015],
      [["G11", "G12"], 2016, 2022],
      [["G70"], 2023, null],
    ],
    "8 Series": [
      [["E31"], 1990, 1999],
      [["G14", "G15", "G16"], 2019, null],
    ],
    X1: [
      [["E84"], 2009, 2015],
      [["F48"], 2016, 2022],
      [["U11"], 2023, null],
    ],
    X2: [
      [["F39"], 2018, 2023],
      [["U10"], 2024, null],
    ],
    X3: [
      [["E83"], 2004, 2010],
      [["F25"], 2011, 2017],
      [["G01"], 2018, 2024],
      [["G45"], 2025, null],
    ],
    X4: [
      [["F26"], 2015, 2018],
      [["G02"], 2019, null],
    ],
    X5: [
      [["E53"], 2000, 2006],
      [["E70"], 2007, 2013],
      [["F15"], 2014, 2018],
      [["G05"], 2019, null],
    ],
    X6: [
      [["E71"], 2008, 2014],
      [["F16"], 2015, 2019],
      [["G06"], 2020, null],
    ],
    X7: [[["G07"], 2019, null]],
    Z4: [
      [["E85", "E86"], 2003, 2008],
      [["E89"], 2009, 2016],
      [["G29"], 2019, null],
    ],
    M2: [
      [["F87"], 2016, 2021],
      [["G87"], 2023, null],
    ],
    M3: [
      [["E36"], 1995, 1999],
      [["E46"], 2001, 2006],
      [["E90", "E92", "E93"], 2008, 2013],
      [["F80"], 2015, 2018],
      [["G80", "G81"], 2021, null],
    ],
    M4: [
      [["F82", "F83"], 2015, 2020],
      [["G82", "G83"], 2021, null],
    ],
    M5: [
      [["E39"], 2000, 2003],
      [["E60"], 2006, 2010],
      [["F10"], 2012, 2016],
      [["F90"], 2018, 2023],
      [["G90"], 2025, null],
    ],
    M6: [
      [["E63", "E64"], 2006, 2010],
      [["F06", "F12", "F13"], 2012, 2018],
    ],
    M8: [[["F91", "F92", "F93"], 2020, null]],
    "X3 M": [[["F97"], 2020, null]],
    "X4 M": [[["F98"], 2020, null]],
    "X5 M": [
      [["E70"], 2010, 2013],
      [["F85"], 2015, 2019],
      [["F95"], 2020, null],
    ],
    "X6 M": [
      [["E71"], 2010, 2014],
      [["F86"], 2015, 2019],
      [["F96"], 2020, null],
    ],
  },
  MINI: {
    Cooper: [
      [["R50"], 2002, 2006],
      [["R56"], 2007, 2013],
      [["F55", "F56"], 2014, 2024],
    ],
    "Cooper S": [
      [["R53"], 2002, 2006],
      [["R56"], 2007, 2013],
      [["F55", "F56"], 2014, 2024],
    ],
    Clubman: [
      [["R55"], 2008, 2014],
      [["F54"], 2016, 2024],
    ],
    Countryman: [
      [["R60"], 2011, 2016],
      [["F60"], 2017, 2024],
    ],
    Paceman: [[["R61"], 2013, 2016]],
  },
  Toyota: { "GR Supra": [[["A90", "A91"], 2019, null]] },
  Volkswagen: {
    Golf: [
      [["MK4"], 1999, 2005],
      [["MK5"], 2006, 2009],
      [["MK6"], 2010, 2014],
      [["MK7"], 2015, 2017],
      [["MK7.5"], 2018, 2021],
      [["MK8"], 2022, null],
    ],
    "Golf GTI": [
      [["MK4"], 2000, 2005],
      [["MK5"], 2006, 2009],
      [["MK6"], 2010, 2014],
      [["MK7"], 2015, 2017],
      [["MK7.5"], 2018, 2021],
      [["MK8"], 2022, null],
    ],
    "Golf R": [
      [["MK6"], 2012, 2013],
      [["MK7"], 2015, 2017],
      [["MK7.5"], 2018, 2019],
      [["MK8"], 2022, null],
    ],
    "Golf Estate": [
      [["MK7"], 2015, 2017],
      [["MK7.5"], 2018, 2019],
    ],
    Jetta: [
      [["MK5"], 2005, 2010],
      [["MK6"], 2011, 2018],
      [["MK7"], 2019, null],
    ],
    Tiguan: [
      [["MK1"], 2009, 2018],
      [["MK2"], 2018, null],
    ],
  },
  Audi: {
    A3: [
      [["8P"], 2006, 2013],
      [["8V"], 2015, 2020],
      [["8Y"], 2022, null],
    ],
    S3: [
      [["8V"], 2015, 2020],
      [["8Y"], 2022, null],
    ],
    RS3: [
      [["8V"], 2017, 2020],
      [["8Y"], 2022, null],
    ],
    TT: [
      [["8N"], 2000, 2006],
      [["8J"], 2008, 2015],
      [["8S"], 2016, 2023],
    ],
    TTS: [
      [["8J"], 2009, 2015],
      [["8S"], 2016, 2023],
    ],
    TTRS: [
      [["8J"], 2012, 2013],
      [["8S"], 2018, 2022],
    ],
    A4: [
      [["B6"], 2002, 2005],
      [["B7"], 2005, 2008],
      [["B8"], 2009, 2016],
      [["B9"], 2017, 2024],
    ],
    S4: [
      [["B6"], 2004, 2005],
      [["B7"], 2005, 2008],
      [["B8"], 2010, 2016],
      [["B9"], 2018, 2024],
    ],
    A5: [
      [["B8"], 2008, 2017],
      [["B9"], 2018, 2024],
    ],
    S5: [
      [["B8"], 2008, 2017],
      [["B9"], 2018, 2024],
    ],
    RS5: [
      [["B8"], 2013, 2015],
      [["B9"], 2018, null],
    ],
    A6: [
      [["C6"], 2005, 2011],
      [["C7"], 2012, 2018],
      [["C8"], 2019, null],
    ],
    S6: [
      [["C7"], 2013, 2018],
      [["C8"], 2020, null],
    ],
    RS6: [[["C8"], 2020, null]],
    A7: [
      [["C7"], 2012, 2018],
      [["C8"], 2019, null],
    ],
    S7: [
      [["C7"], 2013, 2018],
      [["C8"], 2020, null],
    ],
    RS7: [
      [["C7"], 2014, 2018],
      [["C8"], 2020, null],
    ],
    Q3: [
      [["8U"], 2015, 2018],
      [["F3"], 2019, null],
    ],
    Q5: [
      [["8R"], 2009, 2017],
      [["FY"], 2018, null],
    ],
    SQ5: [
      [["8R"], 2014, 2017],
      [["FY"], 2018, null],
    ],
  },
};

function chassisByYears(
  make: string,
  model: string,
  yearFrom: number | null,
  yearTo: number | null
): string[] {
  const generations = GENERATIONS[make]?.[model];
  if (!generations || (yearFrom === null && yearTo === null)) return [];
  const from = yearFrom ?? yearTo!;
  const to = yearTo ?? yearFrom!;
  return generations
    .filter(([, start, end]) => start <= to && (end === null || end >= from))
    .flatMap(([codes]) => codes);
}

/** A platform such as MQB names several generations: the model and years pick one. */
function chassisForPlatform(
  make: string,
  model: string,
  platform: string,
  yearFrom: number | null
): string | null {
  const code = platform.toUpperCase().replace(/\s+/g, " ");
  const from = yearFrom ?? 0;
  if (make === "Volkswagen" && /^Golf\b/.test(model)) {
    if (code === "PQ35") return from && from <= 2009 ? "MK5" : "MK6";
    if (code === "MQB") return from >= 2018 ? "MK7.5" : "MK7";
    if (code === "MQB EVO") return "MK8";
  }
  if (make === "Volkswagen" && model === "Jetta") {
    if (code === "PQ35") return from && from <= 2010 ? "MK5" : "MK6";
    if (code === "MQB") return "MK7";
  }
  if (make === "Volkswagen" && model === "Tiguan") {
    if (code === "PQ35") return "MK1";
    if (code === "MQB") return "MK2";
  }
  if (make === "Audi" && /^(?:A3|S3|RS3)\b/.test(model)) {
    if (code === "PQ35") return "8P";
    if (code === "MQB") return "8V";
    if (code === "MQB EVO") return "8Y";
  }
  if (make === "Audi" && /^(?:TT|TTS|TTRS)$/.test(model)) {
    if (code === "PQ34") return "8N";
    if (code === "PQ35") return "8J";
    if (code === "MQB") return "8S";
  }
  if (make === "Audi" && /^(?:Q3|RSQ3)$/.test(model)) {
    if (code === "PQ35") return "8U";
    if (code === "MQB") return "F3";
  }
  return null;
}

/** Supplier vehicles in the vehicle picker's terms; engine families and platforms alone are dropped. */
export function canonicalizeSupplierVehicles(
  vehicles: SupplierCopyVehicle[]
): SupplierCopyVehicle[] {
  const out = new Map<string, SupplierCopyVehicle>();
  const add = (vehicle: SupplierCopyVehicle) => {
    const key = JSON.stringify([
      vehicle.make,
      vehicle.model,
      vehicle.chassisCode,
      vehicle.yearFrom ?? null,
      vehicle.yearTo ?? null,
      vehicle.engine ?? null,
      vehicle.market ?? null,
    ]);
    if (!out.has(key)) out.set(key, vehicle);
  };
  for (const vehicle of vehicles) {
    const make = canonicalMake(String(vehicle.make ?? ""));
    const rawModel = String(vehicle.model ?? "").trim();
    if (!make || !rawModel || NOT_A_MODEL.test(rawModel)) continue;
    // BMW engine codes ("B58TU", "N55") listed in place of a car.
    if (make === "BMW" && /^[BNS]\d{2}(?![0-9])/i.test(rawModel)) continue;
    const yearFrom = vehicle.yearFrom ?? null;
    const yearTo = vehicle.yearTo ?? null;
    for (const rawChassis of splitSupplierChassisCodes(vehicle.chassisCode)) {
      const listedChassis = rawChassis?.replace(/^mk(?=\d)/i, "MK") ?? null;
      let model = modelFor(make, rawModel, listedChassis, yearFrom);
      if (make === "BMW" && listedChassis && BMW_M_CHASSIS[listedChassis.toUpperCase()]) {
        model = BMW_M_CHASSIS[listedChassis.toUpperCase()];
      }
      const chassisCode =
        listedChassis && PLATFORM.test(listedChassis)
          ? chassisForPlatform(make, model, listedChassis, yearFrom)
          : listedChassis;
      if (chassisCode) {
        add({ ...vehicle, make, model, chassisCode });
        continue;
      }
      const byYears = chassisByYears(make, model, yearFrom, yearTo);
      if (!byYears.length) add({ ...vehicle, make, model, chassisCode: null });
      for (const code of byYears) add({ ...vehicle, make, model, chassisCode: code });
    }
  }
  return [...out.values()];
}
