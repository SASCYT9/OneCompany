import fs from 'fs';
import path from 'path';

const UAH_TO_USD_ATOMIC = 45;
const DISCOUNT = 0.9;

const jsonPath = path.join(process.cwd(), 'data', 'girodisc-products.json');
const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let sql = '';

for (const p of products) {
  let slug = p.handle;
  if (!slug.startsWith('girodisc-')) slug = `girodisc-${slug}`;
  slug = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 200);

  let priceUsd = 'NULL';
  let compareAtUsd = 'NULL';

  if (p.priceUah && p.priceUah > 0) {
    priceUsd = ((p.priceUah / UAH_TO_USD_ATOMIC) * DISCOUNT).toFixed(2);
  }
  if (p.compareAtPriceUah && p.compareAtPriceUah > 0) {
    compareAtUsd = ((p.compareAtPriceUah / UAH_TO_USD_ATOMIC) * DISCOUNT).toFixed(2);
  }

  // Escape single quotes just in case
  const safeSlug = slug.replace(/'/g, "''");

  sql += `
UPDATE "ShopProduct"
SET 
  "priceUsd" = ${priceUsd}, "compareAtUsd" = ${compareAtUsd},
  "priceUah" = NULL, "priceEur" = NULL, "compareAtUah" = NULL, "compareAtEur" = NULL
WHERE "slug" = '${safeSlug}';

UPDATE "ShopProductVariant"
SET 
  "priceUsd" = ${priceUsd}, "compareAtUsd" = ${compareAtUsd},
  "priceUah" = NULL, "priceEur" = NULL, "compareAtUah" = NULL, "compareAtEur" = NULL
WHERE "productId" IN (SELECT id FROM "ShopProduct" WHERE "slug" = '${safeSlug}');
`;
}

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'patch-prices.sql'), sql);
console.log('SQL generated!');
