import test from 'node:test';
import assert from 'node:assert/strict';
import { extractShopProductDescriptionSections } from '../../../src/lib/shopProductDescription';

test('sanitizes hostile markup from storefront descriptions', () => {
  const sections = extractShopProductDescriptionSections(`
    <p>Power gains without unsafe markup.</p>
    <script>alert('xss')</script>
    <img src="x" onerror="alert('boom')" />
    <a href="javascript:alert('bad')">Click me</a>
  `);

  assert.match(sections.introHtml, /Power gains without unsafe markup/i);
  assert.doesNotMatch(sections.introHtml, /<script/i);
  assert.doesNotMatch(sections.introHtml, /onerror\s*=/i);
  assert.doesNotMatch(sections.introHtml, /javascript:/i);
});
