import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShopSearchText,
  canonicalizeShopSearchQuery,
  getShopSearchQueryVariants,
  hasShopVehicleSearchSignal,
  matchesShopSearchQuery,
  matchesShopSearchToken,
  matchesShopSearchBrandIntent,
  tokenizeShopSearchQuery,
} from "../../../src/lib/shopSearch";

test("equivalent product terms and brand spellings work across UA and EN", () => {
  for (const [text, query] of [
    ["Fi exhaust system Audi RSQ8", "вихлопна система фі RS Q8"],
    ["Карбоновий дифузор Urban Audi RSQ8", "urban carbon diffuser rsq8"],
    ["Eventuri intake BMW M3", "евентурі впуск M 3"],
    ["RaceChip BMW M5", "рейсчіп M5"],
    ["DO88 intercooler BMW", "do 88 інтеркулер bmw"],
    ["Akrapovič BMW M3", "акраповіч M3"],
  ])
    assert.equal(matchesShopSearchQuery(buildShopSearchText([text]), query), true, query);
  assert.equal(matchesShopSearchQuery("alloy wheels", "гальмівні диски"), false);
});

test("catalog brands accept reviewed abbreviations, Cyrillic and spaced spellings", () => {
  for (const [canonical, variants] of [
    ["ADRO M4", ["Адро М4"]],
    ["Burger Motorsports M3", ["BMS M3", "Бургер М3", "Burger Motorsport M3"]],
    ["bootmod3 B58", ["BM3 B58", "boot mod 3 B 58", "бутмод3 B58"]],
    ["DO88 M3", ["до88 М3", "do-88 M 3"]],
    ["KW Suspensions M5", ["КВ М5", "KW Suspension M5"]],
    ["G-Sport by GESi 85600", ["gsport 85600", "GESi 85600", "джі спорт 85600"]],
    ["Ilmberger S1000RR", ["Ільмбергер S1000RR"]],
    ["iPE exhaust RS4", ["айпі RS4"]],
    ["Urban Automotive RSQ8", ["Урбан RSQ8"]],
  ] as const) {
    for (const query of variants) assert.ok(matchesShopSearchQuery(canonical, query), query);
  }
  assert.equal(matchesShopSearchQuery("Akrapovic link pipe Audi RS6", "iPE RS6"), false);
  assert.equal(matchesShopSearchBrandIntent("OHLINS", "BMS M3"), false);
  assert.equal(matchesShopSearchBrandIntent("Burger Motorsports", "BMS M3"), true);
});

test("mixed-script lookalikes and spaced motorcycle codes preserve exact model identity", () => {
  assert.equal(canonicalizeShopSearchQuery("СSF М3"), "csf m3");
  assert.equal(canonicalizeShopSearchQuery("Fi RЅQ8"), "fi rsq8");
  assert.equal(canonicalizeShopSearchQuery("до88 М3"), "do88 m3");
  for (const query of ["S1000RR", "S 1000 RR", "S-1000-RR", "S1000 RR"]) {
    assert.ok(matchesShopSearchQuery("Ilmberger BMW S1000RR", query), query);
    assert.equal(matchesShopSearchQuery("Ilmberger BMW S1000R", query), false, query);
  }
  assert.equal(matchesShopSearchQuery("Ilmberger S1000RR", "S1000R"), false);
});

test("matches chassis codes as exact normalized tokens", () => {
  const f90Text = buildShopSearchText(["BMW M5 (F90)", "Akrapovic Slip-On Line"]);
  const sf90Text = buildShopSearchText(["Ferrari SF90", "GiroDisc rear rotor"]);

  assert.equal(matchesShopSearchQuery(f90Text, "F90"), true);
  assert.equal(matchesShopSearchQuery(sf90Text, "F90"), false);
});

test("matches multi-token vehicle searches across normalized punctuation", () => {
  const searchText = buildShopSearchText([
    "BMS Elite F9x M5/M8 & M550/M850 Intake",
    "F90 BMW M5 JB4",
  ]);

  assert.equal(matchesShopSearchQuery(searchText, "BMW F90"), true);
  assert.equal(matchesShopSearchQuery(searchText, "M5 intake"), true);
  assert.equal(matchesShopSearchQuery(searchText, "G80"), false);
});

test("keeps useful sku fragments while ignoring one-letter separators", () => {
  assert.deepEqual(tokenizeShopSearchQuery("S-BM/T/27H"), ["bm", "27h"]);
});

test("detects vehicle-searchable catalog entries", () => {
  assert.equal(hasShopVehicleSearchSignal(buildShopSearchText(["BMW M5 F90 exhaust"])), true);
  assert.equal(
    hasShopVehicleSearchSignal(buildShopSearchText(["OHLINS 10216-02 dust boot"])),
    false
  );
});

