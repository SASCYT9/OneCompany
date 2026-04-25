/**
 * Server-side enrichment for DO88 product descriptions.
 *
 * The supplier's auto-generated descriptions are templated and generic
 * ("Модельний інтеркулер do88 для X. Розроблений для стабільного охолодження…").
 * This module rewrites them into shorter, info-dense descriptions that
 * mirror the technical detail of do88's official product pages — Bar & Plate
 * Garrett cores, drop-in fitment, OE-mounted construction, etc.
 *
 * Only the rendered output is changed; the underlying ShopProduct data is
 * left untouched so source-of-truth remains the supplier sync.
 */

import type { ShopProduct } from '@/lib/shopCatalog';
import { getDo88ProductSpec } from '@/lib/do88ProductSpecs';

type Locale = 'ua' | 'en';

type ProductKind =
  | 'intercooler'
  | 'big-pack'
  | 'radiator'
  | 'oil-cooler'
  | 'intake'
  | 'air-filter'
  | 'hose-kit'
  | 'y-pipe'
  | 'plenum'
  | 'charge-pipe'
  | 'carbon-cover'
  | 'fan'
  | 'silicone-component'
  | 'unknown';

type EnrichedDescription = {
  headline: { ua: string; en: string };
  bullets: { ua: string[]; en: string[] };
};

const INTERCOOLER_RE = /(intercooler|інтеркулер|laddluftkylare)/i;
const BIG_PACK_RE = /(big\s*pack)/i;
const RADIATOR_RE = /(radiator|радіатор|kylare)\b/i;
const OIL_COOLER_RE = /(oil\s*cooler|масляний\s*радіатор|oljekylare)/i;
const INTAKE_RE = /(intake|впуск|insug)/i;
const AIR_FILTER_RE = /(air\s*filter|повітряний\s*фільтр|luftfilter)/i;
const HOSE_KIT_RE = /(hose\s*kit|шлангов|silikon|патрубк|kit\s*\d+|slangkit)/i;
const Y_PIPE_RE = /(y[-\s]?pipe|y[-\s]?труба|y[-\s]?рör)/i;
const PLENUM_RE = /(plenum|пленум)/i;
const CHARGE_PIPE_RE = /(charge\s*pipe|пайп\s*наддуву|tryckrör)/i;
const CARBON_COVER_RE = /(carbon|карбон|kolfiber).*(cover|cap|кришк|kåpa)/i;
const FAN_RE = /(\bfan\b|вентилятор|fläkt)/i;
const SILICONE_RE = /^(?=.*(?:silikon|силікон|hose|шланг|елбоу|elbow|reducer|редук|клямк|t-koppling)).*$/i;

function detectKind(title: string): ProductKind {
  if (BIG_PACK_RE.test(title)) return 'big-pack';
  if (INTERCOOLER_RE.test(title)) return 'intercooler';
  if (CARBON_COVER_RE.test(title)) return 'carbon-cover';
  if (Y_PIPE_RE.test(title)) return 'y-pipe';
  if (PLENUM_RE.test(title)) return 'plenum';
  if (CHARGE_PIPE_RE.test(title)) return 'charge-pipe';
  if (AIR_FILTER_RE.test(title)) return 'air-filter';
  if (INTAKE_RE.test(title)) return 'intake';
  if (RADIATOR_RE.test(title) && !INTERCOOLER_RE.test(title)) return 'radiator';
  if (OIL_COOLER_RE.test(title)) return 'oil-cooler';
  if (HOSE_KIT_RE.test(title)) return 'hose-kit';
  if (FAN_RE.test(title)) return 'fan';
  if (SILICONE_RE.test(title)) return 'silicone-component';
  return 'unknown';
}

/**
 * Extract a clean fitment label (e.g. "Porsche 911 Turbo (992)" or
 * "BMW M2/M3/M4 (G80/G82/G87)") from messy supplier titles.
 */
