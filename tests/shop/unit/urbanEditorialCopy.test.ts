import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUrbanEditorialCopy,
  computeUrbanUaEditorialUpdate,
  polishUrbanUaCopy,
  type UrbanEditorialProductInput,
} from '../../../src/lib/urbanEditorialCopy';

function makeProduct(overrides: Partial<UrbanEditorialProductInput> = {}): UrbanEditorialProductInput {
  return {
    slug: 'urb-spo-25353021-v1',
    titleEn: 'Range Rover L460 Visual Carbon Fibre Rear Spoiler',
    titleUa: 'Range Rover L460 Visual Carbon Fibre Rear Spoiler',
    shortDescEn: 'Official Urban rear spoiler for Range Rover L460.',
    shortDescUa: 'Official Urban rear spoiler for Range Rover L460.',
    longDescEn: null,
    longDescUa: null,
    bodyHtmlEn: '<p>Official Urban rear spoiler for Range Rover L460.</p>',
    bodyHtmlUa: '<p>Official Urban rear spoiler for Range Rover L460.</p>',
    seoTitleUa: null,
    seoDescriptionUa: null,
    brand: 'Range Rover',
    categoryEn: 'Spoilers',
    categoryUa: 'Спойлери',
    productType: 'Spoilers',
    collectionEn: 'Range Rover L460',
    collectionUa: 'Range Rover L460',
    tags: ['urban-family:exterior'],
    ...overrides,
  };
}

test('buildUrbanEditorialCopy creates premium UA spoiler copy with translated title', () => {
  const copy = buildUrbanEditorialCopy(makeProduct());

  assert.equal(copy.titleUa, 'Задній спойлер Visual Carbon Fibre для Range Rover L460');
  assert.match(copy.shortDescUa, /Urban Automotive/i);
  assert.match(copy.shortDescUa, /Range Rover L460/);
  assert.match(copy.bodyHtmlUa, /OEM Plus/i);
  assert.match(copy.bodyHtmlUa, /Visual Carbon Fibre/);
  assert.match(copy.bodyHtmlUa, /задній спойлер/i);
  assert.equal(copy.seoTitleUa, copy.titleUa);
  assert.equal(copy.seoDescriptionUa, copy.shortDescUa);
});

