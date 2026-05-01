import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractChassisForBrandAndModel,
  extractProductLine,
  extractVehicleBrand,
  extractVehicleBrands,
  extractVehicleModel,
  extractVehicleModelNamesForBrand,
  extractVehicleModelsForBrand,
} from '../../../src/lib/akrapovicFilterUtils';

test('extractVehicleBrand recognizes Mercedes-AMG titles without an explicit Mercedes-Benz token', () => {
  assert.equal(
    extractVehicleBrand(
      'AKRAPOVIC MTP-ME/T/2H/1 Evolution Line (Titanium) Exhaust System for MERCEDES C63 AMG / C63S (W205 / S205) 2015-2018'
    ),
    'Mercedes-AMG'
  );
});

test('extractVehicleBrand recognizes Porsche models mentioned without the Porsche wordmark', () => {
  assert.equal(
    extractVehicleBrand(
      'AKRAPOVIC P-HF1228 Mounting Kit (for Macan S/Turbo with Non-Sport Exhaust System)'
    ),
    'Porsche'
  );
});

test('extractProductLine classifies valve actuator kits and plain exhaust systems', () => {
  assert.equal(
    extractProductLine(
      'AKRAPOVIC P-HF868 Valve Actuator Kit for CHEVROLET Corvette Stingray / Grand Sport (C7)'
    ),
    'sound-kit'
  );
  assert.equal(
    extractProductLine('AKRAPOVIC S-RE/T/4H Exhaust System RENAULT Megane IV RS'),
    'exhaust-system'
  );
});

test('extractVehicleModel falls back to known model names when no chassis code is present', () => {
  assert.equal(
    extractVehicleModel(
      'AKRAPOVIC S-PO/T/3H Evolution Line Exhaust System (Titanium) for PORSCHE Cayenne / E-Hybrid / S E-Hybrid 2023- (OPF/GPF)'
    ),
    'Cayenne'
  );
  assert.equal(
    extractVehicleModel(
      'AKRAPOVIC S-FE/T/2 Slip-On Race Line Exhaust System (Titanium) for FERRARI 296 GTB/GTS 2023+'
    ),
    '296'
  );
  assert.equal(
    extractVehicleModel(
      'AKRAPOVIC s-BM/T/18h Slip-On Line Exhaust System (Titanium) for BMW M440I (OPF vehicles)'
    ),
    'M440I'
  );
});

test('extractVehicleModelsForBrand keeps shared BMW and Toyota titles brand-specific', () => {
  const title = 'AKRAPOVIC Slip-On Line for BMW Z4 (G29) / Toyota GR Supra (A90)';

  assert.deepEqual(extractVehicleBrands(title), ['BMW', 'Toyota']);
  assert.deepEqual(extractVehicleModelsForBrand(title, 'BMW'), ['G29']);
  assert.deepEqual(extractVehicleModelsForBrand(title, 'Toyota'), ['A90']);
});

test('extractVehicleModelsForBrand handles shared platform titles with uneven chassis notation', () => {
  const title = 'AKRAPOVIC Evolution Link Pipe Kit (SS) for TOYOTA Supra (A90)/BMW Z4 M40i OPF/GPF';

  assert.deepEqual(extractVehicleBrands(title), ['BMW', 'Toyota']);
  assert.deepEqual(extractVehicleModelsForBrand(title, 'BMW'), ['G29']);
  assert.deepEqual(extractVehicleModelsForBrand(title, 'Toyota'), ['A90']);
});

test('extractVehicleModelsForBrand does not split model names like ZO6/ZR1 as vehicle separators', () => {
  const title = 'AKRAPOVIC TP-NIR35C Exhaust Tailpipes (Carbon, 125mm Diameter) for NISSAN GT-R (R35) / CHEVROLET Corvette ZO6/ZR1 (C6)';

  assert.deepEqual(extractVehicleBrands(title), ['Nissan', 'Chevrolet']);
  assert.deepEqual(extractVehicleModelsForBrand(title, 'Nissan'), ['R35']);
  assert.deepEqual(extractVehicleModelsForBrand(title, 'Chevrolet'), ['C6']);
});

test('extractVehicleModelsForBrand includes every chassis code from shared model groups', () => {
  const title = 'AKRAPOVIC DI-BM/CA/9/G Rear Diffuser (Carbon Fiber / Gloss) for BMW M3 (G80 / G81) / M4 (G82 / G83)';

  assert.deepEqual(extractVehicleModelsForBrand(title, 'BMW'), ['G80', 'G81', 'G82', 'G83']);
});

