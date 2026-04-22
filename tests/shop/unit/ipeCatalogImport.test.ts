import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIpeSyntheticVariantSku,
  buildIpeVariantCandidates,
  cleanIpeOfficialHtml,
  computeIpeRetailPrice,
  resolveIpeVariantPricing,
  selectBestIpeProductMatch,
  type IpeOfficialProductSnapshot,
  type IpeParsedPriceListRow,
} from '../../../src/lib/ipeCatalogImport';

const ferrariProduct: IpeOfficialProductSnapshot = {
  id: 'prod-ferrari-296',
  handle: 'ferrari-296-gtb-exhaust-system',
  title: 'Ferrari 296 GTB Exhaust System',
  bodyHtml:
    '<p>Official Ferrari 296 GTB valvetronic exhaust system with titanium construction and OPF-compatible fitment.</p><p>Contact us for shipping information.</p>',
  tags: ['Ferrari', '296 GTB', 'Titanium', 'Full System', 'OPF'],
  vendor: 'Innotech Performance Exhaust',
  productType: 'Exhaust Systems',
  images: ['https://cdn.ipeofficial.com/ferrari-296-1.jpg'],
  url: 'https://ipeofficial.com/products/ferrari-296-gtb-exhaust-system',
  options: [
    { name: 'Material', values: ['Titanium'] },
    { name: 'Exhaust System', values: ['Valvetronic'] },
    { name: 'Tips', values: ['Chrome Black', 'Satin Silver'] },
  ],
  variants: [
    {
      id: 'var-1',
      title: 'Titanium / Valvetronic / Chrome Black',
      sku: null,
      available: true,
      featuredImage: null,
      optionValues: ['Titanium', 'Valvetronic', 'Chrome Black'],
      optionMap: {
        Material: 'Titanium',
        'Exhaust System': 'Valvetronic',
        Tips: 'Chrome Black',
      },
    },
    {
      id: 'var-2',
      title: 'Titanium / Valvetronic / Satin Silver',
      sku: null,
      available: true,
      featuredImage: null,
      optionValues: ['Titanium', 'Valvetronic', 'Satin Silver'],
      optionMap: {
        Material: 'Titanium',
        'Exhaust System': 'Valvetronic',
        Tips: 'Satin Silver',
      },
    },
  ],
};

test('computeIpeRetailPrice applies threshold pricing rule', () => {
  assert.equal(computeIpeRetailPrice(4999), 6499);
  assert.equal(computeIpeRetailPrice(5000), 6600);
  assert.equal(computeIpeRetailPrice(null), null);
});

test('cleanIpeOfficialHtml removes shipping and contact boilerplate but keeps fitment copy', () => {
  const cleaned = cleanIpeOfficialHtml(
    '<div><p>Official Ferrari 296 GTB valvetronic exhaust system with titanium construction.</p><p>Free shipping worldwide.</p><p>Contact us for shipping information.</p><p>OPF-compatible fitment is retained.</p></div>'
  );

  assert.match(cleaned, /Ferrari 296 GTB/);
  assert.match(cleaned, /OPF-compatible fitment/);
  assert.doesNotMatch(cleaned, /Free shipping/i);
  assert.doesNotMatch(cleaned, /Contact us/i);
});

test('selectBestIpeProductMatch prefers the correct official product by semantic signature', () => {
  const row: IpeParsedPriceListRow = {
    page: 1,
    tier: 'Premium Products',
    brand: 'Ferrari',
    model: '296 GTB',
    year_range: '2022 - Current',
    engine: null,
    section: 'Full System',
    sku: '0F296-AVNM0-1',
    material: 'Ti',
    description: 'Titanium Full System ※OPF Version',
    price_kind: 'absolute',
    msrp_usd: 12000,
    import_fee_usd: 1600,
    retail_usd: 13600,
    remarks: null,
    matched_summary_label: null,
    raw_line: 'Ferrari 296 GTB Full System',
  };

  const bmwProduct: IpeOfficialProductSnapshot = {
    ...ferrariProduct,
    id: 'prod-bmw-g80',
    handle: 'bmw-m3-m4-g80-g82-exhaust-system',
    title: 'BMW M3 / M4 (G80 / G82) Exhaust System',
    bodyHtml: '<p>Official BMW G80 / G82 valvetronic exhaust system.</p>',
    tags: ['BMW', 'G80', 'G82', 'Titanium', 'Full System'],
    url: 'https://ipeofficial.com/products/bmw-m3-m4-g80-g82-exhaust-system',
  };

  const selection = selectBestIpeProductMatch(row, [bmwProduct, ferrariProduct]);

  assert.equal(selection.best?.product.handle, ferrariProduct.handle);
  assert.equal(selection.status === 'auto' || selection.status === 'review', true);
  assert.ok((selection.best?.score ?? 0) > 0.75);
});