test('buildUrbanEditorialCopy formats wheel specifications for Ukrainian storefront copy', () => {
  const copy = buildUrbanEditorialCopy(
    makeProduct({
      slug: 'urb-whe-26009309-v1',
      titleEn: '22" WX2-R - 5x120 - ET25 - Satin Black - Rear (L663)',
      titleUa: '22" WX2-R - 5x120 - ET25 - Satin Black - Rear (L663)',
      shortDescEn: null,
      shortDescUa: null,
      bodyHtmlEn: '<p>Wheel for the Defender platform.</p>',
      bodyHtmlUa: null,
      brand: 'Land Rover',
      categoryEn: 'Wheels',
      categoryUa: 'Диски',
      productType: 'Wheels',
      collectionEn: 'Defender 110',
      collectionUa: 'Defender 110',
      tags: ['urban-family:wheels'],
    })
  );

  assert.equal(copy.titleUa, 'Диск Urban WX2-R 22" Satin Black для Land Rover Defender 110');
  assert.match(copy.shortDescUa, /22"/);
  assert.match(copy.bodyHtmlUa, /5x120/);
  assert.match(copy.bodyHtmlUa, /ET25/);
  assert.match(copy.bodyHtmlUa, /задня вісь/i);
  assert.match(copy.bodyHtmlUa, /Defender 110/);
});

test('buildUrbanEditorialCopy translates fitment notes for premium grille copy', () => {
  const copy = buildUrbanEditorialCopy(
    makeProduct({
      slug: 'urb-gri-25353018-v1',
      titleEn:
        'Range Rover L460 Visual Carbon Fibre Matrix Front Grille (For SV models, non-sv OEM Grille required)',
      titleUa:
        'Range Rover L460 Visual Carbon Fibre Matrix Front Grille (For SV models, non-sv OEM Grille required)',
      shortDescEn: null,
      shortDescUa: null,
      bodyHtmlEn: '<p>Official Urban front grille for Range Rover L460.</p>',
      bodyHtmlUa: null,
      categoryEn: 'Grilles',
      categoryUa: 'Решітки',
      productType: 'Grilles',
      tags: ['urban-family:exterior'],
    })
  );

  assert.equal(copy.titleUa, 'Решітка Matrix Visual Carbon Fibre для Range Rover L460');
  assert.match(copy.bodyHtmlUa, /для версій SV/i);
  assert.match(copy.bodyHtmlUa, /OEM-решітка/i);
});

test('computeUrbanUaEditorialUpdate preserves strong curated UA body copy while fixing untranslated titles', () => {
  const update = computeUrbanUaEditorialUpdate(
    makeProduct({
      slug: 'urban-defender-110-wide-arches',
      titleEn: 'New Defender 110 Urban Widetrack Arch Kit',
      titleUa: 'New Defender 110 Urban Widetrack Arch Kit',
      shortDescEn: 'Official Urban arch kit for Defender 110.',
      shortDescUa:
        'Офіційний Urban Widetrack arch kit для Defender 110, створений щоб дати New Defender більш виразну stance.',
      bodyHtmlEn: '<p>Official Urban arch kit for Defender 110.</p>',
      bodyHtmlUa:
        '<p>Офіційний Urban Widetrack arch kit для New Defender 110.</p><p>Комплект додає ширшу stance і агресивніший силует.</p>',
      brand: 'Land Rover',
      categoryEn: 'Arches',
      categoryUa: 'Арки',
      productType: 'Arches',
      collectionEn: 'Defender 110',
      collectionUa: 'Defender 110',
      tags: ['urban-family:bodykits'],
    })
  );

  assert.equal(update?.titleUa, 'Комплект арок Widetrack для Land Rover Defender 110');
  assert.equal(update?.bodyHtmlUa, undefined);
  assert.equal(update?.shortDescUa, undefined);
});

test('buildUrbanEditorialCopy translates accessory title fragments such as key fob into Ukrainian', () => {
  const copy = buildUrbanEditorialCopy(
    makeProduct({
      slug: 'urb-key-26033105-v1',
      titleEn: 'Leather Defender Key Fob',
      titleUa: 'Leather Defender Key Fob',
      shortDescEn: null,
      shortDescUa: null,
      bodyHtmlEn: '<p>Leather key fob for Defender.</p>',
      bodyHtmlUa: null,
      brand: 'Land Rover',
      categoryEn: 'Accessories',
      categoryUa: 'Аксесуари',
      productType: 'Accessories',
      collectionEn: 'Defender 110',
      collectionUa: 'Defender 110',
      tags: ['urban-family:accessories'],
    })
  );

  assert.equal(copy.titleUa, 'Брелок для Land Rover Defender 110');
  assert.match(copy.shortDescUa, /Брелок Urban Automotive/i);
});

test('polishUrbanUaCopy translates residual English automotive nouns while preserving brand style tokens', () => {
  const polished = polishUrbanUaCopy(
    'Canard packs Urban Automotive у виконанні Visual carbon fibre для Defender 110. Urban programme побудована навколо replacement bumper package і rear diffuser.',
    'text'
  );

  assert.equal(
    polished,
    'Передні канарди Urban Automotive у виконанні Visual Carbon Fibre для Defender 110. Urban-програма побудована навколо пакета заміни бамперів і задній дифузор.'
  );
});

test('polishUrbanUaCopy removes mixed English helper phrases from flagship UA copy', () => {
  const polished = polishUrbanUaCopy(
    'Офіційний Urban Soft Kit для Mercedes-Benz G-Wagon W463A з фірмовим OEM-plus характером, комплектом задніх over-rider елементів і фірмовими in-house карбоновими аксесуарами. Пакет завершує повною Urban widebody-подачею. Опис з розширеними арками, капотом Exposed Carbon, спліттером, заднім бампером і дифузором і повноцінним широким силуетом Urban.',
    'text'
  );

  assert.equal(
    polished,
    'Офіційний Urban Soft Kit для Mercedes-Benz G-Wagon W463A з фірмовим OEM Plus-характером, комплектом задніх накладок over-rider і фірмовими карбоновими аксесуарами власної розробки. Пакет завершує повноцінним широким силуетом Urban. Опис з розширеними арками, капотом Exposed Carbon, спліттером, заднім бампером і дифузором, що формують повноцінний широкий силует Urban.'
  );
});

test('computeUrbanUaEditorialUpdate treats mixed Cyrillic plus brand tokens as a valid localized title', () => {
  const update = computeUrbanUaEditorialUpdate(
    makeProduct({
      slug: 'urb-whe-26009309-v1',
      titleEn: '22" WX2-R - 5x120 - ET25 - Satin Black - Rear (L663)',
      titleUa: 'Диск Urban WX2-R 22" Satin Black для Land Rover Defender 110',
      shortDescEn: null,
      shortDescUa: 'Офіційна колісна специфікація Urban Automotive WX2-R 22" Satin Black для Land Rover Defender 110.',
      bodyHtmlEn: '<p>Wheel for the Defender platform.</p>',
      bodyHtmlUa:
        '<p>Офіційна колісна специфікація Urban Automotive для Land Rover Defender 110.</p><ul><li><strong>PCD:</strong> 5x120</li></ul>',
      seoTitleUa: 'Диск Urban WX2-R 22" Satin Black для Land Rover Defender 110',
      seoDescriptionUa:
        'Офіційна колісна специфікація Urban Automotive WX2-R 22" Satin Black для Land Rover Defender 110.',
      brand: 'Land Rover',
      categoryEn: 'Wheels',
      categoryUa: 'Диски',
      productType: 'Wheels',
      collectionEn: 'Defender 110',
      collectionUa: 'Defender 110',
      tags: ['urban-family:wheels'],
    })
  );

  assert.deepEqual(update, {
    longDescUa: 'Офіційна колісна специфікація Urban Automotive для Land Rover Defender 110. PCD: 5x120',
  });
});

test('computeUrbanUaEditorialUpdate polishes strong curated UA copy without regenerating it', () => {
  const update = computeUrbanUaEditorialUpdate(
    makeProduct({
      slug: 'urb-can-25353086-v1',
      titleEn: 'Defender L663 90/110/130 URBAN Widetrack Front Canards',
      titleUa: 'Передні канарди для Land Rover Defender 110',
      shortDescEn: null,
      shortDescUa:
        'Canard packs Urban Automotive для Land Rover Defender 110. Позиція працює в логіці OEM-plus збірки.',
      longDescEn: null,
      longDescUa: 'Canard packs Urban Automotive для Land Rover Defender 110.',
      bodyHtmlEn: '<p>Urban front canards for Defender 110.</p>',
      bodyHtmlUa:
        '<p>Canard packs Urban Automotive для Land Rover Defender 110.</p><p>Urban programme побудована навколо replacement bumper package.</p>',
      seoTitleUa: 'Передні канарди для Land Rover Defender 110',
      seoDescriptionUa:
        'Canard packs Urban Automotive для Land Rover Defender 110. Позиція працює в логіці OEM-plus збірки.',
      brand: 'Land Rover',
      categoryEn: 'Canard Packs',
      categoryUa: 'Комплекти канардів',
      productType: 'Canard Packs',
      collectionEn: 'Defender 110',
      collectionUa: 'Defender 110',
      tags: ['urban-family:bodykits'],
    })
  );

  assert.deepEqual(update, {
    shortDescUa:
      'Передні канарди Urban Automotive для Land Rover Defender 110. Позиція працює в дусі OEM Plus.',
    longDescUa:
      'Передні канарди Urban Automotive для Land Rover Defender 110. Urban-програма побудована навколо пакета заміни бамперів.',
    bodyHtmlUa:
      '<p>Передні канарди Urban Automotive для Land Rover Defender 110.</p><p>Urban-програма побудована навколо пакета заміни бамперів.</p>',
    seoDescriptionUa:
      'Передні канарди Urban Automotive для Land Rover Defender 110. Позиція працює в дусі OEM Plus.',
  });
});
