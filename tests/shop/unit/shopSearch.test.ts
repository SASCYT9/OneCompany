import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShopSearchText,
  hasShopVehicleSearchSignal,
  matchesShopSearchQuery,
  tokenizeShopSearchQuery,
} from '../../../src/lib/shopSearch';

test('matches chassis codes as exact normalized tokens', () => {
  const f90Text = buildShopSearchText(['BMW M5 (F90)', 'Akrapovic Slip-On Line']);
  const sf90Text = buildShopSearchText(['Ferrari SF90', 'GiroDisc rear rotor']);

  assert.equal(matchesShopSearchQuery(f90Text, 'F90'), true);
  assert.equal(matchesShopSearchQuery(sf90Text, 'F90'), false);
});

test('matches multi-token vehicle searches across normalized punctuation', () => {
  const searchText = buildShopSearchText([
    'BMS Elite F9x M5/M8 & M550/M850 Intake',
    'F90 BMW M5 JB4',
  ]);

  assert.equal(matchesShopSearchQuery(searchText, 'BMW F90'), true);
  assert.equal(matchesShopSearchQuery(searchText, 'M5 intake'), true);
  assert.equal(matchesShopSearchQuery(searchText, 'G80'), false);
});

test('keeps useful sku fragments while ignoring one-letter separators', () => {
  assert.deepEqual(tokenizeShopSearchQuery('S-BM/T/27H'), ['bm', '27h']);
});

test('detects vehicle-searchable catalog entries', () => {
  assert.equal(hasShopVehicleSearchSignal(buildShopSearchText(['BMW M5 F90 exhaust'])), true);
  assert.equal(hasShopVehicleSearchSignal(buildShopSearchText(['OHLINS 10216-02 dust boot'])), false);
});
