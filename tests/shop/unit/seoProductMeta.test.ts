import test from "node:test";
import assert from "node:assert/strict";
import {
  SEO_TITLE_MAX_LENGTH,
  buildLocalizedProductSeoTitle,
  buildProductSeoDescription,
  buildProductSeoTitle,
  buildRacechipSeoMeta,
  buildUaSeoProductName,
  includesNormalized,
  isBrokenStoredSeoText,
  parseRacechipSlugSpecs,
} from "../../../src/lib/seoProductMeta";

test("broken stored SEO strings are ignored and the builder takes over", () => {
  // Live 2026-10-16: Eventuri /ua/shop/3-0-turbo-v6-black-carbon-intake-system.
  const eventuri =
    "Впускна система Porsche для Porsche () в наявності (під замовлення). Доставка по Києву та Україні.";
  // Live 2026-10-16: KW /ua/shop/352200bw and /ua/shop/102100by.
  const kwUnbalanced = "Койловер для BMW 5 (G30 та ін.. Висота + жорсткість. KW [352200BW].";
  const kwEtc =
    "Койловер підвіски V1 inox для AUDI Q5 (FY) FYB та ін.. Регулювання висоти посадки.";
  for (const broken of [eventuri, kwUnbalanced, kwEtc, "undefined | KW", "Remus null"]) {
    assert.equal(isBrokenStoredSeoText(broken), true, broken);
  }
  for (const fine of [
    "Койловер підвіски V1 inox — AUDI A6 (4G) 4G2, 4GC, C7 (1.8 TFSI…3.0 TFSI quattro)",
    "Akrapovič Slip-On Line (Titanium) для BMW M3 G80",
    "Nullsystem adapter",
  ]) {
    assert.equal(isBrokenStoredSeoText(fine), false, fine);
  }

  const description = buildProductSeoDescription({
    locale: "ua",
    explicitDescription: eventuri,
    description: "Карбоновий впуск Eventuri для Porsche Cayenne 3.0 V6 Turbo (2018+).",
    title: "Система впуску повітря (карбон) для PORSCHE Cayenne 3.0L V6 Turbo 2018+",
    sku: "EVE-9Y-CF-INT",
    brand: "Eventuri",
  });
  assert.equal(description.includes("()"), false);
  assert.match(description, /Eventuri для Porsche Cayenne/);

  const title = buildProductSeoTitle({
    explicitTitle: "Впускна система Porsche для Porsche ()",
    title: "Система впуску повітря (карбон) для PORSCHE Cayenne",
    sku: "EVE-9Y-CF-INT",
    brand: "Eventuri",
  });
  assert.equal(
    title,
    "Система впуску повітря (карбон) для PORSCHE Cayenne EVE-9Y-CF-INT | Eventuri"
  );
});

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

test("RaceChip power is only treated as present when it is a labeled figure", () => {
  const slug = (hp: number) => `racechip-gts5-seat-leon-2-0-tdi-${hp}hp-${hp - 30}kw-300nm`;
  const titleFor = (name: string, hp: number) =>
    buildRacechipSeoMeta({ locale: "en", slug: slug(hp), title: name }).title;

  // Digits of the model years / displacement must not hide the power figure.
  assert.ok(
    titleFor("RaceChip GTS 5 — Seat Leon (2011–2015) 1.4 TSI", 112).includes(", 112 hp | RaceChip")
  );
  assert.ok(
    titleFor("RaceChip GTS 5 — Audi A4 2.0 TDI 1968cc", 196).includes(", 196 hp | RaceChip")
  );

  // An explicit figure in the name is left alone, in either language.
  assert.equal(
    titleFor("RaceChip GTS 5 — Audi A4 2.0 TDI 177 hp", 177).includes("177 hp, 177 hp"),
    false
  );
  assert.equal((titleFor("RaceChip GTS 5 — Audi A4 177hp", 177).match(/177/g) ?? []).length, 1);
  const ua = buildRacechipSeoMeta({
    locale: "ua",
    slug: slug(177),
    title: "RaceChip GTS 5 — Audi A4 177 к.с.",
  }).title;
  assert.equal((ua.match(/177/g) ?? []).length, 1);
});

