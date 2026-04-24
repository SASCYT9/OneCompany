import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { URBAN_COLLECTION_CARDS } from '../../../src/app/[locale]/shop/data/urbanCollectionsList';
import { resolveUrbanThemeAssetUrl } from '../../../src/lib/urbanThemeAssets';

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
  return JSON.parse(text) as {
    sections?: Record<
      string,
      {
        blocks?: Record<
          string,
          {
            settings?: Record<string, unknown>;
          }
        >;
      }
    >;
  };
}

function collectRelativeUrlResolutions() {
  const files = fs.readdirSync(TEMPLATE_DIR).filter((file) => /^collection\..+\.json$/.test(file));
  const unresolved: Array<{ file: string; handle: string; value: string }> = [];

  for (const file of files) {
    const handle = file.replace(/^collection\./, '').replace(/\.json$/, '');
    const template = parseJsoncTemplate(path.join(TEMPLATE_DIR, file));
    const blueprintBlocks = Object.values(template.sections?.blueprint_kit?.blocks ?? {});

    for (const block of blueprintBlocks) {
      const value = String(block.settings?.external_image_url ?? '').trim();
      if (!value || value.startsWith('/') || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
        continue;
      }

      const resolved = resolveUrbanThemeAssetUrl(value, { collectionHandle: handle });
      if (!resolved.startsWith('/images/shop/urban/')) {
        unresolved.push({ file, handle, value });
      }
    }
  }

  return unresolved;
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

test('every Urban blueprint view with a relative asset resolves to a local Urban image', () => {
  assert.deepEqual(collectRelativeUrlResolutions(), []);
});

test('smgassets URLs stay remote when the migrated local file is missing', () => {
  const source =
    'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-1-2560.webp';

  assert.equal(resolveUrbanThemeAssetUrl(source, { collectionHandle: 'lamborghini-urus-se' }), source);
});
