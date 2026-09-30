/**
 * Curated DO88 fitment lookup. One entry per (model, chassis) combination,
 * each pointing at the exact `categoryEn` suffix(es) used in the JSON catalog
 * — matching by these instead of substring on the title prevents the Turbo /
 * Carrera mix-up where supplier marketing copy ("Turbo / Carrera") in titles
 * bled into the wrong filter result.
 *
 * Lives in its own module (not inside Do88VehicleFilter.tsx) so server
 * components can import it. Client components ("use client") would otherwise
 * strip non-component exports across the server/client boundary.
 */

export type ModelEntry = {
  model: string;
  chassis: string;
  categoryTokens: string[];
  /**
   * Tokens of categories where shared parts may also live. A product is
   * pulled in only when it lives in one of these categories AND its title
   * matches at least one phrase from `sharedTitleMustInclude`.
   *
   * Used for the 992 Turbo case: do88 puts the dual-fit "Turbo / Carrera"
   * parts (plenum, intercooler piping, boost hoses) under the Carrera
   * category. Without this, opening the 992 Turbo filter loses them.
   */
  sharedCategoryTokens?: string[];
  sharedTitleMustInclude?: string[];
};

const DO88_SAI_CATEGORY_TOKEN = "A3 S3 TT, 2.0 TFSI EA888 (8V 8S)";

/**
 * do88 lists LF-190-SAI-KIT for these EA888 Gen.3/Gen.4 applications. Its
 * current catalog row is filed under the Audi 8V category, so keep every
 * cross-make application gated to this SAI filter title.
 * Source: https://www.do88performance.eu/en/artiklar/do88-vag-ea888-sai-air-filter.html
 */
function do88SaiApplication(model: string, chassis: string): ModelEntry {
  return {
    model,
    chassis,
    categoryTokens: [],
    sharedCategoryTokens: [DO88_SAI_CATEGORY_TOKEN],
    sharedTitleMustInclude: ["SAI Air Filter"],
  };
}

