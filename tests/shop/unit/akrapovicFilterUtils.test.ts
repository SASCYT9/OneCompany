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
