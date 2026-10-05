import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { repriceShopSourceMoney, type ShopPriceBookRates } from "../src/lib/shopPriceBookCurrency";
import { shopPriceSourceReadiness } from "../src/lib/shopPriceSourceReadiness.server";
const arg = (key: string) =>
  process.argv.find((x) => x.startsWith(`--${key}=`))?.slice(key.length + 3);
const envPath = arg("env-path");
if (!envPath) throw new Error("Explicit env-path required");
const env = parse(readFileSync(resolve(envPath)));
const directory = resolve(arg("dir") ?? "outputs/price-source-completion-2026-10-05/all-active");
const plan = JSON.parse(readFileSync(resolve(directory, "price-book-plan.json"), "utf8"));
const ratesFile = arg("effective-rates");
const effectiveRates = ratesFile
  ? JSON.parse(readFileSync(resolve(ratesFile), "utf8")).currencyRates
  : null;
const storedPlanOnly = process.argv.includes("--stored-plan-only");
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } });
const bands = [
  ["priceSourceCurrency", "priceEur", "priceUsd", "priceUah"],
  ["compareAtSourceCurrency", "compareAtEur", "compareAtUsd", "compareAtUah"],
  ["b2bPriceSourceCurrency", "priceEurB2b", "priceUsdB2b", "priceUahB2b"],
  ["b2bCompareAtSourceCurrency", "compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
];
async function main() {
  let checkedProducts = 0,
    checkedVariants = 0,
    checkedBands = 0;
  const mismatches: string[] = [];
  let effectiveBandsChecked = 0;
  function check(
    current: Record<string, unknown>,
    expected: { id: string; after: Record<string, unknown> }
  ) {
    for (const [key, value] of Object.entries(expected.after))
      if (
        key.endsWith("Currency") ? current[key] !== value : Number(current[key]) !== Number(value)
      )
        mismatches.push(`${expected.id}/${key}`);
    for (const [source, eur, usd, uah] of bands) {
      if (!expected.after[source]) continue;
      const money = {
        eur: Number(current[eur] ?? 0),
        usd: Number(current[usd] ?? 0),
        uah: Number(current[uah] ?? 0),
        sourceCurrency: current[source] as "EUR" | "USD" | "UAH",
      };
      if (!storedPlanOnly) {
        const expanded = repriceShopSourceMoney(money, plan.nbu.currencyRates as ShopPriceBookRates);
        for (const key of ["eur", "usd", "uah"] as const) {
          const field = { eur, usd, uah }[key];
          if (Math.abs(expanded[key] - Number(expected.after[field])) > 0.000001)
            mismatches.push(`${expected.id}/${source}/${key}`);
        }
      }
      if (effectiveRates) {
        const euroSale = Number(effectiveRates.UAH) / Number(effectiveRates.EUR) + 1;
        const dollarSale = Number(effectiveRates._rawUsdToUah) + 1;
        const currency = money.sourceCurrency;
        const amount = Number(current[{ EUR: eur, USD: usd, UAH: uah }[currency]]);
        const rounded = (n: number) => {
          const cents = n * 100;
          return Math.round(cents + Number.EPSILON * Math.max(1, Math.abs(cents))) / 100;
        };
        const direct = {
          eur: rounded(currency === "EUR" ? amount : amount * (currency === "USD" ? dollarSale : 1) / euroSale),
          usd: rounded(currency === "USD" ? amount : amount * (currency === "EUR" ? euroSale : 1) / dollarSale),
          uah: rounded(currency === "UAH" ? amount : amount * (currency === "EUR" ? euroSale : dollarSale)),
        };
        const effective = repriceShopSourceMoney(money, effectiveRates);
        for (const currency of ["eur", "usd", "uah"] as const)
          if (Math.abs(effective[currency] - direct[currency]) > 0.000001)
            mismatches.push(`${expected.id}/${source}/effective/${currency}`);
        effectiveBandsChecked++;
      }
      checkedBands++;
    }
  }
  for (let offset = 0; offset < plan.changes.length; offset += 500) {
    const entries = plan.changes.slice(offset, offset + 500);
    const rows = await db.shopProduct.findMany({
      where: { id: { in: entries.map((e: any) => e.product.id) } },
      include: { variants: true },
    });
    for (const entry of entries) {
      const row = rows.find((r) => r.id === entry.product.id);
      if (!row) {
        mismatches.push(`${entry.product.id}/missing`);
        continue;
      }
      check(row as unknown as Record<string, unknown>, entry.product);
      checkedProducts++;
      for (const v of entry.variants) {
        const actual = row.variants.find((r) => r.id === v.id);
        if (!actual) {
          mismatches.push(`${v.id}/missing`);
          continue;
        }
        check(actual as unknown as Record<string, unknown>, v);
        checkedVariants++;
      }
    }
  }
  const readiness = await shopPriceSourceReadiness(db);
  const result = {
    verifiedAt: new Date().toISOString(),
    checkedProducts,
    checkedVariants,
    checkedBands,
    effectiveBandsChecked,
    storedPlanOnly,
    mismatchCount: mismatches.length,
    mismatches: mismatches.slice(0, 30),
    readiness,
    nbuDate: plan.nbu.exchangedAt,
    effectivePolicy: effectiveRates ? "Cross from both NBU +1 sale rates; fixed UAH stays fixed" : null,
  };
  writeFileSync(
    resolve(directory, arg("receipt") ?? "verification.json"),
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result));
  if (mismatches.length || !readiness.ready) throw new Error("Price book verification failed");
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
