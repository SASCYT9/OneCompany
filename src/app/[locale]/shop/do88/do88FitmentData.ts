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

export const CAR_DATA: Record<string, readonly ModelEntry[]> = {
  Porsche: [
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
  ],
  Audi: [
    { model: "RS6 / RS7", chassis: "C8", categoryTokens: ["RS6 RS7, 4.0 V8 TFSI (C8)"] },
    { model: "RS3 / TTRS", chassis: "8V 8Y", categoryTokens: ["RS3 TT RS, 2.5 TFSI (8V 8Y 8S)"] },
    {
      model: "A3 / S3",
      chassis: "8V 8Y",
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
  ],
  VW: [
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
      sharedTitleMustInclude: ["Gen4", "GEN4", "Gen 4", "MQB Evo"],
    },
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