export const CAR_DATA: Record<string, readonly ModelEntry[]> = {
  Alpine: [
    {
      model: "A110",
      chassis: "A110",
      categoryTokens: [],
      sharedCategoryTokens: ["Alpine"],
      sharedTitleMustInclude: ["Alpine A110"],
    },
  ],
  CUPRA: [
    do88SaiApplication("Formentor", "5FF · 2020+ · 2.0 TSI EA888 Gen4"),
    {
      model: "Formentor",
      chassis: "5FF · 2020+ · 2.0 TSI EA888 Gen4",
      categoryTokens: [],
      sharedCategoryTokens: ["CUPRA"],
      sharedTitleMustInclude: ["VAG 2.0 TSI EA888 Gen4"],
    },
    do88SaiApplication("Leon", "Mk4 · 2020+ · 2.0 TSI EA888 Gen4"),
    {
      model: "Formentor VZ5",
      chassis: "Formentor VZ5",
      categoryTokens: [],
      sharedCategoryTokens: ["CUPRA"],
      sharedTitleMustInclude: ["Formentor VZ5"],
    },
  ],
  Ford: [
    {
      model: "Focus RS",
      chassis: "MKII · 2009–2011",
      categoryTokens: [],
      sharedCategoryTokens: ["Ford"],
      sharedTitleMustInclude: ["Ford Focus RS MKII"],
    },
  ],
  Porsche: [
    {
      model: "911 Turbo",
      chassis: "964 · 1990–1994",
      categoryTokens: ["964, Turbo (911)"],
      // The do88 clamp-kit number matches the related hose-kit number. The
      // hose-kit SKU is absent from our current catalog snapshot, so retain
      // this exact, manufacturer-numbered accessory mapping explicitly.
      sharedCategoryTokens: ["Clamp Kits"],
      sharedTitleMustInclude: ["do88-Kit158"],
    },
    {
      model: "911 Turbo S",
      chassis: "992",
      categoryTokens: ["992.1, Turbo (911)"],
      // do88 doesn't differentiate Turbo vs Turbo S — same engine/chassis,
      // same cooling parts. Shared "Turbo / Carrera" parts live under
      // Carrera in supplier data.
      sharedCategoryTokens: ["992.1, Carrera (911)"],
      sharedTitleMustInclude: ["Turbo / Carrera", "Turbo /Carrera", "Turbo/Carrera"],
    },
    {
      model: "911 Turbo",
      chassis: "992",
      categoryTokens: ["992.1, Turbo (911)"],
      sharedCategoryTokens: ["992.1, Carrera (911)"],
      sharedTitleMustInclude: ["Turbo / Carrera", "Turbo /Carrera", "Turbo/Carrera"],
    },
    { model: "911 Carrera", chassis: "992", categoryTokens: ["992.1, Carrera (911)"] },
    {
      model: "911 Turbo",
      chassis: "991",
      categoryTokens: ["991.1, Turbo (911)", "991.2, Turbo (911)"],
    },
    // 911 Turbo S mirrors of 991 / 997 — historically (991 Turbo S 580 hp,
    // 997 Turbo S 530 hp) the S variant uses the same engine, chassis and
    // cooling assembly as the regular Turbo, and do88 files everything
    // under the unified "Turbo" supplier categories. Without these mirror
    // entries the filter offered only "992" as a chassis option for Turbo S
    // owners, even though the same parts genuinely fit 991/997 Turbo S.
    {
      model: "911 Turbo S",
      chassis: "991",
      categoryTokens: ["991.1, Turbo (911)", "991.2, Turbo (911)"],
    },
    { model: "911 Carrera", chassis: "991", categoryTokens: ["991.2, Carrera (911)"] },
    {
      model: "911 Turbo",
      chassis: "997",
      categoryTokens: ["997.1, Turbo GT2 (911)", "997.2, Turbo (911)"],
    },
    {
      model: "911 Turbo S",
      chassis: "997",
      categoryTokens: ["997.1, Turbo GT2 (911)", "997.2, Turbo (911)"],
    },
    { model: "911 Turbo", chassis: "930", categoryTokens: ["930, Turbo (911)"] },
    { model: "911 Turbo / GT2 / Carrera", chassis: "996", categoryTokens: ["996, Turbo GT2 Carrera (911)"] },
    { model: "968", chassis: "968", categoryTokens: ["968, 3.0"] },
  ],
  BMW: [
    { model: "M2", chassis: "G87", categoryTokens: ["G80 G87, S58 (M2 M3 M4)"] },
    { model: "M3 / M4", chassis: "G80 G82", categoryTokens: ["G80 G87, S58 (M2 M3 M4)"] },
    { model: "M3 / M4", chassis: "F80 F82", categoryTokens: ["F80 F82 F87, S55 (M2C M3 M4)"] },
    {
      model: "M2",
      chassis: "F87",
      categoryTokens: ["F87, N55B30T0 (M2)", "F80 F82 F87, S55 (M2C M3 M4)"],
    },
    { model: "M340i / M440i", chassis: "G20 G22", categoryTokens: ["G-Chassis, B58 Gen 2"] },
    { model: "Z4 M40i", chassis: "G29", categoryTokens: ["G-Chassis, B58 Gen 2"] },
    { model: "1 / 3 Series", chassis: "E90 / E82 · N54 / N52 / N53", categoryTokens: ["E90 E82, N54 N52 N53 (1 & 3-Serie)"] },
    { model: "1 / 3 Series", chassis: "E90 / E82 · N55", categoryTokens: ["E90 E82, N55 (1 & 3-Serie)"] },
    { model: "3 Series / M3", chassis: "E46", categoryTokens: ["E46, S54 M52 M54 (M3 & 3-Serie)"] },
    { model: "3 Series / M3", chassis: "E36", categoryTokens: ["E36, S50 M50 (M3 & 3-Serie)"] },
    { model: "M3", chassis: "E90", categoryTokens: ["E90, S65 (M3)"] },
    { model: "M3", chassis: "E30", categoryTokens: ["E30, S14 (M3)"] },
    { model: "5 Series / M5", chassis: "E34", categoryTokens: ["E34, M50 S38 (M5 & 5-Serie)"] },
    { model: "3 / 4 Series", chassis: "F / G · B58 Gen 1", categoryTokens: ["F & G Chassiss, B58 Gen 1"] },
    { model: "2 / 3 / 4 Series", chassis: "F / G · B46 / B48", categoryTokens: ["F & G Chassiss, B48 B46"] },
  ],
  Audi: [
    do88SaiApplication("A3 / S3", "8Y · 2020+ · 2.0 TSI EA888 Gen4"),
    { model: "RS6 / RS7", chassis: "C8", categoryTokens: ["RS6 RS7, 4.0 V8 TFSI (C8)"] },
    { model: "RS3 / TTRS", chassis: "8V 8Y", categoryTokens: ["RS3 TT RS, 2.5 TFSI (8V 8Y 8S)"] },
    {
      model: "A3 / S3",
      chassis: "8Y · 2020+ · 2.0 TSI EA888 Gen4",
      categoryTokens: [],
      sharedCategoryTokens: ["CUPRA"],
      sharedTitleMustInclude: ["VAG 2.0 TSI EA888 Gen4"],
    },
    {
      model: "A3 / S3",
      chassis: "8V",
      categoryTokens: ["A3 S3 TT, 2.0 TFSI EA888 (8V 8S)"],
      // Mirror of the VW Mk7 Golf entry below: Audi 8V S3 and VW Mk7 Golf R
      // share the EA888 Gen3 MQB platform. Several do88 SKUs are filed under
      // the VW Golf Mk7 supplier category but are explicitly multi-fit
      // ("Audi / VW 2.0 TSI EA888 (MQB) ...", "AUDI SEAT SKODA VW 1.8 / 2.0
      // TSI (MQB) Intercooler", Garrett PowerMax turbo upgrades, etc.).
      // Without this, opening the Audi 8V S3 filter loses those parts even
      // though the title explicitly says they fit.
      sharedCategoryTokens: ["Golf, 1.8T / 2.0T EA888 (Mk 7/7.5 MQB)"],
      // Gate is title-must-include — keeps Golf-only SKUs (e.g. WC-330 "VW
      // Golf GTI Mk7 DSG" radiator, MK-110 cosmetic engine cover) from
      // leaking into the Audi filter. The phrases below all signal a
      // genuinely multi-fit Audi/VAG part.
      sharedTitleMustInclude: ["Audi", "AUDI", "VAG", "8V"],
    },
    do88SaiApplication("TT", "8S · 2014+"),
    do88SaiApplication("SQ2", "2018+"),
    do88SaiApplication("Q3 45 TFSI", "2018+"),
    {
      model: "S2 / RS2",
      chassis: "B3 · 3B / ABY / ADU",
      categoryTokens: ["S2 RS2, 3B ABY ADU (3B)"],
      // The official do88-kit186B-r crankcase-vent kit is categorized under
      // RS6 C5 even though do88 explicitly lists S2 / RS2 fitment as well.
      sharedCategoryTokens: ["RS6, 4.2T (C5)"],
      sharedTitleMustInclude: ["Crankcase vent hose"],
    },
    { model: "UrQuattro", chassis: "UrQuattro", categoryTokens: ["UrQuattro, 2.2T 10V & 20V"] },
    { model: "RS6", chassis: "C5", categoryTokens: ["RS6, 4.2T (C5)"] },
    {
      model: "S4 / S6",
      chassis: "C4",
      categoryTokens: ["S4 S6, 2.2T (C4)"],
      sharedCategoryTokens: ["RS6, 4.2T (C5)"],
      sharedTitleMustInclude: ["Crankcase vent hose"],
    },
    {
      model: "S4 / A6",
      chassis: "B5 / C5",
      categoryTokens: ["S4 A6, 2.7T (B5 C5)"],
      sharedCategoryTokens: ["RS6, 4.2T (C5)"],
      sharedTitleMustInclude: ["Crankcase vent hose"],
    },
    { model: "S3 / TT", chassis: "8L / 8N", categoryTokens: ["S3 TT, 1.8T (8L 8N)"] },
    { model: "A4", chassis: "B6", categoryTokens: ["A4, 1.8T (B6)"] },
    { model: "RS4", chassis: "B5", categoryTokens: ["RS4, 2.7T (B5)"] },
    { model: "A3 / S3 / TT", chassis: "8P / 8J", categoryTokens: ["A3 S3 TT, 2.0 TFSI (8P 8J)"] },
    { model: "S1", chassis: "8X", categoryTokens: ["S1, 2.0 TFSI EA888 (8X)"] },
  ],
  VW: [
    do88SaiApplication("Golf GTI / R", "Mk8"),
    // Newer chassis on top, older below — per shop owner brief.
    {
      model: "Golf GTI / R",
      chassis: "Mk8",
      categoryTokens: ["Golf, 2.0T EA888 Gen 4 (Mk 8 MQB Evo)"],
      // do88 files most EA888 Gen 4 / MQB Evo platform parts under the bare
      // "Modellanpassat > CUPRA" bucket (titles read "VAG 2.0 TSI EA888 Gen4…"
      // or "MQB Evo…"). The title gate excludes Formentor-only SKUs (e.g.
      // ICM-380-VZ5) which sit in the same bucket but don't fit the Mk8 Golf.
      sharedCategoryTokens: ["CUPRA"],
      sharedTitleMustInclude: ["VAG 2.0 TSI EA888 Gen4"],
    },
    do88SaiApplication("Passat", "B8 (3G) · 2015+"),
    do88SaiApplication("Arteon", "2017+"),
    do88SaiApplication("T-Roc R", "2019+"),
    do88SaiApplication("Tiguan II", "2021+"),
    do88SaiApplication("Arteon R", "2020+"),
    {
      model: "Golf GTI / R",
      chassis: "Mk7",
      categoryTokens: ["Golf, 1.8T / 2.0T EA888 (Mk 7/7.5 MQB)"],
      // The vast majority of Mk7 GTI/R-fitting parts live under the Audi A3/S3
      // EA888 (8V) category as multi-fit MQB-Gen3 platform parts (titles read
      // "VAG…(MQB)" / "AUDI SEAT SKODA VW 1.8 / 2.0 TSI (MQB)" / "VAG EA888").
      // do88's GFB dump-valve aisle also lists two valves explicitly tagged
      // "Fits VW Mk7 Golf R and Audi 8V S3" (T9359, T9659).
      // Token for the GFB aisle uses the English suffix because that bucket
      // gets translated by do88's import — "Dumpventiler" → "Dump Valves" —
      // unlike the chassis-suffix tokens (e.g. "8V 8S") which are identical
      // across locales.
      sharedCategoryTokens: ["A3 S3 TT, 2.0 TFSI EA888 (8V 8S)", "GFB Dump Valves"],
      sharedTitleMustInclude: ["MQB", "EA888", "Mk7 Golf"],
    },
    { model: "Polo", chassis: "Mk6 · AW", categoryTokens: ["Polo, 2.0 TSI EA888 (Mk 6 AW)"] },
  ],
  Toyota: [
    {
      model: "GR Supra",
      chassis: "A90",
      categoryTokens: ["GR Supra, 3.0T B58 (MK5)"],
      // GR Supra A90 shares the BMW B58 engine; do88 ships its B58
      // intercooler / oil cooler / front-radiator / intake-filter SKUs
      // (ICM-430-G/K, OC-190, WC-400, WC-410, LF-230-Filter, ICM-430-440-Kit)
      // listed under both BMW G-chassis and Toyota Supra A90 on
      // do88performance.eu. We mirror that — pull anything categorized under
      // BMW G-chassis whose title flags B58/G-Serie/Supra.
      sharedCategoryTokens: ["G-Chassis, B58 Gen 2"],
      sharedTitleMustInclude: ["B58", "G-Serie", "Supra", "GR Supra", "A90"],
    },
    { model: "GR Yaris", chassis: "GXPA16", categoryTokens: ["GR Yaris, 1.6T G16E-GTS (GXPA16)"] },
  ],
  // These makes exist in do88's Vehicle Specific catalog only at make level.
  // Keep them available for make-only filtering; no model/chassis is implied.
  Mazda: [
    {
      model: "MX-5 Miata",
      chassis: "NC · 2006–2015",
      categoryTokens: [],
      sharedCategoryTokens: ["Mazda"],
      sharedTitleMustInclude: ["Mazda MX-5 Miata NC"],
    },
    {
      model: "MX-5 Miata",
      chassis: "ND · 2015+",
      categoryTokens: [],
      sharedCategoryTokens: ["Mazda"],
      sharedTitleMustInclude: ["Mazda MX-5 Miata ND"],
    },
  ],
  Opel: [
    {
      model: "Calibra / Vectra A Turbo",
      chassis: "C20LET",
      categoryTokens: [],
      sharedCategoryTokens: ["Opel"],
      sharedTitleMustInclude: ["Opel Calibra Vectra A Turbo C20LET"],
    },
    {
      model: "Vectra C",
      chassis: "2.0T · 2002–2008",
      categoryTokens: [],
      sharedCategoryTokens: ["Opel"],
      sharedTitleMustInclude: ["Opel Vectra C 2.0T"],
    },
    {
      model: "Vectra C OPC",
      chassis: "V6 · 2005–2008",
      categoryTokens: [],
      sharedCategoryTokens: ["Opel"],
      sharedTitleMustInclude: ["Opel Vectra C OPC V6"],
    },
    {
      model: "Insignia A / Buick Regal",
      chassis: "A",
      categoryTokens: [],
      sharedCategoryTokens: ["Opel"],
      sharedTitleMustInclude: ["Opel Insignia A", "Buick Regal"],
    },
  ],
  Suzuki: [
    {
      model: "Swift Sport",
      chassis: "1.6 · 2005–2010",
      categoryTokens: [],
      sharedCategoryTokens: ["Suzuki"],
      sharedTitleMustInclude: ["Suzuki Swift Sport 1.6 05-10"],
    },
  ],
  Saab: [
    { model: "900", chassis: "1979–1993", categoryTokens: ["900, (1979-1993)"] },
    { model: "9000", chassis: "1985–1998", categoryTokens: ["9000, (1985-1998)"] },
    { model: "900 / 9-3", chassis: "1994–2000", categoryTokens: ["900 9-3, (1994-2000)"] },
    { model: "9-3", chassis: "2000–2002", categoryTokens: ["9-3, (2000-2002)"] },
    { model: "9-3", chassis: "2003–2012", categoryTokens: ["9-3, (2003-2012)"] },
    { model: "9-5", chassis: "1998–2010", categoryTokens: ["9-5, (1998-2010)"] },
    { model: "9-5", chassis: "2010–2011", categoryTokens: ["9-5, (2010-2011)"] },
    { model: "9-3 / 9-5 diesel", chassis: "1998–2011", categoryTokens: ["9-3 9-5, TTiD TiD (1998-2011)"] },
  ],
  Seat: [
    { model: "Ibiza Cupra", chassis: "6J", categoryTokens: ["Ibiza Cupra, 1.8 TSI (6J)"] },
    do88SaiApplication("Leon Cupra", "Mk3 (5F) · 2014+"),
    do88SaiApplication("Ateca Cupra", "2018+"),
    {
      model: "León",
      chassis: "Mk4 · 2020+ · 2.0 TSI EA888 Gen4",
      categoryTokens: [],
      sharedCategoryTokens: ["CUPRA"],
      sharedTitleMustInclude: ["VAG 2.0 TSI EA888 Gen4"],
    },
  ],
  Skoda: [
    do88SaiApplication("Octavia vRS", "Mk4 (NX) · 2020+"),
    do88SaiApplication("Octavia vRS", "Mk3 (5E) · 2014+"),
    do88SaiApplication("Superb", "Mk3 (B8 / 3V) · 2015+"),
    {
      model: "Octavia",
      chassis: "NX · 2019+ · 2.0 TSI EA888 Gen4",
      categoryTokens: [],
      sharedCategoryTokens: ["CUPRA"],
      sharedTitleMustInclude: ["VAG 2.0 TSI EA888 Gen4"],
    },
  ],
  Volvo: [
    { model: "240", chassis: "1975–1993", categoryTokens: ["240, (1975-1993)"] },
    { model: "740 / 940", chassis: "1985–1998", categoryTokens: ["740 940, (1985-1998)"] },
    { model: "960 / S90 / V90", chassis: "1985–1998", categoryTokens: ["960 S90 V90, (1985-1998)"] },
    { model: "850 / S70 / V70 / C70", chassis: "P80 · 1992–1998", categoryTokens: ["850 S70 V70 C70, P80 (1992-1998)"] },
    { model: "S70 / V70 / C70 / XC70", chassis: "P80 · 1999–2000", categoryTokens: ["S70 V70 C70 XC70, P80 (1999-2000)"] },
    { model: "S40 / V40", chassis: "1998–2004", categoryTokens: ["S40 V40, (1998-2004)"] },
    { model: "S60 / V70 / S80 / XC70", chassis: "P2 · 2000–2009", categoryTokens: ["S60 V70 S80 XC70, P2 (2000-2009)"] },
    { model: "C30 / C70 / S40 / V50", chassis: "P1 · 2004–2013", categoryTokens: ["C30 C70 S40 V50, P1 (2004-2013)"] },
    { model: "V70 / S80 / XC70", chassis: "P3 · 2008–2016", categoryTokens: ["V70 S80 XC70, P3 (2008-2016)"] },
    { model: "S60 / V70 / XC60", chassis: "P3 · 2010–2016", categoryTokens: ["S60 V70 XC60, P3 (2010-2016)"] },
    { model: "V40", chassis: "P1 · 2013–2019", categoryTokens: ["V40, P1 (2013-2019)"] },
    { model: "S60 / S90 / XC60 / XC90", chassis: "SPA · 2016+", categoryTokens: ["SV60 SV90 XC60 XC90, SPA (2016-202X)"] },
    { model: "Diesel applications", chassis: "Multiple generations", categoryTokens: ["Diesel Engines"] },
  ],
} as const;