test('extractVehicleModelNamesForBrand picks marketing names per brand', () => {
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC Slip-On Line for PORSCHE 911 Carrera (992)', 'Porsche'),
    ['911']
  );
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC Evolution Line for PORSCHE Macan (95B)', 'Porsche'),
    ['Macan']
  );
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC Slip-On for AUDI RS6 (C8)', 'Audi'),
    ['RS6']
  );
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC Slip-On for AUDI RS7 Sportback (C8)', 'Audi'),
    ['RS7']
  );
});

test('extractVehicleModelNamesForBrand keeps M340i out of the M3 bucket', () => {
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC s-BM/T/18h Slip-On Line for BMW M340i (G20/G21)', 'BMW'),
    ['M340i/M340d']
  );
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC Slip-On Line for BMW M3 (G80)', 'BMW'),
    ['M3']
  );
});

test('extractVehicleModelNamesForBrand returns both models for shared M3+M4 titles', () => {
  const title = 'AKRAPOVIC DI-BM/CA/9/G Rear Diffuser for BMW M3 (G80/G81) / M4 (G82/G83)';
  const models = extractVehicleModelNamesForBrand(title, 'BMW').sort();
  assert.deepEqual(models, ['M3', 'M4']);
});

test('extractVehicleModelNamesForBrand recognises Boxster/Cayman as 718', () => {
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC Slip-On Line for PORSCHE Boxster / Cayman (982)', 'Porsche'),
    ['718']
  );
});

test('extractVehicleModelNamesForBrand returns empty array for unknown brand', () => {
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC for FOOBAR Z9 (X1)', 'FoobarBrand'),
    []
  );
});

test('extractVehicleModelNamesForBrand matches both M235i and M240i for the same model', () => {
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC for BMW M235i (F22)', 'BMW'),
    ['M235i/M240i']
  );
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC for BMW M240i (G42)', 'BMW'),
    ['M235i/M240i']
  );
  assert.deepEqual(
    extractVehicleModelNamesForBrand('AKRAPOVIC for BMW M135i / M140i (F40 / F20)', 'BMW'),
    ['M135i/M140i']
  );
});

test('extractChassisForBrandAndModel attributes chassis only to the matching model', () => {
  const title = 'AKRAPOVIC for BMW M2 (F87) / M3 (G80) / M4 (G82)';
  assert.deepEqual(extractChassisForBrandAndModel(title, 'BMW', 'M2'), ['F87']);
  assert.deepEqual(extractChassisForBrandAndModel(title, 'BMW', 'M3'), ['G80']);
  assert.deepEqual(extractChassisForBrandAndModel(title, 'BMW', 'M4'), ['G82']);
});

test('extractChassisForBrandAndModel filters out cross-pollinated chassis via whitelist', () => {
  // Title bundles M2, M235i/M240i and M340i — under M235i/M240i we must not see F87 or G20.
  const title = 'AKRAPOVIC for BMW M2 / M235i / M240i / M340i (F87 / F22 / G42 / G20)';
  const chassis = extractChassisForBrandAndModel(title, 'BMW', 'M235i/M240i').sort();
  assert.deepEqual(chassis, ['F22', 'G42']);
});

test('extractChassisForBrandAndModel disambiguates Audi C8 between RS6 and RS7', () => {
  const t1 = 'AKRAPOVIC Slip-On for AUDI RS6 (C8)';
  const t2 = 'AKRAPOVIC Slip-On for AUDI RS7 Sportback (C8)';
  assert.deepEqual(extractChassisForBrandAndModel(t1, 'Audi', 'RS6'), ['C8']);
  assert.deepEqual(extractChassisForBrandAndModel(t1, 'Audi', 'RS7'), []);
  assert.deepEqual(extractChassisForBrandAndModel(t2, 'Audi', 'RS7'), ['C8']);
  assert.deepEqual(extractChassisForBrandAndModel(t2, 'Audi', 'RS6'), []);
});

test('extractChassisForBrandAndModel falls back to TRIM_TO_CHASSIS when title has no parens', () => {
  // "BMW M440i (OPF vehicles)" — paren is filtered, trim fallback gives G22/G23.
  assert.deepEqual(
    extractChassisForBrandAndModel(
      'AKRAPOVIC s-BM/T/18h Slip-On Line for BMW M440I (OPF vehicles)',
      'BMW',
      'M440i/M440d'
    ).sort(),
    ['G22', 'G23']
  );
});

test('extractChassisForBrandAndModel returns empty for the wrong model', () => {
  assert.deepEqual(
    extractChassisForBrandAndModel('AKRAPOVIC for BMW M3 (G80)', 'BMW', 'M5'),
    []
  );
});
