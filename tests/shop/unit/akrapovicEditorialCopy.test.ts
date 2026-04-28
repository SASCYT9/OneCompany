import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAkrapovicEditorialCopy,
  extractAkrapovicSkuFromTitle,
} from '../../../src/lib/akrapovicEditorialCopy';

const baseInput = {
  slug: '',
  titleEn: '',
};

test('extractAkrapovicSkuFromTitle pulls the SKU prefix in canonical form', () => {
  assert.equal(
    extractAkrapovicSkuFromTitle(
      'AKRAPOVIC S-ME/T/13H Slip-On Line Exhaust System (Titanium) for MERCEDES-AMG C63 (W205)'
    ),
    'S-ME/T/13H'
  );
  assert.equal(
    extractAkrapovicSkuFromTitle('AKRAPOVIC s-bm/ti/33h Slip-On Line for BMW M3 (G80)'),
    'S-BM/TI/33H'
  );
  assert.equal(
    extractAkrapovicSkuFromTitle(
      'AKRAPOVIC MTP-ME/T/2H/1 Evolution Line (Titanium) Exhaust System for MERCEDES C63'
    ),
    'MTP-ME/T/2H/1'
  );
  assert.equal(extractAkrapovicSkuFromTitle('Random title without SKU'), null);
  assert.equal(extractAkrapovicSkuFromTitle(null), null);
  assert.equal(extractAkrapovicSkuFromTitle(''), null);
});

test('buildAkrapovicEditorialCopy: Slip-On Line keeps Latin product line and adds vehicle phrase', () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: 'akrapovic-s-bm-ti-33h',
    titleEn: 'AKRAPOVIC S-BM/TI/33H Slip-On Line Exhaust System (Titanium) for BMW M3 (G80)',
    brand: 'AKRAPOVIC',
  });

  assert.match(copy.titleUa, /^Slip-On Line — Akrapovič для /);
  assert.match(copy.titleUa, /BMW/);
  assert.match(copy.titleUa, /G80/);
  assert.ok(!copy.titleUa.includes('Urban Automotive'));
  assert.match(copy.shortDescUa, /Axleback/);
  assert.match(copy.shortDescUa, /задні глушники/);
});

test('buildAkrapovicEditorialCopy: Evolution Line uses Cat-Back terminology in concept bullet', () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: 'akrapovic-mtp-me-t-2h-1',
    titleEn:
      'AKRAPOVIC MTP-ME/T/2H/1 Evolution Line (Titanium) Exhaust System for MERCEDES C63 AMG / C63S (W205 / S205) 2015-2018',
    brand: 'AKRAPOVIC',
  });

  assert.match(copy.titleUa, /^Evolution Line — Akrapovič для /);
  assert.match(copy.titleUa, /Mercedes/);
  assert.match(copy.shortDescUa, /Cat-Back/);
  assert.match(copy.bodyHtmlUa, /MTP-ME\/T\/2H\/1/);
  assert.match(copy.bodyHtmlUa, /Titanium/);
  // No Urban-voice leak.
  assert.ok(!/Urban Automotive/.test(copy.bodyHtmlUa));
  assert.ok(!/стриман/.test(copy.bodyHtmlUa));
});

test('buildAkrapovicEditorialCopy: Tail Pipe Set is rendered with Cyrillic head and tip-flavored description', () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: 'akrapovic-tp-nir35c',
    titleEn:
      'AKRAPOVIC TP-NIR35C Exhaust Tailpipes (Carbon, 125mm Diameter) for NISSAN GT-R (R35) / CHEVROLET Corvette ZO6/ZR1 (C6)',
    brand: 'AKRAPOVIC',
  });

  assert.match(copy.titleUa, /^Насадки вихлопу — Akrapovič для /);
  assert.match(copy.shortDescUa, /декоративних насадок/);
  assert.match(copy.bodyHtmlUa, /TP-NIR35C/);
});

test('buildAkrapovicEditorialCopy: Sound & Control Kit gets kit description, not exhaust copy', () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: 'akrapovic-p-hf868',
    titleEn:
      'AKRAPOVIC P-HF868 Valve Actuator Kit for CHEVROLET Corvette Stingray / Grand Sport (C7)',
    brand: 'AKRAPOVIC',
  });

  assert.match(copy.titleUa, /^Sound & Control Kit — Akrapovič для /);
  assert.match(copy.shortDescUa, /модуль керування заслінками/);
});

test('buildAkrapovicEditorialCopy: title without "for ..." phrase still produces a clean H1', () => {
  const copy = buildAkrapovicEditorialCopy({
    ...baseInput,
    slug: 'akrapovic-cap',
    titleEn: 'AKRAPOVIC Cap Black',
    brand: 'AKRAPOVIC',
  });

  // "Cap" matches `accessories` in LINE_PATTERNS.
  assert.match(copy.titleUa, /Akrapovič$/);
  assert.ok(!copy.titleUa.includes('для '));
});
