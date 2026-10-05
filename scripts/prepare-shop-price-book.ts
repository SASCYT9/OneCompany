import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { fetchShopCurrencyRatesFromNbu } from "../src/lib/shopCurrencyNbu";
import { repriceShopSourceMoney, type ShopSourceMoney } from "../src/lib/shopPriceBookCurrency";

// Owner-confirmed source currencies, 05.10.2026. These initialize per-record
// source columns; runtime does not infer currencies from brand names.
const confirmed: Record<string, "EUR" | "USD"> = {
  remus: "EUR",
  "kw suspensions": "EUR",
  "burger motorsports": "USD",
  "ipe exhaust": "USD",
  eventuri: "USD",
  bootmod3: "USD",
  "g-sport by gesi": "USD",
  stopflex: "USD",
  akrapovic: "EUR",
  ohlins: "EUR",
  csf: "EUR",
  adro: "EUR",
  "fi exhaust": "USD",
};
const bands = [
  ["priceSourceCurrency", "priceEur", "priceUsd", "priceUah"],
  ["compareAtSourceCurrency", "compareAtEur", "compareAtUsd", "compareAtUah"],
  ["b2bPriceSourceCurrency", "priceEurB2b", "priceUsdB2b", "priceUahB2b"],
  ["b2bCompareAtSourceCurrency", "compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
] as const;
type Row = {
  id: string;
  sku: string | null;
  brand?: string;
  vendor?: string;
  slug?: string;
  isPublished?: boolean;
  catalogVersion?: string;
  updatedAt: string;
  metafields?: Array<{ namespace: string; key: string; value: string }>;
  variants?: Row[];
} & Record<string, unknown>;
type Change = {
  id: string;
  sku: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  bands: Array<{
    band: string;
    sourceCurrency: string;
    sourceAmount: number;
    reason: string;
    before: ShopSourceMoney;
    after: ShopSourceMoney;
  }>;
};
const argument = (key: string) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
async function main() {
  const directory = resolve(
    argument("dir") ?? "outputs/price-source-completion-2026-10-05/all-active"
  );
  const snapshot = JSON.parse(readFileSync(resolve(directory, "catalog-before.json"), "utf8")) as {
    readAt: string;
    rows: Row[];
  };
  const nbu = argument("rates")
    ? JSON.parse(readFileSync(resolve(argument("rates")!), "utf8"))
    : await fetchShopCurrencyRatesFromNbu();
  const exceptions: Array<{
    id: string;
    sku: string | null;
    band: string;
    reason: string;
    published: boolean;
  }> = [];
  const changes: Array<{
    product: Change;
    variants: Change[];
    published: boolean;
    catalogVersion: string;
    updatedAt: string;
  }> = [];
  const stats: Record<
    string,
    { products: number; bands: number; retailSources: Record<string, number> }
  > = {};
  function priceChange(row: Row, parent: Row): Change {
    const before: Record<string, unknown> = {},
      after: Record<string, unknown> = {};
    const details: Change["bands"] = [];
    const brand = String(parent.brand ?? "")
      .trim()
      .toLowerCase();
    const metas = parent.metafields ?? [];
    const field = (namespace: string, key: string) =>
      metas.find((m) => m.namespace === namespace && m.key === key)?.value;
    const evidencedEur =
      field("custom", "urban_sync_source") === "gp-portal" ||
      Boolean(field("wheelforce_import", "source_price_eur_gross"));
    for (const [code, eur, usd, uah] of bands) {
      const money = {
        eur: Number(row[eur] ?? 0),
        usd: Number(row[usd] ?? 0),
        uah: Number(row[uah] ?? 0),
      };
      const present = (["EUR", "USD", "UAH"] as const).filter(
        (c) => money[c.toLowerCase() as "eur" | "usd" | "uah"] > 0
      );
      if (!present.length) continue; // A variant without an override continues to inherit.
      let currency = row[code] as "EUR" | "USD" | "UAH" | undefined;
      let reason = "persisted_source";
      if (!currency) {
        currency =
          confirmed[brand] ??
          (evidencedEur ? "EUR" : present.length === 1 ? present[0] : undefined);
        reason = confirmed[brand]
          ? "owner_confirmed_currency_2026-10-05"
          : evidencedEur
            ? "supplier_import_metadata"
            : "single_currency_input";
      }
      if (currency === "USD" && !money.usd && brand === "fi exhaust" && money.uah > 0) {
        money.usd = Math.round((money.uah / 46) * 100) / 100;
        reason = "owner_confirmed_Fi_USD_recovery_from_legacy_UAH_divisor_46";
      }
      if (
        currency === "EUR" &&
        !money.eur &&
        ["akrapovic", "ohlins", "csf", "adro"].includes(brand) &&
        money.uah > 0
      ) {
        money.eur = Math.round((money.uah / 52) * 100) / 100;
        reason = "owner_confirmed_Atomic_UAH_divisor_52";
      }
      if (
        currency &&
        !money[currency.toLowerCase() as "eur" | "usd" | "uah"] &&
        row.id !== parent.id
      ) {
        const baseField = ({ EUR: eur, USD: usd, UAH: uah } as const)[currency];
        const mirrorsParent = [eur, usd, uah]
          .filter((key) => Number(row[key]) > 0)
          .every((key) => Math.abs(Number(row[key]) - Number(parent[key])) <= 0.01);
        if (mirrorsParent && Number(parent[baseField]) > 0) {
          money[currency.toLowerCase() as "eur" | "usd" | "uah"] = Number(parent[baseField]);
          reason = "variant_price_matches_parent_confirmed_source";
        }
      }
      if (!currency || !(money[currency.toLowerCase() as "eur" | "usd" | "uah"] > 0)) {
        exceptions.push({
          id: row.id,
          sku: row.sku,
          band: code,
          reason: "source_currency_or_amount_missing",
          published: parent.isPublished === true,
        });
        continue;
      }
      const repriced = repriceShopSourceMoney(
        { ...money, sourceCurrency: currency },
        nbu.currencyRates
      );
      for (const key of [code, eur, usd, uah]) before[key] = row[key] ?? null;
      after[code] = currency;
      after[eur] = repriced.eur;
      after[usd] = repriced.usd;
      after[uah] = repriced.uah;
      details.push({
        band: code,
        sourceCurrency: currency,
        sourceAmount: money[currency.toLowerCase() as "eur" | "usd" | "uah"],
        reason,
        before: {
          eur: Number(row[eur] ?? 0),
          usd: Number(row[usd] ?? 0),
          uah: Number(row[uah] ?? 0),
        },
        after: repriced,
      });
    }
    return { id: row.id, sku: row.sku, before, after, bands: details };
  }
  for (const row of snapshot.rows) {
    const product = priceChange(row, row);
    const variants = (row.variants ?? []).map((v) => priceChange(v, row));
    if (!product.bands.length && !variants.some((v) => v.bands.length)) continue;
    changes.push({
      product,
      variants,
      published: row.isPublished === true,
      catalogVersion: String(row.catalogVersion ?? "0"),
      updatedAt: row.updatedAt,
    });
    const brand = String(row.brand ?? row.vendor ?? "UNKNOWN");
    const stat = (stats[brand] ??= { products: 0, bands: 0, retailSources: {} });
    stat.products++;
    stat.bands += product.bands.length + variants.reduce((n, v) => n + v.bands.length, 0);
    const retail =
      product.bands.find((b) => b.band === "priceSourceCurrency") ??
      variants.flatMap((v) => v.bands).find((b) => b.band === "priceSourceCurrency");
    if (retail)
      stat.retailSources[retail.sourceCurrency] =
        (stat.retailSources[retail.sourceCurrency] ?? 0) + 1;
  }
  const plan = {
    schemaVersion: 1,
    preparedAt: new Date().toISOString(),
    snapshotReadAt: snapshot.readAt,
    mode: "DRY_RUN",
    nbu,
    productsInspected: snapshot.rows.length,
    productsWithPrices: changes.length,
    publishedProducts: changes.filter((c) => c.published).length,
    variants: changes.reduce((n, c) => n + c.variants.length, 0),
    exceptions,
    stats,
    changes,
  };
  mkdirSync(directory, { recursive: true });
  const payload = JSON.stringify(plan, null, 2);
  writeFileSync(resolve(directory, "price-book-plan.json"), payload);
  writeFileSync(
    resolve(directory, "price-book-plan.sha256"),
    createHash("sha256").update(payload).digest("hex") + "\n"
  );
  const escape = (v: unknown) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  writeFileSync(
    resolve(directory, "price-book-review.csv"),
    "product_id,entity_id,sku,band,base,base_amount,old_eur,new_eur,old_usd,new_usd,old_uah,new_uah,evidence\n" +
      changes
        .flatMap((c) =>
          [c.product, ...c.variants].flatMap((row) =>
            row.bands.map((b) =>
              [
                c.product.id,
                row.id,
                row.sku,
                b.band,
                b.sourceCurrency,
                b.sourceAmount,
                b.before.eur,
                b.after.eur,
                b.before.usd,
                b.after.usd,
                b.before.uah,
                b.after.uah,
                b.reason,
              ]
                .map(escape)
                .join(",")
            )
          )
        )
        .join("\n")
  );
  writeFileSync(resolve(directory, "exceptions.json"), JSON.stringify(exceptions, null, 2));
  console.log(
    JSON.stringify(
      {
        inspected: plan.productsInspected,
        priced: plan.productsWithPrices,
        published: plan.publishedProducts,
        exceptions: exceptions.length,
        publishedExceptions: exceptions.filter((e) => e.published).length,
        stats,
      },
      null,
      2
    )
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