function detectFitment(title: string): { ua: string; en: string } | null {
  const t = title.replace(/\s+/g, ' ').trim();

  // Porsche — match chassis code 964/993/996/997/991/992 with optional ".1"/".2" generation.
  // Try parens form first ((992), (991.1)), then bare form (997.2, 992).
  if (/porsche/i.test(t)) {
    const porscheChassis =
      t.match(/\((9(?:30|64|93|96|97|91|92)(?:\.\d)?)\)/) ||
      t.match(/\b(9(?:30|64|93|96|97|91|92)(?:\.\d)?)\b/);
    if (porscheChassis) {
      const code = porscheChassis[1];
      const variant = /\bturbo\b|\bтурбо\b/i.test(t)
        ? ' Turbo'
        : /\bcarrera\b/i.test(t)
          ? ' Carrera'
          : /\bgt2\b/i.test(t)
            ? ' GT2'
            : /\bgt3\b/i.test(t)
              ? ' GT3'
              : '';
      return {
        ua: `Porsche 911${variant} (${code})`,
        en: `Porsche 911${variant} (${code})`,
      };
    }
  }
  // Porsche Cayman/Boxster
  if (/porsche/i.test(t) && /(cayman|boxster)/i.test(t)) {
    return { ua: 'Porsche Cayman / Boxster', en: 'Porsche Cayman / Boxster' };
  }

  // BMW G8X / F8X with S58/S55
  const bmwMpattern = t.match(/BMW[\s,]*M[234]?(?:[\s/,]*M[234])*[\s,]*(?:\(?([GF]8[027])(?:[/,\s]*([GF]8[027]))*\)?|[GF]8[027])/i);
  if (bmwMpattern) {
    const codes: string[] = [];
    const mAll = t.match(/[GF]8[027]/gi) || [];
    mAll.forEach((c) => {
      if (!codes.includes(c.toUpperCase())) codes.push(c.toUpperCase());
    });
    return {
      ua: `BMW M2/M3/M4 (${codes.join('/')})`,
      en: `BMW M2/M3/M4 (${codes.join('/')})`,
    };
  }

  // BMW G20/G22 etc with B58
  const bmwG20 = t.match(/BMW[^.]*\b(G[12]0|G[12]2|G29)\b/i);
  if (bmwG20) {
    return {
      ua: `BMW (${bmwG20[1].toUpperCase()}, B58)`,
      en: `BMW (${bmwG20[1].toUpperCase()}, B58)`,
    };
  }

  // Audi RS6/RS7 C8
  if (/audi.*rs[67]/i.test(t)) {
    return {
      ua: 'Audi RS6 / RS7 (C8, 4.0 TFSI V8)',
      en: 'Audi RS6 / RS7 (C8, 4.0 TFSI V8)',
    };
  }

  // Audi RS3 / TTRS
  if (/(rs3|tt\s*rs)/i.test(t)) {
    return {
      ua: 'Audi RS3 / TT RS (8V/8Y/8S, 2.5 TFSI)',
      en: 'Audi RS3 / TT RS (8V/8Y/8S, 2.5 TFSI)',
    };
  }

  // Audi A3/S3 8V/8Y
  if (/audi.*(?:a3|s3).*(8v|8y)/i.test(t)) {
    return {
      ua: 'Audi A3 / S3 (8V/8Y)',
      en: 'Audi A3 / S3 (8V/8Y)',
    };
  }

  // VW Golf Mk7/Mk8
  const golfMatch = t.match(/(?:golf|VW)\s*(?:gti|r)?\s*(mk[78](?:\.5)?)/i);
  if (golfMatch) {
    return {
      ua: `VW Golf GTI / R (${golfMatch[1].toUpperCase()})`,
      en: `VW Golf GTI / R (${golfMatch[1].toUpperCase()})`,
    };
  }

  // Toyota Supra A90 / GR Yaris
  if (/supra.*a90/i.test(t)) {
    return { ua: 'Toyota GR Supra (A90, B58)', en: 'Toyota GR Supra (A90, B58)' };
  }
  if (/yaris/i.test(t)) {
    return { ua: 'Toyota GR Yaris', en: 'Toyota GR Yaris' };
  }

  return null;
}