test("long names keep the SKU and the brand and are cut only to fit the hard limit", () => {
  // Live 2026-10-17: /ua/shop/1021000a had no brand in its title.
  const kw = buildProductSeoTitle({
    title: "Койловер підвіски V1 inox — AUDI A6 (4G) 4G2, 4GC, C7 (1.8 TFSI…3.0 TFSI quattro)",
    sku: "1021000A",
    brand: "KW Suspensions",
  });
  assert.equal(
    kw,
    "Койловер підвіски V1 inox — AUDI A6 (4G) 4G2, 4GC, C7 (1.8 TFSI…3.0 TFSI quattro) 1021000A | KW"
  );
  assert.ok(kw.length <= SEO_TITLE_MAX_LENGTH);
  // The KW importer stores the name itself as the SEO title: same result.
  assert.equal(
    buildProductSeoTitle({
      explicitTitle:
        "Койловер підвіски V1 inox — AUDI A6 (4G) 4G2, 4GC, C7 (1.8 TFSI…3.0 TFSI quattro)",
      title: "Койловер підвіски V1 inox — AUDI A6 (4G) 4G2, 4GC, C7 (1.8 TFSI…3.0 TFSI quattro)",
      sku: "1021000A",
      brand: "KW Suspensions",
      locale: "ua",
    }),
    kw
  );

  // Live 2026-10-17: the Akrapovič name already carries the brand and SKU;
  // it is cut after a whole model instead of with "…".
  const akrapovic = buildProductSeoTitle({
    title:
      "AKRAPOVIC S-BM/T/29H Вихлопна система Slip-On Line (титан) для BMW X4M (F98) / X3M (F97) OPF/GPF",
    sku: "S-BM/T/29H",
    brand: "Akrapovic",
  });
  assert.equal(
    akrapovic,
    "AKRAPOVIC S-BM/T/29H Вихлопна система Slip-On Line (титан) для BMW X4M (F98) / X3M"
  );

  // Live 2026-10-17: KW names end with the SKU in brackets; the cut keeps the SKU.
  assert.equal(
    buildProductSeoTitle({
      title:
        "Комфортна підвіска V2 — BMW 2 Active Tourer (F45) F2AT, UKL-L, BMW 2 Gran Tourer (F46) F2GT, UKL-L [180200BN]",
      sku: "180200BN",
      brand: "KW Suspensions",
    }),
    "Комфортна підвіска V2 — BMW 2 Active Tourer (F45) F2AT, UKL-L, BMW 2 Gran Tourer 180200BN | KW"
  );
});

