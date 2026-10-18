import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShopProductDescriptionHtml,
  extractShopProductDescriptionSections,
} from '../../../src/lib/shopProductDescription';

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

// Eventuri Lamborghini Huracán description: emoji headings followed by lists.
const EVENTURI_DESCRIPTION = `
<p>Цей комплект виготовлений із <strong>справжнього препрег карбону</strong>.</p>
<p>🔧 <strong>Комплектація:</strong></p>
<ul>
<li><p>Центральна накладка двигуна</p></li>
<li><p>Дві бокові накладки</p></li>
</ul>
<p>✨ <strong>Особливості:</strong></p>
<ul>
<li><p>Виготовлено з 100% препрег карбону</p></li>
</ul>
<p>🚫 <strong>Не сумісно з моделями Huracán EVO та Technica</strong></p>
`;

test('drops intro headings whose lists moved to the section panels', () => {
  const sections = extractShopProductDescriptionSections(EVENTURI_DESCRIPTION);

  assert.doesNotMatch(sections.introHtml, /Комплектація|Особливості/);
  assert.match(sections.introHtml, /препрег карбону/);
  assert.match(sections.introHtml, /Не сумісно з моделями Huracán EVO/);
  assert.deepEqual(sections.features, [
    'Центральна накладка двигуна',
    'Дві бокові накладки',
    'Виготовлено з 100% препрег карбону',
  ]);
});

test('keeps an intro heading that has its own text after it', () => {
  const sections = extractShopProductDescriptionSections(
    '<p>Сумісність:</p><p>Lamborghini Huracán LP610-4 та LP580-2 до 2019 року.</p>'
  );

  assert.match(sections.introHtml, /Сумісність:/);
  assert.match(sections.introHtml, /LP610-4/);
});

test('builds the whole description in order for pages without section panels', () => {
  const html = buildShopProductDescriptionHtml(EVENTURI_DESCRIPTION);

  const order = ['препрег карбону', 'Комплектація:', 'Дві бокові накладки', 'Особливості:', '100% препрег', 'Не сумісно'];
  const positions = order.map((fragment) => html.indexOf(fragment));
  assert.ok(positions.every((position) => position >= 0), 'every fragment is present');
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
});

test('turns a plain-text description into paragraphs and lists', () => {
  const html = buildShopProductDescriptionHtml(
    'Карбоновий впуск для BMW M3.\nКомплектація:\n- Корпус фільтра\n- Повітрозабірник\nВиготовлено <вручну> & перевірено.'
  );

  assert.equal(
    html,
    '<p>Карбоновий впуск для BMW M3.</p><p>Комплектація:</p><ul><li>Корпус фільтра</li><li>Повітрозабірник</li></ul><p>Виготовлено &lt;вручну&gt; &amp; перевірено.</p>'
  );
  assert.equal(buildShopProductDescriptionHtml('  '), '');
});