/**
 * Reverse-lookup: given a product's primary supplier category token
 * (the leaf after "Vehicle Specific > Make > …" — e.g.
 * `"A3 S3 TT, 2.0 TFSI EA888 (8V 8S)"`) and the product title, return every
 * (make, model, chassis) combination that should fit this part.
 *
 * Mirrors the filter logic in `Do88VehicleFilter`:
 *   • direct `categoryTokens` match → always included;
 *   • `sharedCategoryTokens` match → included only if the title contains at
 *     least one phrase from `sharedTitleMustInclude` (or no gate is set).
 *
 * Used by the PDP "Compatible models" block so customers searching for VW
 * Golf Mk7 don't get confused when an EA888 part lists only its Audi-side
 * primary category. The list is built from the same dictionary the filter
 * uses, so the two surfaces stay in sync without manual data duplication.
 */
export type CompatibleVehicle = { make: string; model: string; chassis: string };

export function resolveCompatibleVehiclesForDo88Product(
  primaryCategoryToken: string | null | undefined,
  productTitle: string
): CompatibleVehicle[] {
  if (!primaryCategoryToken) return [];
  const token = primaryCategoryToken.trim();
  if (!token) return [];

  const titleLc = (productTitle || "").toLowerCase();
  const matches: CompatibleVehicle[] = [];
  const seen = new Set<string>();

  for (const make of Object.keys(CAR_DATA)) {
    const entries = CAR_DATA[make as keyof typeof CAR_DATA];
    for (const entry of entries) {
      const direct = entry.categoryTokens.includes(token);
      let shared = false;
      if (!direct && entry.sharedCategoryTokens?.includes(token)) {
        const gate = entry.sharedTitleMustInclude;
        if (!gate || gate.length === 0) {
          shared = true;
        } else {
          shared = gate.some((phrase) => titleLc.includes(phrase.toLowerCase()));
        }
      }
      if (!direct && !shared) continue;
      const key = `${make}|${entry.model}|${entry.chassis}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ make, model: entry.model, chassis: entry.chassis });
    }
  }
  return matches;
}

/**
 * Extract the leaf "category token" from a Do88 category breadcrumb string
 * like `"Vehicle Specific > Audi > A3 S3 TT, 2.0 TFSI EA888 (8V 8S)"` or its
 * UA equivalent `"Для автомобілів > Audi > A3 S3 TT, …"`. Returns the part
 * after the last `>` (trimmed), or null if no separator is present.
 */
export function extractDo88CategoryLeafToken(
  categoryBreadcrumb: string | null | undefined
): string | null {
  if (!categoryBreadcrumb) return null;
  const parts = categoryBreadcrumb.split(/\s*>\s*/);
  if (parts.length === 0) return null;
  const leaf = parts[parts.length - 1]?.trim();
  return leaf || null;
}

/** URL values are untrusted: unknown makes and Object prototype keys have no entries. */
export function getDo88MakeEntries(make: string): readonly ModelEntry[] {
  return Object.prototype.hasOwnProperty.call(CAR_DATA, make)
    ? CAR_DATA[make as keyof typeof CAR_DATA]
    : [];
}

/** A vehicle may have several independently gated supplier application rules. */
export function matchesDo88VehicleFilter(
  category: string,
  title: string,
  filters: { make?: string; model?: string; chassis?: string }
): boolean {
  const { make, model, chassis } = filters;
  if (!make && !model && !chassis) return true;
  const segments = category.split(/\s*>\s*/).map((segment) => segment.trim());
  const entries = make ? getDo88MakeEntries(make) : Object.values(CAR_DATA).flat();
  if (make && entries.length === 0) return false;
  if (make && !model && !chassis &&
      segments[0]?.toLowerCase() === "vehicle specific" &&
      segments[1]?.toLowerCase() === make.toLowerCase()) return true;
  const titleLc = title.toLowerCase();
  return entries.some((entry) => {
    if ((model && entry.model !== model) || (chassis && entry.chassis !== chassis)) return false;
    if (entry.categoryTokens.some((token) => segments.includes(token))) return true;
    return Boolean(
      entry.sharedCategoryTokens?.some((token) => segments.includes(token)) &&
      entry.sharedTitleMustInclude?.some((phrase) => titleLc.includes(phrase.toLowerCase()))
    );
  });
}

type Do88ClampFitmentRecord = {
  sku?: string | null;
  category?: { en?: string | null } | null;
};

/** Resolve a clamp kit through its exact do88 hose-kit number, failing closed. */
export function findDo88ClampKitFitmentParent<T extends Do88ClampFitmentRecord>(
  product: T,
  catalog: readonly T[]
): T | undefined {
  const kitNumber = product.sku?.match(/^clamp-kit(\d+)$/i)?.[1];
  if (!kitNumber) return undefined;

  const parentSkuPattern = new RegExp(`^do88-kit${kitNumber}(?:[a-z-].*)?$`, "i");
  const parents = catalog.filter(
    (candidate) =>
      parentSkuPattern.test(candidate.sku ?? "") &&
      /^Vehicle Specific\s*>/i.test(candidate.category?.en ?? "")
  );
  return parents.length === 1 ? parents[0] : undefined;
}