test("a shortened title keeps what the product is and its vehicle", () => {
  // Live 2026-10-17 Brabus names: a cut before "для" would leave
  // "Оздоблені шкірою передні"; the cut keeps the item and the car.
  assert.equal(
    buildProductSeoTitle({
      title: "Оздоблені шкірою передні, середні та задні стійки для Mercedes – C 217 – AMG S 63",
      sku: "217-858-19",
      brand: "Brabus",
    }),
    "Оздоблені шкірою передні, середні та задні стійки для Mercedes – C 217 217-858-19 | Brabus"
  );
  // A title that fits is not cut: "Maybach S 580 / S 680" stays.
  assert.equal(
    buildProductSeoTitle({
      title: "Знімні ковпаки на колеса Ø75 для Mercedes – Z 223 – Maybach S 580 / S 680",
      sku: "000-100-17",
      brand: "Brabus",
    }),
    "Знімні ковпаки на колеса Ø75 для Mercedes – Z 223 – Maybach S 580 / S 680 000-100-17 | Brabus"
  );
  // Long bracketed asides (engine lists) go before a model is dropped; chassis
  // code lists in brackets are not asides.
  assert.equal(
    buildProductSeoTitle({
      title:
        "Койловер підвіски V1 inox — VW BEETLE (16, 5C1, 5C2), VW BEETLE Convertible (16, 5C7, 5C8) (1.2 TSI…2.0 TSI R-Line Edition)",
      sku: "1028000L",
      brand: "KW Suspensions",
    }),
    "Койловер підвіски V1 inox — VW BEETLE (16, 5C1, 5C2), VW BEETLE Convertible 1028000L | KW"
  );
  // No "для": the vehicle may follow anything, so a name that fits is not cut.
  assert.equal(
    buildProductSeoTitle({
      title: "Накладка приладової панелі (матовий) Ducati Streetfighter V4 2025",
      sku: "CM.AMA.001.SF5V4",
      brand: "Ilmberger Carbon",
    }),
    "Накладка приладової панелі (матовий) Ducati Streetfighter V4 2025 CM.AMA.001.SF5V4"
  );
  // "(C8)" is what people search for: a name that fits is never cut.
  assert.equal(
    buildProductSeoTitle({
      title: "ADRO A13A10-1201 Накладка на передній бампер для CHEVROLET Corvette (C8) 2020-",
      sku: "A13A10-1201",
      brand: "ADRO",
    }),
    "ADRO A13A10-1201 Накладка на передній бампер для CHEVROLET Corvette (C8) 2020-"
  );
  assert.equal(
    buildProductSeoTitle({
      title: "Вихлопна система Audi RS3 Sedan / Sportback (8V.2)",
      sku: "0AR31-BVN00-202",
      brand: "iPE exhaust",
    }),
    "Вихлопна система Audi RS3 Sedan / Sportback (8V.2) 0AR31-BVN00-202 | iPE exhaust"
  );
});

test("internal codes and kit lists are not added as the SKU", () => {
  // Burger SKUs are Shopify variant ids; Urban SKUs are internal codes.
  assert.equal(
    buildProductSeoTitle({
      explicitTitle: "JB4 для Dodge Charger Scat Pack SixPack 3.0L Hurricane 2026+",
      title: "JB4 для Dodge Charger Scat Pack SixPack 3.0L Hurricane 2026+",
      sku: "BURGER-V-47317426569390",
      brand: "Burger Motorsports",
      locale: "ua",
    }),
    "JB4 для Dodge Charger Scat Pack SixPack 3.0L Hurricane 2026+ | Burger Motorsports"
  );
  assert.equal(
    buildProductSeoTitle({
      title: "BMS Dry Drop-In Air Filter для Chevrolet Corvette C7",
      sku: "BURGER-V-40271370190",
      brand: "Burger Motorsports",
    }),
    "BMS Dry Drop-In Air Filter для Chevrolet Corvette C7 | Burger Motorsports"
  );
  assert.equal(
    buildProductSeoTitle({
      title: "Карбоновий передній сплітер Urban для Audi RSQ8 Facelift",
      sku: "URB-SPL-25358236-V1",
      brand: "Audi",
    }),
    "Карбоновий передній сплітер Urban для Audi RSQ8 Facelift"
  );
  assert.equal(
    buildProductSeoTitle({
      title: "Fi EXHAUST Valvetronic Exhaust System для VW Golf 8 GTI",
      sku: "VW-GTI8-CBE + TIP63114S*2",
      brand: "Fi EXHAUST",
    }),
    "Fi EXHAUST Valvetronic Exhaust System для VW Golf 8 GTI"
  );
});

