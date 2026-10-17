import assert from "node:assert/strict";
import test from "node:test";
import { localizeShopProductTitle } from "../../../src/lib/shopText";

/** A product whose English title in the database is still half Ukrainian. */
function product(slug: string, brand: string, ua: string) {
  return {
    slug,
    brand,
    vendor: brand,
    title: { ua, en: ua.replace(/ для /g, " for ") },
  };
}

test("half-translated GiroDisc and ADRO names get English part names", () => {
  // Live 2026-10-17 /en pages: "Kit Front Halmivnoho Rotora For DODGE Viper".
  const cases: Array<[string, string, string, string]> = [
    [
      "girodisc-a1-006-komplekt-perednoho-halmivnoho-rotora-dlia-dodge-viper-2003",
      "GiroDisc",
      "GIRODISC A1-006 Комплект переднього гальмівного ротора для DODGE Viper 2003-",
      "GIRODISC A1-006 Front Brake Rotor Kit for DODGE Viper 2003-",
    ],
    [
      "girodisc-d1-050-komplekt-zapasnykh-kilets-perednoho-rotora-dlia-lamborghini-huracan-audi-r8",
      "GiroDisc",
      "GIRODISC D1-050 Комплект запасних кілець переднього ротора для LAMBORGHINI Huracan/AUDI R8",
      "GIRODISC D1-050 Front Rotor Replacement Ring Kit for LAMBORGHINI Huracan/AUDI R8",
    ],
    [
      "girodisc-gp50-1666-16-tormozne-kolodky-gp50-racing-dlia-ford-mustang-shelby-gt500-2013-2014",
      "GiroDisc",
      "GIRODISC GP50-1666.16 Тормозные колодки GP50 Racing для FORD Mustang Shelby GT500 2013-2014",
      "GIRODISC GP50-1666.16 Brake Pads GP50 Racing for FORD Mustang Shelby GT500 2013-2014",
    ],
    [
      "girodisc-ccrk2-133-remkomplekt-zadnoho-halmivnoho-suporta-dlia-ferrari-f430",
      "GiroDisc",
      "GIRODISC CCRK2-133 Ремкомплект заднього гальмівного супорта для FERRARI F430",
      "GIRODISC CCRK2-133 Rear Caliper Rebuild Kit for FERRARI F430",
    ],
    [
      "girodisc-a1-260ds-peredni-rotory-z-nasichkamy-ta-perforatsiieiu-dlia-mercedes-g63-w463-2018",
      "GiroDisc",
      "GIRODISC A1-260DS Передні ротори з насічками та перфорацією для MERCEDES G63 (W463) 2018+",
      "GIRODISC A1-260DS Front Rotors Slotted and Drilled for MERCEDES G63 (W463) 2018+",
    ],
    [
      "adro-gryarisadrokit",
      "ADRO",
      "ADRO GRYARISADROKIT Аеродинамічний комплект, карбон для TOYOTA GR Yaris (Gen1/Gen2) 2020+",
      "ADRO GRYARISADROKIT Carbon Aero Kit for TOYOTA GR Yaris (Gen1/Gen2) 2020+",
    ],
  ];
  for (const [slug, brand, ua, expected] of cases) {
    assert.equal(localizeShopProductTitle("en", product(slug, brand, ua)), expected);
  }
});

test("the Ukrainian page keeps its Ukrainian name", () => {
  const item = product(
    "girodisc-a1-006-komplekt-perednoho-halmivnoho-rotora-dlia-dodge-viper-2003",
    "GiroDisc",
    "GIRODISC A1-006 Комплект переднього гальмівного ротора для DODGE Viper 2003-"
  );
  assert.equal(
    localizeShopProductTitle("ua", item),
    "GIRODISC A1-006 Комплект переднього гальмівного ротора для DODGE Viper 2003-"
  );
});
