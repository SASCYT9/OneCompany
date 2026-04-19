import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { URBAN_COLLECTION_CARDS } from '../../../src/app/[locale]/shop/data/urbanCollectionsList';

const TEMPLATE_DIR = path.resolve(
  process.cwd(),
  'reference',
  'urban-shopify-theme',
  'templates'
);

const REQUIRED_SECTIONS = ['hero', 'overview', 'gallery', 'banner', 'blueprint_kit', 'main'];

function parseJsoncTemplate(filePath: string) {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/^\uFEFF/, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(text) as { sections?: Record<string, unknown> };
}

test('every urban collection handle has a valid collection template file', () => {
  assert.equal(fs.existsSync(TEMPLATE_DIR), true, 'Urban collection template directory should exist');

  const missingTemplates: string[] = [];
  const invalidTemplates: string[] = [];

  for (const card of URBAN_COLLECTION_CARDS) {
    const filePath = path.join(TEMPLATE_DIR, `collection.${card.collectionHandle}.json`);
    if (!fs.existsSync(filePath)) {
      missingTemplates.push(card.collectionHandle);
      continue;
    }

    try {
      const template = parseJsoncTemplate(filePath);
      const sections = template.sections ?? {};
      const missingSections = REQUIRED_SECTIONS.filter((section) => !(section in sections));
      if (missingSections.length > 0) {
        invalidTemplates.push(`${card.collectionHandle}: missing ${missingSections.join(', ')}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      invalidTemplates.push(`${card.collectionHandle}: ${message}`);
    }
  }

  assert.deepEqual(missingTemplates, [], 'Missing Urban collection templates');
  assert.deepEqual(invalidTemplates, [], 'Invalid Urban collection templates');
});
