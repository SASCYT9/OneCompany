/**
 * Per-SKU enrichment data scraped from do88.se official product pages.
 *
 * For featured SKUs we override the auto-generated enriched description
 * (do88DescriptionEnricher.ts) with the real published technical facts —
 * core dimensions, CFM, temperature deltas, OE-part numbers, etc.
 *
 * Format: keyed by SKU exactly as it appears in product.sku from the
 * supplier feed (e.g. "ICM-400", "BIG-310-T"). Lookup is case-insensitive.
 *
 * Two layers, manual entries take priority:
 *   1) DO88_PRODUCT_SPECS — hand-tuned showcase entries
 *   2) DO88_GENERATED_SPECS — auto-built by `node scripts/do88/generate-specs.mjs`
 *      from a do88.se sitemap scrape
 */

import { DO88_GENERATED_SPECS } from './do88GeneratedSpecs';

export type Do88ProductSpec = {
  /** Short headline used as shortDescription. ~150-200 chars max. */
  headline: { ua: string; en: string };
  /** Compatibility line printed under the headline. Optional — generic
   *  components don't have a single fitment. */
  fitment?: { ua: string; en: string };
  /** Sections of bullet content. Each section has an optional kicker label. */
  sections: Array<{
    kicker?: { ua: string; en: string };
    bullets: { ua: string[]; en: string[] };
  }>;
  /** OE part numbers this part replaces (for buyers searching by OE ref). */
  replacesOe?: string[];
};

export const DO88_PRODUCT_SPECS: Record<string, Do88ProductSpec> = {
  'ICM-400': {
    headline: {
      ua: 'Інтеркулерний комплект do88 для Porsche 911 Turbo / Turbo S (992). Знижує температуру наддуву на 12 °C і дає +8% повітряного потоку проти OE.',
      en: 'do88 intercooler kit for Porsche 911 Turbo / Turbo S (992). 12 °C lower intake temperature and 8% more airflow than OE.',
    },
    fitment: {
      ua: 'Porsche 911 Turbo / Turbo S (992.1), 2020+',
      en: 'Porsche 911 Turbo / Turbo S (992.1), 2020+',
    },
    sections: [
      {
        kicker: { ua: 'Продуктивність', en: 'Performance' },
        bullets: {
          ua: [
            'Температура наддуву: 36 °C проти 48 °C OE — на 12 °C нижче',
            'Повітряний потік: 799 CFM при 0,125 bar / 1,81 psi падіння — +8% vs OE 740 CFM',
            'Тестово: Porsche 911 Turbo S, 757 к.с. (з апгрейдом ECU + вихлоп)',
            'Замір: AIM racelogger, 4 заїзди 50–250 км/год підряд без охолодження',
            'Перевірено на стенді Superflow SF-1020',
          ],
          en: [
            'Intake temperature: 36 °C vs 48 °C OE — 12 °C lower',
            'Airflow: 799 CFM at 0.125 bar / 1.81 psi drop — +8% vs OE 740 CFM',
            'Reference vehicle: Porsche 911 Turbo S, 757 hp (ECU + exhaust upgrade)',
            'Method: AIM racelogger, four 50–250 km/h pulls back-to-back, no cooldown',
            'Verified on Superflow SF-1020 flow bench',
          ],
        },
      },
      {
        kicker: { ua: 'Конструкція', en: 'Construction' },
        bullets: {
          ua: [
            'Bar & Plate осердя Garrett Motorsport, товщина 105 мм',
            '3D-freeform литі алюмінієві бачки — оптимізовано через CFD та 3D-друк',
            'Карбонові повітроводи з prepreg-карбону вакуумного формування',
            'CNC-зʼєднання Ø 70 мм (2,75") — без вузьких місць у системі',
            'Порти 2× 1/8" NPT для методанолового впорскування',
          ],
          en: [
            'Garrett Motorsport Bar & Plate core, 105 mm thick',
            '3D-freeform cast aluminium tanks — CFD-optimised, 3D-printed prototypes',
            'Vacuum-formed pre-preg carbon-fibre airflow guides',
            'CNC-machined Ø 70 mm (2.75") connections — no system bottlenecks',
            '2× 1/8" NPT ports for methanol injection',
          ],
        },
      },
      {
        kicker: { ua: 'У комплекті', en: 'In the box' },
        bullets: {
          ua: [
            'Інтеркулерний модуль: 2 осердя + центральний литий бачок',
            'Карбонові повітроводи з ущільненнями',
            'Силіконові патрубки do88',
            'Хомути та монтажні аксесуари',
          ],
          en: [
            'Intercooler assembly: 2 cores + central cast tank',
            'Carbon-fibre air guides with seals',
            'do88 silicone hoses',
            'Clamps and mounting accessories',
          ],
        },
      },
    ],
    replacesOe: [
      '992145805G',
      '992145816C',
      '992145817B',
      '992145928D',
      '992145927D',
      '992145737',
      '992145738',
    ],
  },
};

export function getDo88ProductSpec(sku: string | null | undefined): Do88ProductSpec | null {
  if (!sku) return null;
  const normalized = sku.trim().toUpperCase();
  return DO88_PRODUCT_SPECS[normalized] ?? DO88_GENERATED_SPECS[normalized] ?? null;
}
