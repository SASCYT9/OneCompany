import test from "node:test";
import assert from "node:assert/strict";
import {
  SEO_TITLE_MAX_LENGTH,
  buildProductSeoDescription,
  buildProductSeoTitle,
  buildRacechipSeoMeta,
  includesNormalized,
  parseRacechipSlugSpecs,
} from "../../../src/lib/seoProductMeta";

test("explicit SEO title and description always win", () => {
  assert.equal(
    buildProductSeoTitle({
      explicitTitle: "  Custom title ",
      title: "Name",
      sku: "SKU-1",
      brand: "Brand",
    }),
    "Custom title"
  );
  assert.equal(
    buildProductSeoDescription({
      locale: "ua",
      explicitDescription: " Custom ",
      description: "short",
      title: "Name",
      sku: "SKU-1",
    }),
    "Custom"
  );
});

test("title adds SKU and brand only when the name lacks them", () => {
  assert.equal(
    buildProductSeoTitle({
      title: "GPF-Back RACING Exhaust System for VW T-Roc A1 R",
      sku: "1-950020-1002-30",
      brand: "Remus",
    }),
    "GPF-Back RACING Exhaust System for VW T-Roc A1 R 1-950020-1002-30 | Remus"
  );
  // SKU and brand already present: leave the name alone.
  assert.equal(
    buildProductSeoTitle({
      title: "Akrapovic S-TY/T/3 Slip-On Race Line",
      sku: "S-TY/T/3",
      brand: "Akrapovic",
    }),
    "Akrapovic S-TY/T/3 Slip-On Race Line"
  );
});

test("two same-name products get different titles through their SKU", () => {
  const a = buildProductSeoTitle({ title: "Remus Sport Exhaust", sku: "A-111", brand: "Remus" });
  const b = buildProductSeoTitle({ title: "Remus Sport Exhaust", sku: "B-222", brand: "Remus" });
  assert.notEqual(a, b);
});

test("title drops the SKU, then the brand, rather than exceed the limit", () => {
  const longName = "N".repeat(SEO_TITLE_MAX_LENGTH - 6);
  const title = buildProductSeoTitle({ title: longName, sku: "ABC-1", brand: "Brand" });
  assert.ok(title.length <= SEO_TITLE_MAX_LENGTH);
  assert.ok(title.startsWith(longName));

  const veryLong = "N".repeat(SEO_TITLE_MAX_LENGTH + 10);
  assert.equal(buildProductSeoTitle({ title: veryLong, sku: "ABC-1", brand: "Brand" }), veryLong);
});

test("description template replaces the boilerplate and carries the SKU", () => {
  const ua = buildProductSeoDescription({
    locale: "ua",
    description: "",
    title: "Remus Sport Exhaust",
    sku: "A-111",
    brand: "Remus",
    category: "Вихлопні системи",
  });
  assert.match(ua, /арт\. A-111/);
  assert.match(ua, /Купити в Україні/);

  const en = buildProductSeoDescription({
    locale: "en",
    description: "",
    title: "Remus Sport Exhaust",
    sku: "A-111",
    brand: "Remus",
  });
  assert.match(en, /SKU A-111/);
  assert.match(en, /worldwide delivery/i);
});

test("thin descriptions are extended, rich ones are kept", () => {
  const thin = buildProductSeoDescription({
    locale: "ua",
    description: "Вихлопна система Remus.",
    title: "Remus Sport Exhaust",
    sku: "A-111",
  });
  assert.match(thin, /Арт\. A-111/);
  assert.match(thin, /Доставка по Україні та світу\./);

  const rich = "R".repeat(120);
  assert.equal(
    buildProductSeoDescription({
      locale: "en",
      description: rich,
      title: "Name A-111",
      sku: "A-111",
    }),
    rich
  );
});

test("normalized containment ignores case and punctuation", () => {
  assert.equal(includesNormalized("Akrapovic S-TY/T/3 Slip-On", "s-ty/t/3"), true);
  assert.equal(includesNormalized("Akrapovic Slip-On", "S-TY/T/3"), false);
  assert.equal(includesNormalized("anything", ""), true);
});

test("RaceChip slug specs are parsed from the trailing power block", () => {
  assert.deepEqual(
    parseRacechipSlugSpecs(
      "racechip-gts5-audi-a4-b8-2007-to-2015-2-0-tdi-1968ccm-177hp-130kw-380nm"
    ),
    { hp: 177, kw: 130, nm: 380 }
  );
  assert.equal(parseRacechipSlugSpecs("racechip-gts5-something"), null);
});

test("RaceChip variants with the same name get different titles and descriptions", () => {
  const name = "RaceChip GTS 5 — Audi A4 B8 (2007–2015) 2.0 TDI 1968cc";
  const a = buildRacechipSeoMeta({
    locale: "ua",
    slug: "racechip-gts5-audi-a4-b8-2007-to-2015-2-0-tdi-1968ccm-177hp-130kw-380nm",
    title: name,
    description: "+33 к.с. / +101 Нм — RaceChip GTS 5 з App Control",
  });
  const b = buildRacechipSeoMeta({
    locale: "ua",
    slug: "racechip-gts5-audi-a4-b8-2007-to-2015-2-0-tdi-1968ccm-190hp-140kw-400nm",
    title: name,
    description: "+30 к.с. / +90 Нм — RaceChip GTS 5 з App Control",
  });

  assert.notEqual(a.title, b.title);
  assert.notEqual(a.description, b.description);
  assert.match(a.title, /177 к\.с\./);
  assert.match(a.description, /177 к\.с\. \/ 130 кВт \/ 380 Нм/);
  assert.match(a.description, /\+33 к\.с\. \/ \+101 Нм/);
  assert.ok(a.title.length <= SEO_TITLE_MAX_LENGTH);

  const en = buildRacechipSeoMeta({
    locale: "en",
    slug: "racechip-gts5-audi-a4-b8-2007-to-2015-2-0-tdi-1968ccm-177hp-130kw-380nm",
    title: "RaceChip GTS 5 — Audi A4 B8 (2007–2015) 2.0 TDI 1968cc",
    description: "",
  });
  assert.match(en.title, /177 hp/);
  assert.match(en.description, /stock 177 hp \/ 130 kW \/ 380 Nm/);
});

test("RaceChip falls back to the generic builder when the slug has no power block", () => {
  const meta = buildRacechipSeoMeta({
    locale: "en",
    slug: "racechip-gts5-custom",
    title: "RaceChip GTS 5 custom",
    description: "",
    sku: "RC-1",
  });
  assert.match(meta.title, /RaceChip GTS 5 custom/);
  assert.match(meta.description, /SKU RC-1/);
});
