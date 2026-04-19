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

test('extracts Ukrainian "Що не входить" sections into excluded items', () => {
  const sections = extractShopProductDescriptionSections(`
    <p>Офіційний пакет Urban для Mercedes-Benz G-Wagon W465.</p>
    <h3>Що входить</h3>
    <ul>
      <li>Передній бампер</li>
      <li>Задній дифузор</li>
    </ul>
    <h3>Що не входить</h3>
    <ul>
      <li>Ковані диски 23"</li>
      <li>Роботи з монтажу</li>
    </ul>
    <h3>Ключові характеристики</h3>
    <ul>
      <li>Офіційний Urban package</li>
    </ul>
  `);

  assert.deepEqual(sections.included, ['Передній бампер', 'Задній дифузор']);
  assert.deepEqual(sections.excluded, ['Ковані диски 23"', 'Роботи з монтажу']);
  assert.deepEqual(sections.features, ['Офіційний Urban package']);
});
