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

const VOLVO_WC210_SPEC: Do88ProductSpec = {
  headline: {
    ua: 'Алюмінієвий радіатор do88 для Volvo S60 R, V70 R та S80 (1999–2008).',
    en: 'Aluminium do88 radiator for Volvo S60 R, V70 R and S80 (1999–2008).',
  },
  fitment: {
    ua: 'Volvo S60 R / V70 R / S80, 1999–2008',
    en: 'Volvo S60 R / V70 R / S80, 1999–2008',
  },
  sections: [
    {
      kicker: { ua: 'Конструкція', en: 'Construction' },
      bullets: {
        ua: [
          'Площа охолодження на 25% більша за штатну.',
          'Дворядне осердя завтовшки 40 мм із жалюзійним оребренням висотою 6,5 мм.',
          'Під час монтажу повторно використовуються гвинтові фіксатори та втулки штатного радіатора.',
        ],
        en: [
          'Cooling area is 25% larger than the original radiator.',
          'Two-row, 40 mm core with 6.5 mm multi-louvered fins.',
          'Installation reuses the original radiator screw clips and bushings.',
        ],
      },
    },
    {
      kicker: { ua: 'Важливо перед монтажем', en: 'Before installation' },
      bullets: {
        ua: ['Якщо використовується інтеркулер не do88 і не OE, перед замовленням прочитайте крок 24 інструкції з монтажу.'],
        en: ['If using an intercooler other than do88 or OE, read step 24 of the installation instructions before ordering.'],
      },
    },
  ],
};

