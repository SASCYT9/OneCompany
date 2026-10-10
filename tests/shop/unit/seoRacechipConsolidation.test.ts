import test from "node:test";
import assert from "node:assert/strict";
import {
  RACECHIP_INDEXED_VARIANTS_PER_MODEL,
  computeRacechipNoindexSlugs,
  isRacechipRow,
  resolveRacechipModelGroupKey,
  resolveRacechipPower,
} from "../../../src/lib/seoRacechipConsolidation";

function variant(make: string, model: string, engine: string, brand = "RaceChip") {
  return {
    slug: `racechip-gts5-${make}-${model}-${engine}`,
    brand,
    tags: [`car_make:${make}`, `car_model:${model}`, `car_engine:${engine}`],
  };
}

const A4 = "a4-b8-2007-to-2015";

test("one variant per make/model group stays indexable and it is the most powerful", () => {
  const rows = [
    variant("audi", A4, "2-0-tdi-1968ccm-143hp-105kw-320nm"),
    variant("audi", A4, "2-0-tdi-1968ccm-190hp-140kw-400nm"),
    variant("audi", A4, "1-8-tfsi-1798ccm-120hp-88kw-230nm"),
  ];
  const noindex = computeRacechipNoindexSlugs(rows);

  assert.equal(RACECHIP_INDEXED_VARIANTS_PER_MODEL, 1);
  assert.equal(noindex.size, 2);
  assert.equal(noindex.has(rows[1].slug), false, "190 hp variant is the representative");
  assert.equal(noindex.has(rows[0].slug), true);
  assert.equal(noindex.has(rows[2].slug), true);
});

test("singleton groups and different models are never noindexed", () => {
  const rows = [
    variant("audi", A4, "2-0-tdi-1968ccm-177hp-130kw-380nm"),
    variant("audi", "a6-c7-2011-to-2018", "3-0-tdi-2967ccm-245hp-180kw-580nm"),
    variant("bmw", "3-series-f30-2012-to-2019", "2-0-d-1995ccm-184hp-135kw-380nm"),
  ];
  assert.equal(computeRacechipNoindexSlugs(rows).size, 0);
});

test("equal power breaks ties by slug so the choice is stable", () => {
  const rows = [
    variant("fiat", "talento-296-from-2016", "1-6-d-1598ccm-120hp-88kw-320nm"),
    variant("fiat", "talento-296-from-2016", "1-6-d-1598ccm-120hp-88kw-340nm"),
  ];
  const first = computeRacechipNoindexSlugs(rows);
  const second = computeRacechipNoindexSlugs([...rows].reverse());
  assert.deepEqual([...first], [...second]);
  assert.equal(first.size, 1);
});

test("rows without complete tags or from other brands are left alone", () => {
  const rows = [
    { slug: "racechip-no-tags-1", brand: "RaceChip", tags: [] },
    { slug: "racechip-no-tags-2", brand: "RaceChip", tags: [] },
    { slug: "racechip-half-1", brand: "RaceChip", tags: ["car_make:audi"] },
    { slug: "racechip-half-2", brand: "RaceChip", tags: ["car_make:audi"] },
    variant("audi", A4, "2-0-tdi-1968ccm-143hp-105kw-320nm", "Remus"),
    variant("audi", A4, "2-0-tdi-1968ccm-190hp-140kw-400nm", "Remus"),
  ];
  assert.equal(computeRacechipNoindexSlugs(rows).size, 0);
  assert.equal(isRacechipRow(rows[0]), true);
  assert.equal(isRacechipRow(rows[4]), false);
});

test("empty input and a larger keep count behave", () => {
  assert.equal(computeRacechipNoindexSlugs([]).size, 0);
  const rows = [
    variant("audi", A4, "2-0-tdi-1968ccm-143hp-105kw-320nm"),
    variant("audi", A4, "2-0-tdi-1968ccm-170hp-125kw-350nm"),
    variant("audi", A4, "2-0-tdi-1968ccm-190hp-140kw-400nm"),
  ];
  const noindex = computeRacechipNoindexSlugs(rows, { indexedPerModel: 2 });
  assert.deepEqual([...noindex], [rows[0].slug]);
});

test("group key and power are read from tags, falling back to the slug", () => {
  const row = variant("audi", A4, "2-0-tdi-1968ccm-177hp-130kw-380nm");
  assert.equal(resolveRacechipModelGroupKey(row), `audi|${A4}`);
  assert.equal(resolveRacechipPower(row), 177);
  assert.equal(
    resolveRacechipPower({ slug: "racechip-x-150hp-110kw-300nm", brand: "RaceChip", tags: [] }),
    150
  );
  assert.equal(resolveRacechipModelGroupKey({ slug: "x", brand: "RaceChip", tags: [] }), null);
});
