import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveIpeProductLine,
  resolveIpeProductMaterials,
  resolveIpeProductSpecs,
  resolveIpeVehicleBrand,
  resolveIpeVehicleModel,
} from '../../../src/lib/ipeCatalog';

test('resolveIpeVehicleBrand prefers canonical brand tags when present', () => {
  assert.equal(
    resolveIpeVehicleBrand({
      tags: ['Porsche', 'Valvetronic Exhaust'],
      title: { en: 'Titanium System', ua: 'Титанова система' },
      collection: { en: '', ua: '' },
    }),
    'Porsche'
  );
});

test('resolveIpeVehicleBrand falls back to title and collection text when tags are missing', () => {
  assert.equal(
    resolveIpeVehicleBrand({
      tags: [],
      title: { en: 'BMW G80 M3 Valvetronic Exhaust', ua: 'BMW G80 M3 Valvetronic Exhaust' },
      collection: { en: 'BMW', ua: 'BMW' },
    }),
    'BMW'
  );

  assert.equal(
    resolveIpeVehicleBrand({
      tags: [],
      title: { en: 'Titanium System for 992 GT3', ua: 'Titanium System for 992 GT3' },
      collection: { en: 'Porsche 911', ua: 'Porsche 911' },
    }),
    'Porsche'
  );
});

test('resolveIpeVehicleBrand supports additional imported makes', () => {
  assert.equal(
    resolveIpeVehicleBrand({
      tags: [],
      title: { en: 'Volkswagen Golf R (Mk8) Exhaust System', ua: 'Volkswagen Golf R (Mk8) Exhaust System' },
      collection: { en: 'Volkswagen', ua: 'Volkswagen' },
    }),
    'Volkswagen'
  );

  assert.equal(
    resolveIpeVehicleBrand({
      tags: [],
      title: { en: 'Nissan Z (RZ34) Exhaust System', ua: 'Nissan Z (RZ34) Exhaust System' },
      collection: { en: 'Nissan', ua: 'Nissan' },
    }),
    'Nissan'
  );
});

test('resolveIpeProductLine classifies exhaust and control products consistently', () => {
  assert.equal(
    resolveIpeProductLine({
      tags: ['Porsche', 'cat-back'],
      title: { en: 'Porsche 911 GT3 Cat Back Exhaust System', ua: 'Porsche 911 GT3 Cat Back Exhaust System' },
      collection: { en: 'Porsche', ua: 'Porsche' },
    }),
    'Valvetronic Exhaust'
  );

  assert.equal(
    resolveIpeProductLine({
      tags: ['BMW', 'remote-control'],
      title: { en: 'BMW M3 Remote Control Upgrade', ua: 'BMW M3 Remote Control Upgrade' },
      collection: { en: 'BMW', ua: 'BMW' },
    }),
    'Controls / Electronics'
  );

  assert.equal(
    resolveIpeProductLine({
      tags: ['Downpipes & Headers', 'iPE', 'Exhaust'],
      title: { en: 'Maserati GranTurismo 4.2 Exhaust System', ua: 'Maserati GranTurismo 4.2 Exhaust System' },
      collection: { en: 'Downpipes & Headers', ua: 'Downpipes & Headers' },
    }),
    'Downpipe / Cats'
  );

  assert.equal(
    resolveIpeProductLine({
      tags: ['full-system', 'remote-control'],
      title: { en: 'BMW M2 Full System Exhaust', ua: 'BMW M2 Full System Exhaust' },
      collection: { en: 'BMW', ua: 'BMW' },
    }),
    'Valvetronic Exhaust'
  );

  assert.equal(
    resolveIpeProductLine({
      tags: ['Audi', 'downpipe'],
      title: { en: 'Audi RS3 Catted Downpipe', ua: 'Audi RS3 Catted Downpipe' },
      collection: { en: 'Audi', ua: 'Audi' },
    }),
    'Downpipe / Cats'
  );
});

test('resolveIpeVehicleModel prefers specific fitment tags over generic brand tags', () => {
  assert.equal(
    resolveIpeVehicleModel({
      tags: ['BMW', '2023', 'M2 (G87)', 'Titanium', 'iPE exhaust'],
      title: { en: 'BMW M2 (G87) Exhaust System', ua: 'BMW M2 (G87) Exhaust System' },
      collection: { en: 'BMW', ua: 'BMW' },
    }),
    'M2 (G87)'
  );

  assert.equal(
    resolveIpeVehicleModel({
      tags: ['BMW', 'iPE Official', 'carbon-fiber', '2023'],
      title: { en: 'BMW M2 (G87) Exhaust System', ua: 'BMW M2 (G87) Exhaust System' },
      collection: { en: 'BMW', ua: 'BMW' },
    }),
    'M2 (G87)'
  );
});

test('resolveIpeVehicleModel ignores option and upgrade service tags', () => {
  assert.equal(
    resolveIpeVehicleModel({
      tags: ['upgrade', 'Accessories', 'iPE', 'McLaren', '2011', 'MP4-12C', 'Titanium'],
      title: { en: 'McLaren MP4-12C (Titanium) Exhaust System', ua: 'McLaren MP4-12C (Titanium) Exhaust System' },
      collection: { en: 'McLaren', ua: 'McLaren' },
    }),
    'MP4-12C'
  );

  assert.equal(
    resolveIpeVehicleModel({
      tags: ['tips', 'Accessories', 'iPE', 'Option', 'Porsche', 'Titanium Blue Tips', 'titanium-blue'],
      title: { en: 'Titanium Blue Tips', ua: 'Titanium Blue Tips' },
      collection: { en: 'Porsche', ua: 'Porsche' },
    }),
    null
  );
});

test('resolveIpeProductMaterials and specs derive facetable values from tags/title', () => {
  assert.deepEqual(
    resolveIpeProductMaterials({
      tags: ['Titanium', 'Carbon Fiber'],
      title: { en: 'Ferrari 296 GTB Titanium Exhaust System', ua: 'Ferrari 296 GTB Titanium Exhaust System' },
    }),
    ['Titanium', 'Carbon Fiber']
  );

  assert.deepEqual(
    resolveIpeProductSpecs({
      tags: ['opf', 'catted', 'remote-control'],
      title: { en: 'Audi RS3 Catted OPF Exhaust with Remote Control', ua: 'Audi RS3 Catted OPF Exhaust with Remote Control' },
    }),
    ['OPF', 'Catted', 'Remote Control']
  );
});
