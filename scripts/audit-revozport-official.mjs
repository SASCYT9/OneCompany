import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const output = ".tmp/revozport-official-audit";
await mkdir(output, { recursive: true });
const products = [];
for (let page = 1; page <= 10; page++) {
  const url = `https://revozport.com/products.json?limit=250&page=${page}`;
  const raw = execFileSync("curl.exe", ["--fail", "--silent", "--show-error", "--max-time", "45", url], {
    encoding: "utf8", maxBuffer: 30 * 1024 * 1024,
  });
  const data = JSON.parse(raw);
  if (!Array.isArray(data.products)) throw new Error(`Invalid products response on page ${page}`);
  products.push(...data.products);
  console.log(`Page ${page}: ${data.products.length} official products`);
  if (data.products.length < 250) break;
  if (page === 10) throw new Error("Pagination limit reached; refusing incomplete audit");
}
const fetchedAt = new Date().toISOString();
await writeFile(`${output}/products.json`, JSON.stringify({ fetchedAt, products }, null, 2));
const source = JSON.parse(await readFile(".tmp/revozport-catalog-preview.json", "utf8"));
const bySku = new Map();
for (const product of products) {
  for (const variant of product.variants ?? []) {
    const sku = String(variant.sku ?? "").trim().toUpperCase();
    if (sku) bySku.set(sku, [...(bySku.get(sku) ?? []), { product, variant }]);
  }
}
const rows = source.products.map((item) => {
  const matches = bySku.get(item.sku) ?? [];
  const match = matches.length === 1 ? matches[0] : null;
  return {
    sku: item.sku,
    sourceStatus: item.status,
    sourcePrice: item.priceUsd,
    sourceSeaQuote: item.source.seaShippingUsd,
    sourceImage: Boolean(item.image),
    sourceWeight: item.weight,
    sourceDimensions: [item.length, item.width, item.height],
    matches: matches.length,
    officialUrl: match ? `https://revozport.com/products/${match.product.handle}` : null,
    officialTitle: match?.product.title ?? null,
    officialVariant: match?.variant.title ?? null,
    officialPrice: match ? Number(match.variant.price) : null,
    officialGrams: match?.variant.grams ?? null,
    imageCount: match?.product.images?.length ?? 0,
    priceDifference: match && item.priceUsd != null ? Number(match.variant.price) - item.priceUsd : null,
  };
});
const counts = {
  officialProducts: products.length,
  workbookSkus: rows.length,
  matchedUnique: rows.filter((r) => r.matches === 1).length,
  ambiguous: rows.filter((r) => r.matches > 1).length,
  unmatched: rows.filter((r) => r.matches === 0).length,
  changedPrices: rows.filter((r) => r.priceDifference != null && r.priceDifference !== 0).length,
  recoverableImages: rows.filter((r) => !r.sourceImage && r.imageCount > 0).length,
  recoverablePrices: rows.filter((r) => !(r.sourcePrice > 0) && r.officialPrice > 0).length,
};
await writeFile(`${output}/audit.json`, JSON.stringify({ fetchedAt, counts, rows }, null, 2));
console.log(JSON.stringify(counts, null, 2));
