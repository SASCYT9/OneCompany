import test from 'node:test';
import assert from 'node:assert/strict';
import { extractShopProductDescriptionSections } from '../../../src/lib/shopProductDescription';

test('extracts structured sections from Urban HTML descriptions', () => {
  const sections = extractShopProductDescriptionSections(`
    <p>Urban styling package for the modern Defender.</p>
    <p><br>Key Features:<br></p>
    <ul>
      <li>Direct-fit construction</li>
      <li>Weather-resistant finish</li>
    </ul>
    <p><br>Included in the package:<br></p>
    <ul>
      <li>Side vents</li>
      <li>Mounting hardware</li>
    </ul>
    <p><strong>Part Number:</strong> 400-214</p>
    <p><strong>Model:</strong> Defender 110</p>
  `);

  assert.match(sections.introHtml, /Urban styling package/i);
  assert.deepEqual(sections.features, ['Direct-fit construction', 'Weather-resistant finish']);
  assert.deepEqual(sections.included, ['Side vents', 'Mounting hardware']);
  assert.deepEqual(sections.excluded, []);
  assert.deepEqual(sections.specs, [
    { label: 'Part Number', value: '400-214' },
    { label: 'Model', value: 'Defender 110' },
  ]);
});

test('keeps plain text descriptions readable when no HTML structure exists', () => {
  const sections = extractShopProductDescriptionSections(
    'SVR-style carbon hood with vents. Article no: 400-214 Model: Defender 110'
  );

  assert.match(sections.introHtml, /SVR-style carbon hood with vents/i);
  assert.deepEqual(sections.features, []);
  assert.deepEqual(sections.included, []);
  assert.deepEqual(sections.excluded, []);
});
