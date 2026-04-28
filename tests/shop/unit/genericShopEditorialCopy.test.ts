import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGenericShopEditorialCopy,
  isUaBodyEmptyOrLatin,
} from '../../../src/lib/genericShopEditorialCopy';

test('isUaBodyEmptyOrLatin: empty / null / very-short bodies are flagged', () => {
  assert.equal(isUaBodyEmptyOrLatin({}), true);
  assert.equal(isUaBodyEmptyOrLatin({ bodyHtmlUa: '' }), true);
  assert.equal(isUaBodyEmptyOrLatin({ bodyHtmlUa: '<p></p>' }), true);
  assert.equal(isUaBodyEmptyOrLatin({ bodyHtmlUa: 'short' }), true);
});

test('isUaBodyEmptyOrLatin: English-dominant bodies (iPE-style "та" insertions) are flagged', () => {
  const englishBody = `
    The iPE Exhaust system for the iconic BMW M3 (E90/E92/E93) is designed
    та engineered to enhance gas flow та maximize performance gain.
    Highlighting the powerful symphony from its high-flow exhaust system.
  `;
  assert.equal(isUaBodyEmptyOrLatin({ bodyHtmlUa: englishBody }), true);
});

test('isUaBodyEmptyOrLatin: real Ukrainian bodies pass through', () => {
  const realUaBody =
    '<p>Двокомпонентний гальмівний диск GiroDisc A2-034 — пряма заміна штатного ротора. Високотемпературна сталь та алюмінієвий хет.</p>';
  assert.equal(isUaBodyEmptyOrLatin({ bodyHtmlUa: realUaBody }), false);
});

test('buildGenericShopEditorialCopy: OHLINS with empty UA body produces factual subtitle', () => {
  const copy = buildGenericShopEditorialCopy({
    slug: 'ohlins-35020-04',
    titleEn: 'OHLINS 35020-04 EDC Cancellation Kit for BMW M3 (E92)',
    brand: 'OHLINS',
    categoryEn: 'Suspension',
    sku: '35020-04',
  });

  assert.match(copy.shortDescUa, /^Підвіска/);
  assert.match(copy.shortDescUa, /OHLINS/);
  assert.match(copy.shortDescUa, /BMW M3 \(E92\)/);
  assert.match(copy.bodyHtmlUa, /35020-04/);
  assert.ok(!copy.bodyHtmlUa.includes('Urban Automotive'));
  assert.ok(!copy.bodyHtmlUa.includes('стриман'));
});

test('buildGenericShopEditorialCopy: title-derived category overrides generic "Аксесуари (Accessories)" categoryUa', () => {
  const copy = buildGenericShopEditorialCopy({
    slug: 'ipe-bmw-m3-e90-e92-e93-exhaust',
    titleEn: 'iPE BMW M3 E92 Exhaust',
    brand: 'iPE exhaust',
    categoryUa: 'Аксесуари (Accessories)',
    productType: 'Accessories',
    sku: '',
  });

  assert.match(copy.shortDescUa, /Вихлопна система/);
  assert.ok(!copy.shortDescUa.includes('Аксесуари (Accessories)'));
  assert.ok(!copy.shortDescUa.includes('(Accessories)'));
});

test('buildGenericShopEditorialCopy: informative productType is preserved in the subject', () => {
  const copy = buildGenericShopEditorialCopy({
    slug: 'burger-n54-jb4-g5-upgrade-kit',
    titleEn: 'Burger Motorsports N54 JB4 G5 Upgrade Kit',
    brand: 'Burger Motorsports',
    productType: 'JB4 Tuners',
    sku: 'JB4-G5',
  });

  assert.match(copy.shortDescUa, /JB4 Tuners/);
});

test('buildGenericShopEditorialCopy: keeps existing UA title (titleUa) instead of replacing with EN', () => {
  const copy = buildGenericShopEditorialCopy({
    slug: 'csf-8029',
    titleEn: 'CSF 8029 Ultra High-Performance Radiator for PORSCHE 928',
    titleUa: 'CSF 8029 Радіатор Ultra High-Performance для PORSCHE 928',
    brand: 'CSF',
    categoryEn: 'Cooling',
    sku: '8029',
  });

  assert.equal(copy.titleUa, 'CSF 8029 Радіатор Ultra High-Performance для PORSCHE 928');
  assert.match(copy.shortDescUa, /Система охолодження/);
  assert.match(copy.shortDescUa, /Porsche 928/);
});