test("stored titles that are only the name with its brand, SKU or site name are rebuilt", () => {
  // Live 2026-10-17: /ua/shop/ohlins/products/ohlins-bmv-gx01 stored the name
  // with the SKU in front and was cut at 95 characters with "…".
  const ohlinsName =
    "Комплект койловерів Advanced Trackday TTX (включаючи пружини та верхні опори) для BMW M2 (G87) / M3 (G80) / M4 (G82)";
  assert.equal(
    buildProductSeoTitle({
      explicitTitle: `OHLINS BMV GX01 ${ohlinsName}`,
      title: ohlinsName,
      sku: "BMV GX01",
      brand: "OHLINS",
      locale: "ua",
    }),
    "Комплект койловерів Advanced Trackday TTX для BMW M2 (G87) / M3 (G80) / M4 BMV GX01 | OHLINS"
  );

  // Urban imports stored "<name> | ONE Company"; a name over the hard limit
  // is cut at a phrase boundary instead of with "…".
  const urbanName =
    "Накладки передніх повітрозабірників Urban Visual Carbon Fibre для Audi RS3 8Y Hatchback / Saloon";
  assert.equal(
    buildProductSeoTitle({
      explicitTitle: `${urbanName} | ONE Company`,
      title: urbanName,
      sku: "URB-FRO-25358209-V1",
      brand: "Audi",
      locale: "ua",
    }),
    "Накладки передніх повітрозабірників Urban Visual Carbon Fibre для Audi RS3 8Y Hatchback"
  );

  // Revozport: brand and site name after the name. When both do not fit,
  // the SKU stays: it keeps same-name titles apart.
  const revozportName =
    "Комплект карбонових панелей днища для треку для Chevrolet Corvette C7 2014-2019";
  assert.equal(
    buildProductSeoTitle({
      explicitTitle: `${revozportName} | Revozport — One Company`,
      title: revozportName,
      sku: "RZ-XF-9021",
      brand: "Revozport",
      locale: "ua",
    }),
    `${revozportName} RZ-XF-9021`
  );
});

test("curated stored titles stay unless they are too long to show", () => {
  // Ilmberger's hand-written title differs from the name: kept as it is.
  const ilmberger =
    "Карбонова бокова панель обтічника (справа, вулична) BMW M 1000 R 2023 — Ilmberger";
  assert.equal(
    buildProductSeoTitle({
      explicitTitle: ilmberger,
      title: "Бокова панель обтічника вулична версія (справа) BMW M 1000 R 2023",
      sku: "CG.VER.002.M123N",
      brand: "Ilmberger Carbon",
      locale: "ua",
    }),
    ilmberger
  );
  // The site name is dropped from a curated title.
  assert.equal(
    buildProductSeoTitle({ explicitTitle: "Custom title | One Company", title: "Name" }),
    "Custom title"
  );
  // Live 2026-10-17: a BMC stored title cut mid-word before "| One Company";
  // over the hard limit it is cut at a phrase boundary like a name.
  assert.equal(
    buildProductSeoTitle({
      explicitTitle:
        "Повітряний фільтр BMC FB725/20 для Volkswagen BEETLE / BEETLE CABRIO (5C), Volkswagen GOLF VI / CABRIO VI / GOLF PLUS (5K1/5,AJ5,5M1,517,521), Volkswa | One Company",
      title:
        "Повітряний фільтр BMC FB725/20 для Volkswagen BEETLE / BEETLE CABRIO (5C), Volkswagen GOLF VI / CABRIO VI / GOLF PLUS (5K1/5,AJ5,5M1,517,521), Volkswagen JETTA III (1K2) та інших моделей",
      sku: "FB725-20",
      brand: "BMC",
      locale: "ua",
    }),
    "Повітряний фільтр BMC FB725/20 для Volkswagen BEETLE / BEETLE CABRIO (5C), Volkswagen GOLF VI"
  );
  // Live 2026-10-17: an Urban product shows a newer name than its stored
  // title; the stored one stays, cut at a phrase boundary instead of with "…".
  assert.equal(
    buildProductSeoTitle({
      explicitTitle:
        "Накладки передніх повітрозабірників Urban Visual Carbon Fibre для Audi RS3 8Y Hatchback / Saloon | ONE Company",
      title: "Передні накладки повітрозабірників Urban Visual Carbon Fibre для Audi RS3 8Y",
      sku: "URB-FRO-25358209-V1",
      brand: "Audi",
      locale: "ua",
    }),
    "Накладки передніх повітрозабірників Urban Visual Carbon Fibre для Audi RS3 8Y Hatchback"
  );
});

