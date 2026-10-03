import test from "node:test";
import assert from "node:assert/strict";
import { cleanUrbanSpoilerEditorialText, urbanDecalSalesRestriction } from "../../../src/lib/urbanSaleCopy";
test("remove only editorial photo notes and retain finish, fitment and product facts", () => {
  const copy = "<p>Виконання: Gloss Black. Фото підібрані з офіційних Urban-асетів: у пріоритеті предметне фото, далі релевантні кадри моделі.</p><ul><li>Сумісність: Defender 90/110.</li><li>Галерея без підміни фото іншими моделями.</li></ul>";
  const cleaned = cleanUrbanSpoilerEditorialText(copy);
  assert.match(cleaned, /Gloss Black/);
  assert.match(cleaned, /Defender 90\/110/);
  assert.doesNotMatch(cleaned, /Фото підібрані|Галерея/);
  assert.match(urbanDecalSalesRestriction("en"), /only together with an Urban body kit/);
});
test("the actual English Images wording is removed while finish and fitment remain", () => {
  const copy = "<p>This is an individual part or part set, not a full bodykit or vehicle. Finish: Gloss Black. Images are selected from official Urban assets: product imagery is prioritised first, followed only by relevant model context.</p><h3>Key Features</h3><ul><li>Fits: Land Rover Defender 90 / 110 / 130 / OCTA.</li><li>Type: rear spoiler.</li><li>Finish: Gloss Black.</li><li>Gallery avoids substitution with other vehicle models.</li></ul>";
  const cleaned = cleanUrbanSpoilerEditorialText(copy);
  assert.doesNotMatch(cleaned, /Images are selected|Gallery/);
  assert.match(cleaned, /Finish: Gloss Black/);
  assert.match(cleaned, /Defender 90 \/ 110 \/ 130 \/ OCTA/);
  assert.equal(cleanUrbanSpoilerEditorialText(cleaned), cleaned);
});
