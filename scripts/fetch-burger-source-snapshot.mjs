// Save a read-only, dated copy of every public Burger Shopify products.json page.
// Run: node scripts/fetch-burger-source-snapshot.mjs [YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pass YYYY-MM-DD");
const outputDir = path.join(process.cwd(), "tmp");
fs.mkdirSync(outputDir, { recursive: true });
const products = [];
let pagesSaved = 0;
for (let page = 1; page <= 20; page += 1) {
  const response = await fetch(`https://burgertuning.com/products.json?limit=250&page=${page}`);
  if (!response.ok) throw new Error(`Burger source page ${page} returned HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.products)) throw new Error(`Burger source page ${page} has no products array`);
  if (!data.products.length) break;
  const file = path.join(outputDir, `burger-products-${date}-page${page}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  pagesSaved += 1;
  products.push(...data.products);
  console.log(`Saved page ${page}: ${data.products.length} products`);
}
if (pagesSaved === 20) throw new Error("Reached 20-page safety limit; confirm the supplier feed's current pagination");
console.log(JSON.stringify({ date, pagesSaved, products: products.length,
  variants: products.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0),
  directory: outputDir }, null, 2));