test('selectBestIpeProductMatch preserves alphanumeric chassis/model tokens like M2 and G87', () => {
  const row: IpeParsedPriceListRow = {
    page: 1,
    tier: 'Premium Products',
    brand: 'BMW',
    model: 'G87-M2',
    year_range: '2023 - Current',
    engine: 'Engine Model : S58',
    section: 'Cat Back System',
    sku: '0BM2-TNVN00-1',
    material: 'Ti',
    description: 'Titanium Cat Back System with Remote Control',
    price_kind: 'absolute',
    msrp_usd: 5200,
    import_fee_usd: 1600,
    retail_usd: 6800,
    remarks: null,
    matched_summary_label: null,
    raw_line: 'BMW G87-M2 Titanium Cat Back System',
  };

  const m2Product: IpeOfficialProductSnapshot = {
    ...ferrariProduct,
    id: 'prod-bmw-g87',
    handle: 'bmw-m2-g87-exhaust-system',
    title: 'BMW M2 (G87) Exhaust System',
    bodyHtml: '<p>Official BMW M2 (G87) exhaust system with S58 fitment.</p>',
    tags: ['BMW', 'M2 (G87)', '2023', 'Titanium'],
    url: 'https://ipeofficial.com/products/bmw-m2-g87-exhaust-system',
  };

  const g30Product: IpeOfficialProductSnapshot = {
    ...ferrariProduct,
    id: 'prod-bmw-g30',
    handle: 'bmw-540i-g30-exhaust-system',
    title: 'BMW 540i (G30) Exhaust System',
    bodyHtml: '<p>Official BMW 540i (G30) exhaust system.</p>',
    tags: ['BMW', '540i (G30)', '2019', 'Stainless Steel'],
    url: 'https://ipeofficial.com/products/bmw-540i-g30-exhaust-system',
  };

  const selection = selectBestIpeProductMatch(row, [g30Product, m2Product]);
  assert.equal(selection.best?.product.handle, m2Product.handle);
  assert.ok((selection.best?.score ?? 0) > 0.45);
});

test('selectBestIpeProductMatch keeps Porsche chassis tokens like 991.2 with Carrera rows', () => {
  const row: IpeParsedPriceListRow = {
    page: 1,
    tier: 'Premium Products',
    brand: 'Porsche',
    model: 'Carrera / Carrera S | 991.2',
    year_range: '2016 - 2019',
    engine: null,
    section: 'Exhaust System',
    sku: '0P9912-A0NM0-1',
    material: 'SS',
    description: 'Valvetronic Exhaust System',
    price_kind: 'absolute',
    msrp_usd: 4600,
    import_fee_usd: 1500,
    retail_usd: 6100,
    remarks: null,
    matched_summary_label: null,
    raw_line: 'Porsche 991.2 Carrera Exhaust System',
  };

  const carreraProduct: IpeOfficialProductSnapshot = {
    ...ferrariProduct,
    id: 'prod-porsche-9912',
    handle: 'porsche-911-carrera-s-4s-gts-991-3-exhaust',
    title: 'Porsche 911 Carrera S / 4S / GTS / 4 GTS (991.2) Exhaust System',
    bodyHtml: '<p>Official Porsche 911 Carrera S / 4S / GTS / 4 GTS (991.2) exhaust system.</p>',
    tags: ['Porsche', '911 Carrera S / 4S / GTS (991.2)', '2016', '2017', '2018', '2019'],
    url: 'https://ipeofficial.com/products/porsche-911-carrera-s-4s-gts-991-3-exhaust',
  };

  const gt4Product: IpeOfficialProductSnapshot = {
    ...ferrariProduct,
    id: 'prod-porsche-718',
    handle: 'porsche-718-cayman-boxster-2-5t-982-with-718-gt4-bodykit-exhaust-system',
    title: 'Porsche 718 Cayman / Boxster 2.5T (982) *With 718 GT4 Bodykit* Exhaust System',
    bodyHtml: '<p>Official Porsche 718 Cayman / Boxster 2.5T (982) exhaust system.</p>',
    tags: ['Porsche', '718 Cayman / Boxster 2.5T (982)', '2016', '2017', '2018', '2019'],
    url: 'https://ipeofficial.com/products/porsche-718-cayman-boxster-2-5t-982-with-718-gt4-bodykit-exhaust-system',
  };

  const selection = selectBestIpeProductMatch(row, [gt4Product, carreraProduct]);
  assert.equal(selection.best?.product.handle, carreraProduct.handle);
  assert.ok((selection.best?.score ?? 0) > 0);
});

