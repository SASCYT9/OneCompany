import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractProductLine,
  extractVehicleBrand,
  extractVehicleBrands,
  extractVehicleModel,
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
