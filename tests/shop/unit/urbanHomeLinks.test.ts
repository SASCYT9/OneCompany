import test from 'node:test';
import assert from 'node:assert/strict';
import { URBAN_HERO, URBAN_FEATURED_MODELS } from '../../../src/app/[locale]/shop/data/urbanHomeData';
import { URBAN_COLLECTIONS_INDEX_PATH } from '../../../src/app/[locale]/shop/data/urbanRoutes';
import { URBAN_SHOWCASES } from '../../../src/app/[locale]/shop/data/urbanShowcasesData';
import { URBAN_COLLECTION_CARDS } from '../../../src/app/[locale]/shop/data/urbanCollectionsList';

const VALID_HANDLES = new Set(URBAN_COLLECTION_CARDS.map((c) => c.collectionHandle));

function assertCollectionLink(label: string, href: string) {
  const prefix = `${URBAN_COLLECTIONS_INDEX_PATH}/`;
  assert.ok(href.startsWith(prefix), `${label} should link to a specific collection (got ${href})`);
  const handle = href.slice(prefix.length);
  assert.ok(VALID_HANDLES.has(handle), `${label} handle "${handle}" must exist in URBAN_COLLECTION_CARDS`);
}

test('urban home hero CTA routes to the collections index', () => {
  assert.equal(URBAN_HERO.primaryButtonLink, URBAN_COLLECTIONS_INDEX_PATH);
});

test('urban featured model CTAs route to a real collection page', () => {
  assert.ok(URBAN_FEATURED_MODELS.length > 0);
  for (const model of URBAN_FEATURED_MODELS) {
    assertCollectionLink(`featured model ${model.title}`, model.link);
  }
});

test('urban showcase CTAs route to a real collection page', () => {
  assert.ok(URBAN_SHOWCASES.length > 0);
  for (const showcase of URBAN_SHOWCASES) {
    assertCollectionLink(`showcase ${showcase.name} explore`, showcase.exploreLink);
    assertCollectionLink(`showcase ${showcase.name} shop`, showcase.shopLink);
  }
});