test('buildIpeVariantCandidates falls back to absolute rows when official variants are not meaningful', () => {
  const product: IpeOfficialProductSnapshot = {
    ...ferrariProduct,
    options: [],
    variants: [
      {
        id: 'default',
        title: 'Default Title',
        sku: null,
        available: true,
        featuredImage: null,
        optionValues: [],
        optionMap: {},
      },
    ],
  };

  const rows: IpeParsedPriceListRow[] = [
    {
      page: 1,
      tier: 'Premium Products',
      brand: 'Ferrari',
      model: '296 GTB',
      year_range: '2022 - Current',
      engine: null,
      section: 'Full System',
      sku: '0F296-AVNM0-1',
      material: 'Ti',
      description: 'Titanium Full System',
      price_kind: 'absolute',
      msrp_usd: 12000,
      import_fee_usd: 1600,
      retail_usd: 13600,
      remarks: null,
      matched_summary_label: null,
      raw_line: 'Ferrari 296 GTB Titanium Full System',
    },
  ];

  const candidates = buildIpeVariantCandidates(product, rows);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.source, 'absolute-row');
  assert.equal(candidates[0]?.baseRow?.sku, '0F296-AVNM0-1');
});

test('resolveIpeVariantPricing composes base retail with relative deltas without reapplying import fee', () => {
  const rows: IpeParsedPriceListRow[] = [
    {
      page: 1,
      tier: 'Premium Products',
      brand: 'Ferrari',
      model: '296 GTB',
      year_range: '2022 - Current',
      engine: null,
      section: 'Full System',
      sku: '0F296-AVNM0-1',
      material: 'Ti',
      description: 'Titanium Valvetronic Full System ※OPF Version',
      price_kind: 'absolute',
      msrp_usd: 12000,
      import_fee_usd: 1600,
      retail_usd: 13600,
      remarks: null,
      matched_summary_label: null,
      raw_line: 'Ferrari 296 GTB Titanium Full System',
    },
    {
      page: 1,
      tier: 'Premium Products',
      brand: 'Ferrari',
      model: '296 GTB',
      year_range: '2022 - Current',
      engine: null,
      section: 'Tips',
      sku: '1F296-03-BLACK',
      material: 'Ti',
      description: 'Tips (Chrome Black)',
      price_kind: 'relative',
      msrp_usd: 300,
      import_fee_usd: null,
      retail_usd: null,
      remarks: null,
      matched_summary_label: null,
      raw_line: 'Tips (Chrome Black) + $300',
    },
    {
      page: 1,
      tier: 'Premium Products',
      brand: 'Ferrari',
      model: '296 GTB',
      year_range: '2022 - Current',
      engine: null,
      section: 'Tips',
      sku: '1F296-03-SILVER',
      material: 'Ti',
      description: 'Tips (Satin Silver)',
      price_kind: 'relative',
      msrp_usd: 150,
      import_fee_usd: null,
      retail_usd: null,
      remarks: null,
      matched_summary_label: null,
      raw_line: 'Tips (Satin Silver) + $150',
    },
  ];

  const candidate = buildIpeVariantCandidates(ferrariProduct, rows)[0];
  assert.ok(candidate);

  const resolved = resolveIpeVariantPricing(ferrariProduct, candidate, rows);
  assert.equal(resolved.baseRow?.sku, '0F296-AVNM0-1');
  assert.equal(resolved.deltaRows[0]?.sku, '1F296-03-BLACK');
  assert.equal(resolved.priceUsd, 13900);
});

test('buildIpeSyntheticVariantSku is stable for a given handle and signature', () => {
  const one = buildIpeSyntheticVariantSku('ferrari-296-gtb-exhaust-system', 'Titanium|Chrome Black');
  const two = buildIpeSyntheticVariantSku('ferrari-296-gtb-exhaust-system', 'Titanium|Chrome Black');

  assert.equal(one, two);
  assert.match(one, /^IPE-FERRARI-296-GTB-EXHAUST-SYSTEM-[A-Z0-9]{8}$/);
});
