import test from 'node:test';
import assert from 'node:assert/strict';
import { URBAN_HERO, URBAN_FEATURED_MODELS } from '../../../src/app/[locale]/shop/data/urbanHomeData';
import { URBAN_COLLECTIONS_INDEX_PATH } from '../../../src/app/[locale]/shop/data/urbanRoutes';
import { URBAN_SHOWCASES } from '../../../src/app/[locale]/shop/data/urbanShowcasesData';

test('urban home CTAs route visitors to the collections index', () => {
  assert.equal(URBAN_HERO.primaryButtonLink, URBAN_COLLECTIONS_INDEX_PATH);

  assert.ok(URBAN_FEATURED_MODELS.length > 0);
  for (const model of URBAN_FEATURED_MODELS) {
    assert.equal(
      model.link,
      URBAN_COLLECTIONS_INDEX_PATH,
      `featured model ${model.title} should route to the collections index`
    );
  }

  assert.ok(URBAN_SHOWCASES.length > 0);
  for (const showcase of URBAN_SHOWCASES) {
    assert.equal(
      showcase.exploreLink,
      URBAN_COLLECTIONS_INDEX_PATH,
      `showcase ${showcase.name} explore CTA should route to the collections index`
    );
    assert.equal(
      showcase.shopLink,
      URBAN_COLLECTIONS_INDEX_PATH,
      `showcase ${showcase.name} shop CTA should route to the collections index`
    );
  }
});
