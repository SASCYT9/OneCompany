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
      model: '911 Turbo S',
      chassis: '992',
      categoryTokens: ['992.1, Turbo (911)'],
      // do88 doesn't differentiate Turbo vs Turbo S — same engine/chassis,
      // same cooling parts. Shared "Turbo / Carrera" parts live under
      // Carrera in supplier data.
      sharedCategoryTokens: ['992.1, Carrera (911)'],
      sharedTitleMustInclude: ['Turbo / Carrera', 'Turbo /Carrera', 'Turbo/Carrera'],
    },
    {
      model: '911 Turbo',
      chassis: '992',
      categoryTokens: ['992.1, Turbo (911)'],
      sharedCategoryTokens: ['992.1, Carrera (911)'],
      sharedTitleMustInclude: ['Turbo / Carrera', 'Turbo /Carrera', 'Turbo/Carrera'],
    },
    { model: '911 Carrera', chassis: '992', categoryTokens: ['992.1, Carrera (911)'] },
    { model: '911 Turbo',   chassis: '991', categoryTokens: ['991.1, Turbo (911)', '991.2, Turbo (911)'] },
    { model: '911 Carrera', chassis: '991', categoryTokens: ['991.2, Carrera (911)'] },
    { model: '911 Turbo',   chassis: '997', categoryTokens: ['997.1, Turbo GT2 (911)', '997.2, Turbo (911)'] },
  ],
  BMW: [
    { model: 'M2',            chassis: 'G87',     categoryTokens: ['G80 G87, S58 (M2 M3 M4)'] },
    { model: 'M3 / M4',       chassis: 'G80 G82', categoryTokens: ['G80 G87, S58 (M2 M3 M4)'] },
    { model: 'M3 / M4',       chassis: 'F80 F82', categoryTokens: ['F80 F82 F87, S55 (M2C M3 M4)'] },
    { model: 'M2',            chassis: 'F87',     categoryTokens: ['F87, N55B30T0 (M2)', 'F80 F82 F87, S55 (M2C M3 M4)'] },
    { model: 'M340i / M440i', chassis: 'G20 G22', categoryTokens: ['G-Chassis, B58 Gen 2'] },
    { model: 'Z4 M40i',       chassis: 'G29',     categoryTokens: ['G-Chassis, B58 Gen 2'] },
  ],
  Audi: [
    { model: 'RS6 / RS7',  chassis: 'C8',    categoryTokens: ['RS6 RS7, 4.0 V8 TFSI (C8)'] },
    { model: 'RS3 / TTRS', chassis: '8V 8Y', categoryTokens: ['RS3 TT RS, 2.5 TFSI (8V 8Y 8S)'] },
    { model: 'A3 / S3',    chassis: '8V 8Y', categoryTokens: ['A3 S3 TT, 2.0 TFSI EA888 (8V 8S)'] },
  ],
  VW: [
    // Newer chassis on top, older below — per shop owner brief.
    { model: 'Golf GTI / R', chassis: 'Mk8', categoryTokens: ['Golf, 2.0T EA888 Gen 4 (Mk 8 MQB Evo)'] },
    { model: 'Golf GTI / R', chassis: 'Mk7', categoryTokens: ['Golf, 1.8T / 2.0T EA888 (Mk 7/7.5 MQB)'] },
  ],
  Toyota: [
    {
      model: 'GR Supra',
      chassis: 'A90',
      categoryTokens: ['GR Supra, 3.0T B58 (MK5)'],
      // GR Supra A90 shares the BMW B58 engine; do88 ships its B58
      // intercooler / oil cooler / front-radiator / intake-filter SKUs
      // (ICM-430-G/K, OC-190, WC-400, WC-410, LF-230-Filter, ICM-430-440-Kit)
      // listed under both BMW G-chassis and Toyota Supra A90 on
      // do88performance.eu. We mirror that — pull anything categorized under
      // BMW G-chassis whose title flags B58/G-Serie/Supra.
      sharedCategoryTokens: ['G-Chassis, B58 Gen 2'],
      sharedTitleMustInclude: ['B58', 'G-Serie', 'Supra', 'GR Supra', 'A90'],
    },
    { model: 'GR Yaris', chassis: 'GXPA16', categoryTokens: ['GR Yaris, 1.6T G16E-GTS (GXPA16)'] },
  ],
} as const;
