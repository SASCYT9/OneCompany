import fs from "node:fs";
const data = JSON.parse(fs.readFileSync(".shop-products-dev-cache.json", "utf8"));
const items = data.products || data;
const item = items.find((p) => p.slug === "do88-lf-190-cf" || p.sku === "LF-190-CF");
if (!item) {
  console.log("not found in cache");
  console.log("keys at root:", Object.keys(data).slice(0, 10));
  console.log("version:", data.version);
  console.log("items length:", items.length);
} else {
  console.log("slug:", item.slug);
  console.log("sku:", item.sku);
  console.log("longDescUa length:", (item.longDescUa || "").length);
  console.log("uaStart:", (item.longDescUa || "").slice(0, 200));
}