export const DO88_PRODUCT_SPECS: Record<string, Do88ProductSpec> = {
  'LF-260-FILTER': {
    headline: {
      ua: 'Змінний бавовняний повітряний фільтр для впускної системи do88.',
      en: 'Replacement cotton air filter for the do88 intake system.',
    },
    sections: [
      {
        kicker: { ua: 'Обслуговування', en: 'Maintenance' },
        bullets: {
          ua: [
            'do88 рекомендує очищувати фільтр кожні 10 000 км засобом для бавовняних повітряних фільтрів.',
            'Фільтр постачається без оливи. Для руху в запилених умовах виробник рекомендує нанести оливу для бавовняних фільтрів.',
            'Як приклади засобів do88 наводить BMC Washing Fluid WADET500 та BMC Filter Oil WAFLU250.',
          ],
          en: [
            'do88 recommends cleaning the filter every 10,000 km with a cleaner intended for cotton air filters.',
            'The filter is supplied without oil. For dusty driving conditions, the manufacturer recommends applying cotton filter oil.',
            'The source lists BMC Washing Fluid WADET500 and BMC Filter Oil WAFLU250 as examples.',
          ],
        },
      },
    ],
  },
  'LF-200-FILTER': {
    headline: {
      ua: 'Змінний бавовняний повітряний фільтр для впускної системи do88.',
      en: 'Replacement cotton air filter for the do88 intake system.',
    },
    sections: [
      {
        kicker: { ua: 'Обслуговування', en: 'Maintenance' },
        bullets: {
          ua: [
            'do88 рекомендує очищувати фільтр кожні 10 000 км засобом для бавовняних повітряних фільтрів.',
            'Фільтр постачається без оливи. Для руху в запилених умовах виробник рекомендує нанести оливу для бавовняних фільтрів.',
            'Як приклади засобів do88 наводить BMC Washing Fluid WADET500 та BMC Filter Oil WAFLU250.',
          ],
          en: [
            'do88 recommends cleaning the filter every 10,000 km with a cleaner intended for cotton air filters.',
            'The filter is supplied without oil. For dusty driving conditions, the manufacturer recommends applying cotton filter oil.',
            'The source lists BMC Washing Fluid WADET500 and BMC Filter Oil WAFLU250 as examples.',
          ],
        },
      },
    ],
  },
  'WC-210-MAN': VOLVO_WC210_SPEC,
  'WC-210-AUT': VOLVO_WC210_SPEC,
  'WC-230': {
    headline: {
      ua: 'Алюмінієвий радіатор do88 для Saab 9-3 2.0T (2003+).',
      en: 'Aluminium do88 radiator for the Saab 9-3 2.0T (2003+).',
    },
    fitment: { ua: 'Saab 9-3 2.0T, 2003+', en: 'Saab 9-3 2.0T, 2003+' },
    sections: [
      {
        kicker: { ua: 'Конструкція', en: 'Construction' },
        bullets: {
          ua: [
            'Об’єм осердя 13 488 см³. Виробник наводить порівняння: +83% проти штатного варіанта для автоматичної коробки та +204% для механічної (перераховано з наведених об’ємів 7 360 см³ і 4 439 см³).',
            'Дворядне осердя завтовшки 50 мм із жалюзійним оребренням висотою 8 мм.',
            'Для монтажу без модифікацій дотримуйтесь інструкції виробника; неправильне встановлення може вплинути на гарантію.',
          ],
          en: [
            'Core volume is 13,488 cm³. The source comparisons are +83% for automatic-transmission OE (7,360 cm³) and +204% for manual-transmission OE (4,439 cm³; recalculated from the listed volumes).',
            'Two-row, 50 mm core with 8 mm multi-louvered fins.',
            'Follow the supplier installation instructions for a no-modification fit; incorrect installation may affect warranty coverage.',
          ],
        },
      },
    ],
  },
  'WC-260': {
    headline: {
      ua: 'Алюмінієвий радіатор do88 для Saab 900 Turbo (1979–1993).',
      en: 'Aluminium do88 radiator for Saab 900 Turbo (1979–1993).',
    },
    fitment: { ua: 'Saab 900 Turbo, 1979–1993', en: 'Saab 900 Turbo, 1979–1993' },
    sections: [
      {
        kicker: { ua: 'Конструкція', en: 'Construction' },
        bullets: {
          ua: [
            'Об’єм осердя 7 631 см³ проти 6 096 см³ у штатного радіатора (+25%).',
            'Дворядне осердя завтовшки 40 мм із жалюзійним оребренням висотою 8 мм.',
            'Підключення термовимикача M22 × 1,5; заглушка цього отвору входить у комплект.',
          ],
          en: [
            'Core volume: 7,631 cm³ versus 6,096 cm³ for the original radiator (+25%).',
            'Two-row, 40 mm core with 8 mm multi-louvered fins.',
            'M22 × 1.5 thermo-switch connection; a blanking plug is included.',
          ],
        },
      },
    ],
  },
  'WC-390': {
    headline: {
      ua: 'Алюмінієвий радіатор do88 для BMW 135i/335i/35i з N54 або N55 (2007–2013).',
      en: 'Aluminium do88 radiator for BMW 135i/335i/35i with N54 or N55 (2007–2013).',
    },
    fitment: {
      ua: 'BMW 135i / 335i / 35i, N54/N55, механічна коробка передач, 2007–2013 (E9X/E82/E89)',
      en: 'BMW 135i / 335i / 35i, N54/N55, manual transmission, 2007–2013 (E9X/E82/E89)',
    },
    sections: [
      {
        kicker: { ua: 'Конструкція', en: 'Construction' },
        bullets: {
          ua: [
            'Об’єм осердя 8 616 см³ проти 6 701 см³ штатного (+29%); фронтальна площа 2 154 см² проти 2 094 см² (+3%).',
            'Однорядне осердя завтовшки 40 мм із жалюзійним оребренням висотою 5 мм.',
            'Монтаж на штатне місце; перед встановленням перевірте інструкцію виробника.',
          ],
          en: [
            'Core volume: 8,616 cm³ versus 6,701 cm³ OE (+29%); frontal area: 2,154 cm² versus 2,094 cm² (+3%).',
            'Single-row, 40 mm core with 5 mm multi-louvered fins.',
            'Drop-in installation; check the supplier instructions before fitting.',
          ],
        },
      },
    ],
  },
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
