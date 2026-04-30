import type { ShopProduct } from '@/lib/shopCatalog';
import {
  RACECHIP_MISSING_GTS5_ROWS,
  type RacechipMissingGts5Row,
} from '@/lib/racechipMissingGts5.generated';

export const RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG =
  'racechip-gts5-bmw-x6-g06-from-2019-30-d-mild-hybrid-2993ccm-298hp-219kw-650nm';

type RacechipCatalogFallbackRow = RacechipMissingGts5Row & {
  compareAtEur?: number;
};

const racechipGts5BlackImage =
  'https://www.racechip.eu/media/wysiwyg/product_overlay/gts-black-three-quarter.png';

const RACECHIP_MANUAL_GTS5_ROWS = [
  {
    url: 'https://www.racechip.eu/shop/bmw/x6-g06-from-2019/30-d-mild-hybrid-2993ccm-298hp-219kw-650nm.html',
    makeSlug: 'bmw',
    modelSlug: 'x6-g06-from-2019',
    engineSlug: '30-d-mild-hybrid-2993ccm-298hp-219kw-650nm',
    engineName: '30-d-mild-hybrid',
    ccm: 2993,
    baseHp: 298,
    baseKw: 219,
    baseNm: 650,
    gainHp: 42,
    gainNm: 54,
    priceEur: 739,
  },
] as const satisfies readonly RacechipCatalogFallbackRow[];

const manualFallbackUrls = new Set<string>(RACECHIP_MANUAL_GTS5_ROWS.map((row) => row.url));
const RACECHIP_FALLBACK_ROWS: RacechipCatalogFallbackRow[] = [
  ...RACECHIP_MANUAL_GTS5_ROWS,
  ...RACECHIP_MISSING_GTS5_ROWS.filter((row) => !manualFallbackUrls.has(row.url)),
];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMake(slug: string) {
  const special: Record<string, string> = {
    bmw: 'BMW',
    vw: 'Volkswagen',
    'mercedes-benz': 'Mercedes-Benz',
    'alfa-romeo': 'Alfa Romeo',
    'land-rover': 'Land Rover',
    ds: 'DS',
    mini: 'MINI',
    kia: 'Kia',
    ssangyong: 'SsangYong',
    ldv: 'LDV',
    mclaren: 'McLaren',
  };

  return special[slug] ?? slug.split('-').map(capitalize).join(' ');
}

