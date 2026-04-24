import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUrbanGpSafeFallbackDescription,
  getUrbanCuratedDescriptionOverride,
  hasPoorUrbanUaMachineCopy,
  isUnsafeUrbanGpDescription,
} from '../../../src/lib/urbanGpDescriptionFallback';

test('isUnsafeUrbanGpDescription detects internal GP Portal fallback copy', () => {
  assert.equal(
    isUnsafeUrbanGpDescription(
      'GP Portal lists this Urban product as Defender 110 Wide Track Arch Kit. Price on GP Portal: EUR 1640'
    ),
    true
  );
  assert.equal(
    isUnsafeUrbanGpDescription(
      'На GP Portal цей продукт Urban указано як Defender 110 Wide Track Arch Kit. Ціна на GP Portal: 1640 євро'
    ),
    true
  );
  assert.equal(isUnsafeUrbanGpDescription('Urban Automotive product listing for Defender 110.'), false);
});

test('buildUrbanGpSafeFallbackDescription does not expose GP Portal or prices', () => {
  const fallback = buildUrbanGpSafeFallbackDescription({
    slug: 'urb-arc-26009359-v1',
    sku: 'URB-ARC-26009359-V1',
    titleEn: 'Defender 110 Wide Track Arch Kit (non-hybrid) RAW',
    titleUa: 'Комплект арок Wide Track RAW для Land Rover Defender 110',
    categoryEn: 'Arches',
    categoryUa: 'Арки',
    collectionEn: 'Defender 110',
    collectionUa: 'Defender 110',
    vendor: 'Urban Automotive',
  });

  const combined = [
    fallback.shortDescription.en,
    fallback.shortDescription.ua,
    fallback.longDescription.en,
    fallback.longDescription.ua,
    fallback.bodyHtml.en,
    fallback.bodyHtml.ua,
    fallback.seoDescription.en,
    fallback.seoDescription.ua,
  ].join(' ');

  assert.equal(/GP Portal|Price on GP Portal|Ціна на/i.test(combined), false);
  assert.match(combined, /Urban Automotive/);
  assert.match(combined, /URB-ARC-26009359-V1/);
});

test('buildUrbanGpSafeFallbackDescription preserves wheel specification facts', () => {
  const fallback = buildUrbanGpSafeFallbackDescription({
    slug: 'urb-whe-26009228-v1',
    sku: 'URB-WHE-26009228-V1',
    titleEn: '19" UCR - 5x112 - ET45 - Gloss Black (Golf R)',
    titleUa: '19" UCR - 5x112 - ET45 - Gloss Black (Golf R)',
    categoryEn: 'Wheels',
    categoryUa: 'Диски',
    collectionEn: 'Golf R',
    collectionUa: 'Golf R',
  });

  assert.match(fallback.longDescription.en ?? '', /Diameter: 19"/);
  assert.match(fallback.bodyHtml.en ?? '', /Wheel design: UCR/);
  assert.match(fallback.bodyHtml.en ?? '', /PCD: 5X112/);
  assert.match(fallback.bodyHtml.en ?? '', /Offset: ET45/);
  assert.equal(/GP Portal|Price on GP Portal/.test(fallback.bodyHtml.en ?? ''), false);
});

test('getUrbanCuratedDescriptionOverride replaces poor Urus SE machine copy', () => {
  const override = getUrbanCuratedDescriptionOverride({ slug: 'urb-wid-26084234-v1' });

  assert.ok(override);
  assert.match(override.bodyHtml.ua ?? '', /Передня частина/);
  assert.match(override.bodyHtml.ua ?? '', /Боковий профіль/);
  assert.match(override.bodyHtml.ua ?? '', /Задня частина/);
  assert.doesNotMatch(override.bodyHtml.ua ?? '', /ПЕРЕДНЯ ПЕРЕДНЯ|ЗАДНІЙ ЧАС|плаваючими вушками/i);
});

test('getUrbanCuratedDescriptionOverride covers remaining obvious UA machine artifacts', () => {
  const branding = getUrbanCuratedDescriptionOverride({ slug: 'urb-log-25353014-v1' });
  const diffuser = getUrbanCuratedDescriptionOverride({ slug: 'urb-dif-26054207-v1' });

  assert.ok(branding);
  assert.ok(diffuser);
  assert.match(branding.bodyHtml.ua ?? '', /Range Rover Sport L461/);
  assert.match(diffuser.bodyHtml.ua ?? '', /Карбонові канарди/);
  assert.doesNotMatch(
    `${branding.bodyHtml.ua} ${diffuser.bodyHtml.ua}`,
    /задній час|плаваючими вушками|чотирма заготовками/i
  );
});

test('hasPoorUrbanUaMachineCopy detects recurring weak Urban machine phrasing', () => {
  assert.equal(
    hasPoorUrbanUaMachineCopy(
      'Накладка розроблена, щоб змінити зовнішній вигляд вашого автомобіля та покращити естетичну привабливість.'
    ),
    true
  );
  assert.equal(
    hasPoorUrbanUaMachineCopy(
      'Розширені колісні арки створені для посилення агресивної позиції та візуального ефекту.'
    ),
    true
  );
  assert.equal(
    hasPoorUrbanUaMachineCopy(
      'Спліттер з вуглецевого волокна з вутками та міською емблемою.'
    ),
    true
  );
  assert.equal(hasPoorUrbanUaMachineCopy('Обвіси Visual Carbon Fibre для Lamborghini Urus SE'), true);
  assert.equal(
    hasPoorUrbanUaMachineCopy('Позиція Urban Automotive для Urus SE. Деталі позиції: артикул і категорія.'),
    true
  );
  assert.equal(hasPoorUrbanUaMachineCopy('Специфікація побудована навколо правильного fitment.'), true);
  assert.equal(hasPoorUrbanUaMachineCopy('Набір арки Range Rover розроблений, щоб забезпечити агресивну естетику.'), true);
  assert.equal(
    hasPoorUrbanUaMachineCopy(
      'Компонент Urban Automotive у виконанні Visual Carbon Fibre для Range Rover L460.'
    ),
    false
  );
  assert.equal(hasPoorUrbanUaMachineCopy('Задня частина комплекту виконана з карбону.'), false);
});
