import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStockFeedCsv, filterStockFeedItems, type StockFeedItem } from '../../../src/lib/shopStockFeed';

const SAMPLE_ITEMS: StockFeedItem[] = [
  {
    airtableId: 'rec_1',
    ourSku: 'eve_001',
    sku: 'EVE-MFG-001',
    brand: 'Eventuri',
    title: 'Eventuri "Carbon", Intake',
    stockQuantity: 4,
    price: 1250.5,
    priceCurrencyHint: 'USD',
    stockStatus: 'in_stock',
  },
  {
    airtableId: 'rec_2',
    ourSku: 'kw_002',
    sku: 'KW-MFG-002',
    brand: 'KW Suspension',
    title: 'Clubsport\nCoilover',
    stockQuantity: 1,
    price: 999,
    priceCurrencyHint: 'EUR',
    stockStatus: 'in_stock',
  },
];

test('filters stock feed items by SKU prefix across our SKU and manufacturer SKU', () => {
  assert.deepEqual(filterStockFeedItems(SAMPLE_ITEMS, { skuPrefix: 'eve_' }), [SAMPLE_ITEMS[0]]);
  assert.deepEqual(filterStockFeedItems(SAMPLE_ITEMS, { skuPrefix: 'kw-mfg' }), [SAMPLE_ITEMS[1]]);
});

test('filters stock feed items by brand and title fallback text', () => {
  assert.deepEqual(filterStockFeedItems(SAMPLE_ITEMS, { brand: 'eventuri' }), [SAMPLE_ITEMS[0]]);
  assert.deepEqual(filterStockFeedItems(SAMPLE_ITEMS, { brand: 'clubsport' }), [SAMPLE_ITEMS[1]]);
});

test('buildStockFeedCsv produces a UTF-8 BOM CSV with escaped values', () => {
  const csv = buildStockFeedCsv(SAMPLE_ITEMS);

  assert.match(
    csv,
    /^\uFEFFbrand,title,our_sku,manufacturer_sku,stock_qty,stock_status,ua_market_rrp,price_currency_hint,airtable_id\r\n/
  );
  assert.match(csv, /"Eventuri ""Carbon"", Intake"/);
  assert.match(csv, /"Clubsport\r?\nCoilover"/);
  assert.match(csv, /"USD"/);
});