function formatModel(slug: string) {
  const cleaned = slug
    .replace(/-?from-\d{4}/, '')
    .replace(/-?\d{4}-to-\d{4}/, '')
    .replace(/^-|-$/g, '');

  return cleaned
    .split('-')
    .map((part) => {
      if (/^[a-z]\d+$/i.test(part) || /^\d+$/.test(part) || part.length <= 3) {
        return part.toUpperCase();
      }
      return capitalize(part);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYears(modelSlug: string) {
  const fromMatch = modelSlug.match(/from-(\d{4})/);
  const rangeMatch = modelSlug.match(/(\d{4})-to-(\d{4})/);
  if (rangeMatch) return `${rangeMatch[1]}–${rangeMatch[2]}`;
  if (fromMatch) return `${fromMatch[1]}+`;
  return '';
}

function formatEngine(slug: string) {
  return slug
    .replace(/(\d+)-(\d+)/, '$1.$2')
    .replace(/-/g, ' ')
    .replace(/(\d+)ccm.*/, '$1cc')
    .toUpperCase()
    .trim();
}

function generateSlug(row: RacechipCatalogFallbackRow) {
  return `racechip-gts5-${row.makeSlug}-${row.modelSlug}-${row.engineSlug}`
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

function generateSku(row: RacechipCatalogFallbackRow) {
  return `RC-GTS5-${row.makeSlug}-${row.engineSlug}`
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function generateTitle(row: RacechipCatalogFallbackRow) {
  const make = formatMake(row.makeSlug);
  const model = formatModel(row.modelSlug);
  const years = extractYears(row.modelSlug);
  const engine = formatEngine(row.engineSlug);
  const yearStr = years ? ` (${years})` : '';
  return `RaceChip GTS 5 — ${make} ${model}${yearStr} ${engine}`.trim();
}

function generateDescriptionEn(row: RacechipCatalogFallbackRow) {
  const make = formatMake(row.makeSlug);
  const model = formatModel(row.modelSlug);
  const totalHp = row.baseHp + row.gainHp;
  const totalNm = row.baseNm + row.gainNm;

  return `<div class="racechip-specs">
<h3>Performance Upgrade</h3>
<ul>
  <li><strong>Vehicle:</strong> ${make} ${model}</li>
  <li><strong>Engine:</strong> ${row.ccm}cc / ${row.baseHp} HP (${row.baseKw} kW) / ${row.baseNm} Nm</li>
  <li><strong>Power Gain:</strong> +${row.gainHp} HP / +${row.gainNm} Nm</li>
  <li><strong>Total After Tuning:</strong> ${totalHp} HP / ${totalNm} Nm</li>
  <li><strong>Module:</strong> RaceChip GTS 5 — Maximum Driving Dynamics</li>
  <li><strong>App Control:</strong> ✅ Included in price — full smartphone control via RaceChip App</li>
</ul>
<h3>What's Included</h3>
<ul>
  <li>RaceChip GTS 5 tuning module</li>
  <li>RaceChip App Control module (included, no extra cost)</li>
  <li>7 fine tuning mappings</li>
  <li>RaceChip safety package</li>
  <li>Lifetime software updates</li>
  <li>Up to 15% fuel savings</li>
</ul>
<p><em>Easy plug & play installation. No permanent modifications to your vehicle.</em></p>
</div>`;
}

function generateDescriptionUa(row: RacechipCatalogFallbackRow) {
  const make = formatMake(row.makeSlug);
  const model = formatModel(row.modelSlug);
  const totalHp = row.baseHp + row.gainHp;
  const totalNm = row.baseNm + row.gainNm;

  return `<div class="racechip-specs">
<h3>Збільшення потужності</h3>
<ul>
  <li><strong>Автомобіль:</strong> ${make} ${model}</li>
  <li><strong>Двигун:</strong> ${row.ccm}cc / ${row.baseHp} к.с. (${row.baseKw} кВт) / ${row.baseNm} Нм</li>
  <li><strong>Приріст:</strong> +${row.gainHp} к.с. / +${row.gainNm} Нм</li>
  <li><strong>Після тюнінгу:</strong> ${totalHp} к.с. / ${totalNm} Нм</li>
  <li><strong>Модуль:</strong> RaceChip GTS 5 — Максимальна динаміка</li>
  <li><strong>App Control:</strong> ✅ Вже включено в ціну — повне керування зі смартфону через RaceChip App</li>
</ul>
<h3>Що входить в комплект</h3>
<ul>
  <li>Тюнінг-модуль RaceChip GTS 5</li>
  <li>Модуль RaceChip App Control (включено, без додаткових витрат)</li>
  <li>7 точних налаштувань картографії</li>
  <li>Пакет безпеки RaceChip</li>
  <li>Довічні оновлення софту</li>
  <li>Економія палива до 15%</li>
</ul>
<p><em>Проста plug & play установка. Без постійних модифікацій автомобіля.</em></p>
</div>`;
}

function generateTags(row: RacechipCatalogFallbackRow) {
  return [
    `car_make:${row.makeSlug}`,
    `car_model:${row.modelSlug}`,
    `car_engine:${row.engineSlug}`,
    'tier:gts5',
    'app_control',
    'chip_tuning',
    `ccm:${row.ccm}`,
    `base_hp:${row.baseHp}`,
    `gain_hp:${row.gainHp}`,
    `gain_nm:${row.gainNm}`,
  ];
}

function buildRacechipFallbackProduct(row: RacechipCatalogFallbackRow): ShopProduct {
  const title = generateTitle(row);
  const sku = generateSku(row);
  // row.priceEur is the GTS 5 base price; add fixed 59 EUR App Control add-on
  // to match the main scraper (scripts/scrape-racechip.mjs) which stores total.
  const price = { eur: row.priceEur + 59, usd: 0, uah: 0 };
  const compareAt = row.compareAtEur ? { eur: row.compareAtEur, usd: 0, uah: 0 } : undefined;
  const make = formatMake(row.makeSlug);
  const model = formatModel(row.modelSlug);

  return {
    slug: generateSlug(row),
    sku,
    scope: 'auto',
    brand: 'RaceChip',
    vendor: 'RaceChip',
    productType: 'Chip Tuning',
    tags: generateTags(row),
    title: { ua: title, en: title },
    category: { ua: 'Чіп-тюнінг', en: 'Chip Tuning' },
    shortDescription: {
      ua: `+${row.gainHp} к.с. / +${row.gainNm} Нм — RaceChip GTS 5 з App Control`,
      en: `+${row.gainHp} HP / +${row.gainNm} Nm — RaceChip GTS 5 with App Control`,
    },
    longDescription: {
      ua: generateDescriptionUa(row),
      en: generateDescriptionEn(row),
    },
    leadTime: { ua: 'Під замовлення', en: 'By order' },
    stock: 'inStock',
    collection: { ua: 'RaceChip GTS 5', en: 'RaceChip GTS 5' },
    price,
    compareAt,
    image: racechipGts5BlackImage,
    gallery: [racechipGts5BlackImage],
    highlights: [
      {
        ua: `Офіційна конфігурація RaceChip для ${make} ${model}`,
        en: `Official RaceChip configuration for ${make} ${model}`,
      },
      {
        ua: `Приріст RaceChip: +${row.gainHp} к.с. та +${row.gainNm} Нм`,
        en: `RaceChip gain: +${row.gainHp} HP and +${row.gainNm} Nm`,
      },
      {
        ua: 'GTS 5 з App Control',
        en: 'GTS 5 with App Control',
      },
    ],
    variants: [
      {
        sku: `${sku}-AC`,
        title: 'GTS 5 + App Control',
        inventoryQty: 100,
        isDefault: true,
        price,
        compareAt,
      },
    ],
  };
}

export const RACECHIP_CATALOG_FALLBACK_PRODUCTS: ShopProduct[] =
  RACECHIP_FALLBACK_ROWS.map(buildRacechipFallbackProduct);

export function getRacechipCatalogFallbackProductBySlug(slug: string) {
  return RACECHIP_CATALOG_FALLBACK_PRODUCTS.find((product) => product.slug === slug);
}
