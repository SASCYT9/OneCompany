import test from "node:test";
import assert from "node:assert/strict";
import { syncShopNbuCurrencyRates } from "../../../src/lib/shopCurrencyNbuSync.server";

test("daily NBU sync skips manual rates before any fetch or transaction", async (t) => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://127.0.0.1/manual-mock";
  const row = {
    key: "shop",
    currencyRates: {
      EUR: 1,
      USD: 1.14,
      UAH: 51.5,
      _rawUsdToUah: 45.5,
      _uahReserve: 0,
      _manualCross: 1,
      _source: "manual",
    },
  };
  const db = {
    shopSettings: {
      findUnique: async () => row,
      upsert: async () => {
        throw Error("Unexpected write");
      },
    },
    $transaction: async () => {
      throw Error("Unexpected transaction");
    },
  };
  t.mock.method(globalThis, "fetch", async () => {
    throw Error("Unexpected NBU request");
  });
  try {
    const result = await syncShopNbuCurrencyRates(db as never);
    assert.equal(result.changed, false);
    assert.equal(result.reason, "manual_rates_active");
    assert.equal(result.nbu, null);
    assert.deepEqual(result.settings.currencyRates, row.currencyRates);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