test("a phrase-boundary cut never leaves a bracket open", () => {
  // ", " inside "(992, 992.2)" is not a place to cut.
  assert.equal(
    buildProductSeoTitle({
      title:
        "Exhaust system for Porsche 911 (992, 992.2), 718 Cayman GT4 RS (982), Panamera Turbo S E-Hybrid (971) with valves and tips",
      brand: "Brand",
    }),
    "Exhaust system for Porsche 911 (992, 992.2), 718 Cayman GT4 RS (982) | Brand"
  );
  // No boundary to cut at: the name is left to the metadata limit.
  assert.equal(buildProductSeoTitle({ title: "N".repeat(120) }), "N".repeat(120));
});

test("an untranslated stored title does not win on a Ukrainian page", () => {
  const input = {
    explicitTitle: "Sport Exhaust for VW Golf 7",
    title: "Вихлопна система Remus для VW Golf 7",
    sku: "1-956017-1001-101",
    brand: "Remus",
  };
  assert.equal(
    buildProductSeoTitle({ ...input, locale: "ua" }),
    "Вихлопна система Remus для VW Golf 7 1-956017-1001-101"
  );
  assert.equal(buildProductSeoTitle({ ...input, locale: "en" }), "Sport Exhaust for VW Golf 7");
});

test("untranslated supplier names get a Ukrainian title name", () => {
  // Live 2026-10-17 English titles on /ua Remus pages.
  const remus = (titleEn: string, category = "Cars / Bundles") =>
    buildUaSeoProductName({ title: titleEn, titleEn, brand: "Remus", categoryEn: category });
  assert.equal(
    remus(
      "Sport Exhaust for VW Golf 7 Faclift AU Silencer (956017 1500) | 2x 100mm Titanium Black Tips"
    ),
    "Вихлопна система Remus для VW Golf 7 Faclift AU Silencer"
  );
  assert.equal(
    remus(
      "Sport Exhaust for Honda Civic Type-R (FK8) Racing | 3x 102mm Carbon Tips | Sound Controller"
    ),
    "Вихлопна система Remus для Honda Civic Type-R (FK8) Racing"
  );
  assert.equal(
    remus(
      "Cat-Back System for Mini John Cooper Works F54/F60 (FMK) 2x 102mm Chrome Straight Cut Tips"
    ),
    "Вихлопна система Remus для Mini John Cooper Works F54/F60 (FMK)"
  );
  assert.equal(
    remus("Tailpipe, 84mm, chromed", "Cars / Tailpipes"),
    "Вихлопна система Remus — Tailpipe, 84mm, chromed"
  );
  // Already Ukrainian: unchanged.
  assert.equal(
    buildUaSeoProductName({
      title: "Повітряний фільтр BMC FB620/01 для Honda CR-V III",
      brand: "BMC",
    }),
    "Повітряний фільтр BMC FB620/01 для Honda CR-V III"
  );
  // No Ukrainian product type can be derived: the name stays as it is.
  assert.equal(buildUaSeoProductName({ title: "Bung plugs", brand: "Burger" }), "Bung plugs");
  // Live 2026-10-17: a category path is not a product type.
  assert.equal(
    buildUaSeoProductName({
      title: "GFB, DV+ T9360 suits Ford Focus RS",
      brand: "GFB",
      categoryUa: "Для автомобілів > Ford",
    }),
    "GFB, DV+ T9360 suits Ford Focus RS"
  );
});

test("each locale gets its own product title", () => {
  const product = {
    title: { ua: "Tailpipe, 84mm, chromed", en: "Tailpipe, 84mm, chromed" },
    category: { ua: "Cars / Tailpipes", en: "Cars / Tailpipes" },
    sku: "0006 55SR",
    brand: "Remus",
  };
  assert.equal(
    buildLocalizedProductSeoTitle("ua", product, product.title.ua),
    "Вихлопна система Remus — Tailpipe, 84mm, chromed 0006 55SR"
  );
  assert.equal(
    buildLocalizedProductSeoTitle("en", product, product.title.en),
    "Tailpipe, 84mm, chromed 0006 55SR | Remus"
  );
});
