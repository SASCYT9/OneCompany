/**
 * Retired: this script compounded a 5% increase on the current catalog price.
 * Use apply-eu-prices.ts, which recalculates from do88performance.eu's current
 * Consumer / Incl. VAT source price and applies the documented 10% rule.
 */
console.error(
  "This 5% catalog-price adjustment is retired. Refresh the supplier feed and use scripts/do88/apply-eu-prices.ts instead."
);
process.exitCode = 1;