test("canonicalizes common Cyrillic make queries for suggestions and search", () => {
  assert.equal(canonicalizeShopSearchQuery("бмв g20"), "bmw g20");
  assert.equal(canonicalizeShopSearchQuery("Порше 911"), "porsche 911");
  assert.ok(getShopSearchQueryVariants("мерседес g63").includes("mercedes benz g63"));
});

test("recovers conservative brand and catalog-term typos", () => {
  assert.equal(canonicalizeShopSearchQuery("Akrapovik G80"), "akrapovic g80");
  assert.equal(canonicalizeShopSearchQuery("Brabuz G63"), "brabus g63");
  assert.equal(canonicalizeShopSearchQuery("Remuz Golf 8"), "remus golf 8");
  assert.equal(canonicalizeShopSearchQuery("Fi exaust RS Q8"), "fi exhaust rsq8");
  assert.equal(canonicalizeShopSearchQuery("Eventurry RS6"), "eventuri rs6");
});

test("does not typo-correct product index text or structured codes", () => {
  assert.equal(buildShopSearchText(["Custom Remuz component G80"]), "custom remuz component g80");
  assert.equal(canonicalizeShopSearchQuery("BRB1234"), "brb1234");
});

test("Fi and Audi Q-model spellings match in either word order without substring collisions", () => {
  const fi = "Fi EXHAUST Valvetronic Exhaust System for Audi RS Q8 AD-Q8RS-CBOE";
  const urban = "Urban Visual Carbon Fibre diffuser for Audi RSQ8 Facelift fitment";
  const akrapovic = "Akrapovic Evolution exhaust for Audi RSQ8 with carbon fibre tips";
  for (const model of ["RSQ8", "RS Q8", "RS-Q8", "RS Q 8", "RSQ 8"]) {
    for (const brand of [
      "Fi",
      "FI Exhaust",
      "Fi-Exhaust",
      "FiExhaust",
      "Frequency Intelligent Exhaust",
      "фі",
      "фи",
    ]) {
      for (const query of [`${brand} ${model}`, `${model} ${brand}`, `Ауді ${model} ${brand}`]) {
        assert.equal(matchesShopSearchQuery(fi, query), true, query);
        assert.equal(matchesShopSearchQuery(urban, query), false, query);
        assert.equal(matchesShopSearchQuery(akrapovic, query), false, query);
      }
    }
  }
  assert.equal(matchesShopSearchQuery(fi, "exhaust RSQ8 fi"), true);
  assert.equal(matchesShopSearchQuery("FiExhaust Audi RSQ8", "fi exhaust rsq8"), true);
  assert.equal(matchesShopSearchQuery("Frequency Intelligent Exhaust Audi RSQ8", "fi rsq8"), true);
  assert.equal(matchesShopSearchQuery("BootMod3 BMW M3 with Wi-Fi adapter", "fi m3"), false);
  assert.equal(matchesShopSearchToken("bootmod3 bmw m3 wi fi adapter", "fi"), false);
  assert.equal(matchesShopSearchToken("fi exhaust with wi fi controller", "fi"), true);
  assert.equal(matchesShopSearchQuery("BootMod3 Wi-Fi adapter", "wifi adapter"), true);
  assert.equal(matchesShopSearchQuery("BootMod3 WiFi adapter", "wi-fi adapter"), true);
});

test("S Q8 and SQ8 are aliases, while RSQ8 and Q8 remain distinct", () => {
  for (const query of ["S Q8", "SQ8", "S-Q8", "S Q 8"]) {
    assert.equal(matchesShopSearchQuery("Fi Exhaust for Audi SQ8", query), true, query);
    assert.equal(matchesShopSearchQuery("Fi Exhaust for Audi RSQ8", query), false, query);
    assert.equal(matchesShopSearchQuery("Fi Exhaust for Audi Q8", query), false, query);
  }
  assert.equal(matchesShopSearchQuery("Fi Exhaust for Audi RSQ8 and SQ8", "fi S Q8"), true);
  assert.equal(matchesShopSearchQuery("Fi Exhaust for Audi RSQ8 and SQ8", "fi RS Q8"), true);
});

test("Fi BMW model and chassis combinations retain every product word", () => {
  const fi = "Fi EXHAUST Valvetronic Exhaust for BMW M3 / M4 G80 G82";
  const other = "ADRO carbon fibre for BMW M3 G80";
  for (const model of ["M3", "M 3", "M-3", "М3", "М 3"]) {
    for (const query of [
      `Fi ${model}`,
      `${model} FiExhaust`,
      `БМВ ${model} фі`,
      `Fi Exhaust BMW ${model} G 80`,
    ]) {
      assert.equal(matchesShopSearchQuery(fi, query), true, query);
      assert.equal(matchesShopSearchQuery(other, query), false, query);
    }
  }
  assert.equal(matchesShopSearchQuery("Fi exhaust BMW M4 G82", "fi m3"), false);
  assert.equal(matchesShopSearchQuery("Fi exhaust BMW M340i G20", "fi m3"), false);
});