const COPY: Record<ProductKind, EnrichedDescription> = {
  intercooler: {
    headline: {
      ua: 'do88 інтеркулер прямого монтажу. Більший обʼєм осердя для стабільної температури наддуву на трасі та треку.',
      en: 'Drop-in do88 intercooler kit. Larger core volume for stable charge-air temperatures on street and track.',
    },
    bullets: {
      ua: [
        'Bar & Plate осердя Garrett — кращий теплообмін vs OE',
        'Drop-in посадка на штатному місці без модифікацій',
        'Литі кінцеві бачки CAD-розробка для оптимальних потоків',
        'Силіконові зʼєднання do88 з армуванням входять у комплект',
      ],
      en: [
        'Bar & Plate Garrett core — better heat transfer than OEM',
        'Drop-in fitment in factory location, no cutting',
        'CAD-designed cast end tanks for optimised flow',
        'Reinforced do88 silicone connectors included',
      ],
    },
  },
  'big-pack': {
    headline: {
      ua: 'Big Pack — комплектний апгрейд охолодження do88 в одному наборі.',
      en: 'Big Pack — complete do88 cooling upgrade bundled together.',
    },
    bullets: {
      ua: [
        'Інтеркулер, патрубки та впускні елементи в одному комплекті',
        'Усі компоненти підібрано та протестовано під одне шасі',
        'Drop-in монтаж без перероблення штатних кріплень',
      ],
      en: [
        'Intercooler, hoses and intake elements bundled together',
        'Components selected and tested for a single chassis',
        'Drop-in installation, no chassis modifications',
      ],
    },
  },
  radiator: {
    headline: {
      ua: 'do88 радіатор підвищеної продуктивності. Алюмінієва конструкція, OE-посадка.',
      en: 'do88 high-performance radiator. Aluminium construction, OE fitment.',
    },
    bullets: {
      ua: [
        'Збільшена ємність охолоджувальної рідини',
        'Ущільнена сердцевина для кращого теплообміну',
        'Drop-in заміна штатного радіатора',
        'Тестовано в трекових умовах',
      ],
      en: [
        'Increased coolant capacity',
        'Denser core for better heat transfer',
        'Drop-in replacement for OE radiator',
        'Track-tested cooling performance',
      ],
    },
  },
  'oil-cooler': {
    headline: {
      ua: 'do88 масляний радіатор для тривалих навантажень.',
      en: 'do88 oil cooler kit for sustained load.',
    },
    bullets: {
      ua: [
        'Збільшена поверхня теплообміну',
        'Армовані шланги з фітингами AN',
        'Кронштейни кріплення в комплекті',
        'OE-сумісність датчиків температури',
      ],
      en: [
        'Increased heat-exchange surface',
        'Reinforced lines with AN fittings',
        'Mounting brackets included',
        'OE temperature sensor compatibility',
      ],
    },
  },
  intake: {
    headline: {
      ua: 'do88 впускна система. Чистіший потік повітря, ізоляція від тепла.',
      en: 'do88 intake system. Cleaner airflow with thermal isolation.',
    },
    bullets: {
      ua: [
        'Збільшений переріз повітроводів',
        'Тепловий барʼєр моторного відсіку',
        'Сумісний з ОЕ-датчиками MAF',
        'Не потребує перепрошивки ECU',
      ],
      en: [
        'Larger duct cross-section',
        'Engine-bay heat barrier',
        'Compatible with OE MAF sensor',
        'No ECU re-flash required',
      ],
    },
  },
  'air-filter': {
    headline: {
      ua: 'BMC конусний повітряний фільтр для кастомних впускних систем.',
      en: 'BMC conical air filter for custom intake systems.',
    },
    bullets: {
      ua: [
        'Прокачаний потік повітря vs паперовий ОЕ-фільтр',
        'Багаторазовий — обслуговується мийкою BMC',
        'Сумісний зі стандартними монтажними діаметрами',
      ],
      en: [
        'Higher airflow vs paper OEM filter',
        'Reusable — BMC wash kit serviceable',
        'Compatible with standard mounting diameters',
      ],
    },
  },
  'hose-kit': {
    headline: {
      ua: 'Комплект силіконових патрубків do88. Армований силікон 4-шарової конструкції.',
      en: 'do88 silicone hose kit. 4-ply reinforced silicone construction.',
    },
    bullets: {
      ua: [
        'Витримує вищі температури та тиск vs ОЕ-гума',
        'Усі патрубки контуру в одному комплекті',
        'Хомути з нержавіючої сталі в комплекті',
        'Колір на вибір (де доступно)',
      ],
      en: [
        'Withstands higher temperatures & pressures vs OE rubber',
        'Complete circuit hoses in one kit',
        'Stainless steel clamps included',
        'Colour options where available',
      ],
    },
  },
  'y-pipe': {
    headline: {
      ua: 'Y-труба наддуву do88. Точна геометрія потоку, drop-in заміна ОЕ.',
      en: 'do88 Y-pipe for charge-air. Precise flow geometry, drop-in OE replacement.',
    },
    bullets: {
      ua: [
        'Гладкі внутрішні переходи — мінімум турбулентності',
        'Алюмінієва конструкція з якісними зʼєднаннями',
        'Підготовка до високих рівнів буста',
      ],
      en: [
        'Smooth internal transitions — minimal turbulence',
        'Aluminium construction with quality connections',
        'Ready for elevated boost levels',
      ],
    },
  },
  plenum: {
    headline: {
      ua: 'do88 пленум впуску. Збільшений обʼєм для рівномірного розподілу повітря.',
      en: 'do88 intake plenum. Increased volume for even air distribution.',
    },
    bullets: {
      ua: [
        'Покращене наповнення циліндрів на високих обертах',
        'Сумісний з ОЕ-кріпленнями та датчиками',
        'Алюмінієва конструкція',
      ],
      en: [
        'Improved cylinder fill at high RPM',
        'Compatible with OE mounts and sensors',
        'Aluminium construction',
      ],
    },
  },
  'charge-pipe': {
    headline: {
      ua: 'Алюмінієвий пайп наддуву do88. Заміна пластикового ОЕ-елемента, схильного до тріщин.',
      en: 'do88 aluminium charge pipe. Replaces failure-prone plastic OE component.',
    },
    bullets: {
      ua: [
        'Витримує підвищений тиск наддуву',
        'Стабільна геометрія за будь-якої температури',
        'Drop-in посадка',
      ],
      en: [
        'Withstands elevated boost pressure',
        'Stable geometry under any temperature',
        'Drop-in fitment',
      ],
    },
  },
  'carbon-cover': {
    headline: {
      ua: 'Карбонові кришки моторного відсіку do88. Завершений візуал в духі OEM+.',
      en: 'do88 carbon engine bay covers. OEM+ finished look.',
    },
    bullets: {
      ua: [
        'Pre-preg карбон, лакована поверхня',
        'Точна посадка на ОЕ-кріплення',
        'Полегшення відносно сток-кришок',
      ],
      en: [
        'Pre-preg carbon, lacquered finish',
        'Precise fit on OE mounts',
        'Weight reduction vs stock covers',
      ],
    },
  },
  fan: {
    headline: {
      ua: 'Електровентилятор охолодження do88.',
      en: 'do88 cooling fan assembly.',
    },
    bullets: {
      ua: [
        'Підвищена продуктивність vs ОЕ',
        'Drop-in заміна оригінального вузла',
      ],
      en: [
        'Higher airflow vs OE',
        'Drop-in replacement for original assembly',
      ],
    },
  },
  'silicone-component': {
    headline: {
      ua: 'Силіконовий компонент do88 для кастомної збірки контуру.',
      en: 'do88 silicone component for custom plumbing builds.',
    },
    bullets: {
      ua: [
        'Армований 4-шаровий силікон',
        'Стійкість до тиску, температури та масла',
        'Кольори: чорний, синій, червоний (де доступно)',
      ],
      en: [
        '4-ply reinforced silicone',
        'Resistant to pressure, heat & oil',
        'Colours: black, blue, red (where available)',
      ],
    },
  },
  unknown: {
    headline: {
      ua: 'Компонент do88 преміум-сегменту. Шведська інженерія, прецизійне виробництво.',
      en: 'Premium do88 component. Swedish engineering, precision manufacturing.',
    },
    bullets: {
      ua: [
        'Розроблено для автомобілів, що інтенсивно експлуатуються',
        'OE-якість зʼєднань і покриттів',
      ],
      en: [
        'Developed for vehicles in demanding service',
        'OE-quality connections and finishes',
      ],
    },
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildDo88EnrichedDescription(
  product: Pick<ShopProduct, 'title' | 'brand' | 'sku'>,
  locale: Locale,
): { shortDescription: string; longDescriptionHtml: string; bullets: string[] } | null {
  if (product.brand.toLowerCase() !== 'do88') return null;

  // 1) Per-SKU curated content (do88.se official scraped data) wins.
  const curated = getDo88ProductSpec(product.sku);
  if (curated) {
    const headline = locale === 'ua' ? curated.headline.ua : curated.headline.en;
    const fitmentLabel = curated.fitment
      ? (locale === 'ua' ? curated.fitment.ua : curated.fitment.en)
      : null;

    const flatBullets: string[] = [];
    const sectionHtmlParts: string[] = [];
    curated.sections.forEach((section) => {
      const sectionBullets = locale === 'ua' ? section.bullets.ua : section.bullets.en;
      flatBullets.push(...sectionBullets);
      const kicker = section.kicker ? (locale === 'ua' ? section.kicker.ua : section.kicker.en) : null;
      const items = sectionBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
      sectionHtmlParts.push(
        kicker
          ? `<h3>${escapeHtml(kicker)}</h3><ul>${items}</ul>`
          : `<ul>${items}</ul>`,
      );
    });

    const headParts: string[] = [`<p>${escapeHtml(headline)}</p>`];
    if (fitmentLabel) {
      headParts.push(
        `<p><strong>${locale === 'ua' ? 'Сумісність' : 'Fitment'}:</strong> ${escapeHtml(fitmentLabel)}</p>`,
      );
    }
    if (curated.replacesOe && curated.replacesOe.length > 0) {
      const oeLabel = locale === 'ua' ? 'Замінює OE-номери' : 'Replaces OE numbers';
      const oeList = curated.replacesOe.map((n) => `<code>${escapeHtml(n)}</code>`).join(' · ');
      sectionHtmlParts.push(`<h3>${escapeHtml(oeLabel)}</h3><p class="do88-oe-list">${oeList}</p>`);
    }

    const shortDescription = fitmentLabel
      ? `${headline} ${locale === 'ua' ? 'Сумісність' : 'Fitment'}: ${fitmentLabel}.`
      : headline;

    return {
      shortDescription,
      longDescriptionHtml: `${headParts.join('')}${sectionHtmlParts.join('')}`,
      bullets: flatBullets,
    };
  }

  // 2) Fallback: kind-based generic enriched copy.
  const titleSource = `${product.title.ua} ${product.title.en}`;
  const kind = detectKind(titleSource);
  const fitment = detectFitment(titleSource);
  const copy = COPY[kind];

  const headline = locale === 'ua' ? copy.headline.ua : copy.headline.en;
  const bullets = locale === 'ua' ? copy.bullets.ua : copy.bullets.en;
  const fitmentLabel = fitment ? (locale === 'ua' ? fitment.ua : fitment.en) : null;

  const shortDescription = fitmentLabel
    ? (locale === 'ua' ? `${headline} Сумісність: ${fitmentLabel}.` : `${headline} Fitment: ${fitmentLabel}.`)
    : headline;

  const escapedHeadline = escapeHtml(headline);
  const fitmentLine = fitmentLabel
    ? `<p><strong>${locale === 'ua' ? 'Сумісність' : 'Fitment'}:</strong> ${escapeHtml(fitmentLabel)}</p>`
    : '';
  const longDescriptionHtml = `<p>${escapedHeadline}</p>${fitmentLine}`;

  return {
    shortDescription,
    longDescriptionHtml,
    bullets,
  };
}
