import type { ShopProduct } from '@/lib/shopCatalog';

export const RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG =
  'racechip-gts5-bmw-x6-g06-from-2019-30-d-mild-hybrid-2993ccm-298hp-219kw-650nm';

const racechipGts5BlackImage =
  'https://www.racechip.eu/media/wysiwyg/product_overlay/gts-black-three-quarter.png';

const x6G06_30dMildHybrid298DescriptionEn = `<div class="racechip-specs">
<h3>Performance Upgrade</h3>
<ul>
  <li><strong>Vehicle:</strong> BMW X6 G06</li>
  <li><strong>Engine:</strong> 2993cc / 298 HP (219 kW) / 650 Nm</li>
  <li><strong>Power Gain:</strong> +42 HP / +54 Nm</li>
  <li><strong>Total After Tuning:</strong> 340 HP / 704 Nm</li>
  <li><strong>Module:</strong> RaceChip GTS 5 Black - Maximum Driving Dynamics</li>
  <li><strong>App Control:</strong> Included in price - smartphone control via RaceChip App</li>
</ul>
<h3>What's Included</h3>
<ul>
  <li>RaceChip GTS 5 Black tuning module</li>
  <li>RaceChip App Control module</li>
  <li>Vehicle-specific wiring kit</li>
  <li>RaceChip safety package</li>
  <li>Up to 15% fuel savings</li>
</ul>
<p><em>Easy plug & play installation. No permanent modifications to your vehicle.</em></p>
</div>`;

const x6G06_30dMildHybrid298DescriptionUa = `<div class="racechip-specs">
<h3>Збільшення потужності</h3>
<ul>
  <li><strong>Автомобіль:</strong> BMW X6 G06</li>
  <li><strong>Двигун:</strong> 2993cc / 298 к.с. (219 кВт) / 650 Нм</li>
  <li><strong>Приріст:</strong> +42 к.с. / +54 Нм</li>
  <li><strong>Після тюнінгу:</strong> 340 к.с. / 704 Нм</li>
  <li><strong>Модуль:</strong> RaceChip GTS 5 Black - максимальна динаміка</li>
  <li><strong>App Control:</strong> Включено в ціну - керування зі смартфону через RaceChip App</li>
</ul>
<h3>Що входить в комплект</h3>
<ul>
  <li>Тюнінг-модуль RaceChip GTS 5 Black</li>
  <li>Модуль RaceChip App Control</li>
  <li>Проводка під конкретний двигун</li>
  <li>Пакет безпеки RaceChip</li>
  <li>Економія палива до 15%</li>
</ul>
<p><em>Проста plug & play установка. Без постійних модифікацій автомобіля.</em></p>
</div>`;

export const RACECHIP_CATALOG_FALLBACK_PRODUCTS: ShopProduct[] = [
  {
    slug: RACECHIP_X6_G06_30D_MILD_HYBRID_298HP_SLUG,
    sku: 'RC-GTS5-BMW-30-D-MILD-HYBRID-2993CCM-298HP-219KW-650NM',
    scope: 'auto',
    brand: 'RaceChip',
    vendor: 'RaceChip',
    productType: 'Chip Tuning',
    tags: [
      'car_make:bmw',
      'car_model:x6-g06-from-2019',
      'car_engine:30-d-mild-hybrid-2993ccm-298hp-219kw-650nm',
      'tier:gts5',
      'app_control',
      'chip_tuning',
      'ccm:2993',
      'base_hp:298',
      'gain_hp:42',
      'gain_nm:54',
    ],
    title: {
      ua: 'RaceChip GTS 5 Black - BMW X6 G06 (2019+) 30 D MILD HYBRID 2993CC',
      en: 'RaceChip GTS 5 Black - BMW X6 G06 (2019+) 30 D MILD HYBRID 2993CC',
    },
    category: { ua: 'Чіп-тюнінг', en: 'Chip Tuning' },
    shortDescription: {
      ua: '+42 к.с. / +54 Нм - RaceChip GTS 5 Black з App Control',
      en: '+42 HP / +54 Nm - RaceChip GTS 5 Black with App Control',
    },
    longDescription: {
      ua: x6G06_30dMildHybrid298DescriptionUa,
      en: x6G06_30dMildHybrid298DescriptionEn,
    },
    leadTime: { ua: 'Під замовлення', en: 'By order' },
    stock: 'inStock',
    collection: { ua: 'RaceChip GTS 5 Black', en: 'RaceChip GTS 5 Black' },
    price: { eur: 549, usd: 0, uah: 0 },
    compareAt: { eur: 739, usd: 0, uah: 0 },
    image: racechipGts5BlackImage,
    gallery: [racechipGts5BlackImage],
    highlights: [
      {
        ua: 'Офіційна конфігурація для BMW X6 G06 30 d Mild-Hybrid 298 к.с.',
        en: 'Official configuration for BMW X6 G06 30 d Mild-Hybrid 298 HP',
      },
      {
        ua: 'Приріст RaceChip: +42 к.с. та +54 Нм',
        en: 'RaceChip gain: +42 HP and +54 Nm',
      },
      {
        ua: 'GTS 5 Black з App Control',
        en: 'GTS 5 Black with App Control',
      },
    ],
  },
];

export function getRacechipCatalogFallbackProductBySlug(slug: string) {
  return RACECHIP_CATALOG_FALLBACK_PRODUCTS.find((product) => product.slug === slug);
}
