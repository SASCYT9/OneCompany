import test from "node:test";
import assert from "node:assert/strict";
import { repriceShopSourceMoney, shopUahSaleRate } from "../../../src/lib/shopPriceBookCurrency";
import { tagShopMoneySource } from "../../../src/lib/shopPriceBookCurrency";
import { tagShopProductMoneySources } from "../../../src/lib/shopPriceBookCurrency";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { shopDbPriceSource } from "../../../src/lib/shopPriceBookCurrency";
import { managedAdminPriceChange, managedAdminSourceSelection } from "../../../src/lib/shopAdminPriceConversion";
import { wheelForceSetMoney } from "../../../src/lib/wheelforceFamily";

const rates = {
  EUR: 1,
  USD: 50.6975 / 44.8333,
  UAH: 50.6975,
  _rawUsdToUah: 44.8333,
  _uahReserve: 1,
};

test('fallback variants that omit a price retain inheritance instead of crashing the fallback reader',()=>{
  const source={price:{eur:100,usd:0,uah:0},variants:[{id:'inherited',isDefault:true}]} as unknown as ShopProduct;
  const tagged=tagShopProductMoneySources(source);
  assert.equal(tagged.price.sourceCurrency,'EUR');
  assert.equal(tagged.variants![0].price,undefined);
});

test('changing the authoritative currency immediately updates the displayed гривня price and keeps the selected native amount',()=>{
  const selected=managedAdminSourceSelection({priceEur:'100',priceUsd:'113.08',priceUah:'5169.75'},'priceSourceCurrency','USD',rates)!;
  assert.equal(selected.priceSourceCurrency,'USD');assert.equal(selected.priceUsd,'113.08');
  assert.equal(selected.priceUah,'5182.83');
  assert.equal(managedAdminSourceSelection({priceEur:''},'priceSourceCurrency','EUR',rates),null);
});

test('an explicit product currency wins over unrelated variant fallback columns',()=>{
  assert.equal(shopDbPriceSource({priceUsd:100},{priceEur:120,priceSourceCurrency:'EUR'},'price'),'USD');
  assert.equal(shopDbPriceSource({priceEur:100,priceUsd:120},{priceSourceCurrency:'USD'},'price'),undefined);
  const changed=managedAdminPriceChange(100,'USD',rates)!;
  assert.equal(changed.uah,'4583.33');
  assert.equal(changed.sourceCurrency,'USD');
});

test("EUR and USD each receive one hryvnia reserve and the sale cross closes the same UAH conversion paths", () => {
  for (const sourceCurrency of ["EUR", "USD"] as const) {
    const source = {
      eur: sourceCurrency === "EUR" ? 100 : 0,
      usd: sourceCurrency === "USD" ? 100 : 0,
      uah: 0,
      sourceCurrency,
    };
    const result = repriceShopSourceMoney(source, rates);
    assert.equal(result.uah, 100 * ((sourceCurrency === "EUR" ? 50.6975 : 44.8333) + 1));
    assert.ok(Math.abs(result.usd / result.eur - (51.6975 / 45.8333)) < 1e-4);
    assert.ok(Math.abs(result.eur * 51.6975 - result.uah) <= 0.26);
    assert.ok(Math.abs(result.usd * 45.8333 - result.uah) <= 0.24);
    assert.equal(source.uah, 0);
  }
  assert.equal(shopUahSaleRate("EUR", rates), 51.6975);
  assert.equal(shopUahSaleRate("USD", rates), 45.8333);
});

test("only a persisted per-price source can disambiguate converted duplicates", () => {
  const input = { eur: 5728.3, usd: 9000, uah: 303599.98 };
  const result = repriceShopSourceMoney({ ...input, sourceCurrency: "USD" }, rates);
  assert.equal(result.usd, 9000);
  assert.equal(result.uah, 412499.7);
  const euro = repriceShopSourceMoney({ ...input, sourceCurrency: "EUR" }, rates);
  assert.equal(euro.eur, 5728.3);
});

test("Atomic UAH prices imported at 52 UAH per EUR use the derived EUR retail base", () => {
  for (const [brand, eur, uah] of [
    ["AKRAPOVIC", 5.99, 311.64],
    ["OHLINS", 14.38, 747.94],
    ["CSF", 570.2, 29650.5],
    ["ADRO", 2981.25, 155025],
  ] as const) {
    const tagged = tagShopMoneySource({ eur, usd: 0, uah, sourceCurrency: "EUR" });
    assert.equal(tagged.sourceCurrency, "EUR", brand);
    const repriced = repriceShopSourceMoney(tagged, rates);
    assert.equal(repriced.eur, eur, brand);
    assert.equal(
      Math.round(repriced.uah * 100) / 100,
      Math.round(eur * 51.6975 * 100) / 100,
      brand
    );
  }
  assert.equal(
    tagShopMoneySource({ eur: 108.65, usd: 125.18, uah: 5758 }).sourceCurrency,
    undefined
  );
  assert.throws(
    () =>
      repriceShopSourceMoney(
        { eur: 100, usd: 120, uah: 5300 },
        Object.assign({ ...rates }, { _mixedSourceCurrency: 1 })
      ),
    /SOURCE_REQUIRED/
  );
});

test("four-wheel presentation uses the same rounded unit prices as checkout and retains original unit source on a rate refresh", () => {
  const unit = repriceShopSourceMoney({ eur: 37.94, usd: 0, uah: 0 }, rates);
  const set = repriceShopSourceMoney(wheelForceSetMoney(unit), rates);
  assert.equal(set.sourceQuantity, 4);
  assert.equal(set.sourceUnitAmount, 37.94);
  assert.equal(set.usd, (Math.round(unit.usd * 100) / 100) * 4);
  assert.equal(set.uah, (Math.round(unit.uah * 100) / 100) * 4);
  assert.equal(repriceShopSourceMoney(set, rates).uah, set.uah);
});

test("repeated expansion and a daily rate change always use the saved source currency amount", () => {
  let money = { eur: 100, usd: 120, uah: 5300, sourceCurrency: "EUR" as const };
  for (let index = 0; index < 10; index++)
    money = repriceShopSourceMoney(money, rates) as typeof money;
  assert.equal(money.eur, 100);
  assert.equal(money.uah, 5169.75);
  assert.equal(
    repriceShopSourceMoney(money, { ...rates, UAH: 51.2, USD: 51.2 / 45, _rawUsdToUah: 45 }).uah,
    5220
  );
});

test("fixed UAH sources stay fixed and ambiguous multi-currency input cannot silently select a different base", () => {
  const fixed = repriceShopSourceMoney({ eur: 0, usd: 0, uah: 1000 }, rates);
  assert.equal(fixed.uah, 1000);
  assert.ok(Math.abs(fixed.eur * 51.6975 - 1000) <= 0.26);
  assert.ok(Math.abs(fixed.usd * 45.8333 - 1000) <= 0.24);
  assert.throws(
    () => repriceShopSourceMoney({ eur: 100, usd: 120, uah: 5300 }, rates),
    /SOURCE_REQUIRED/
  );
  assert.throws(
    () => repriceShopSourceMoney({ eur: 100, usd: 0, uah: 0 }, { ...rates, _uahReserve: -1 }),
    /INVALID/
  );
});
