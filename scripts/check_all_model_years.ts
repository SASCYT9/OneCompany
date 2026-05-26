import fetch from "node-fetch";

const MODEL_IDS = [
  { id: 377, brand: "BMW", canonicalModel: "S 1000 RR" },
  { id: 1389, brand: "BMW", canonicalModel: "M 1000 RR" },
  { id: 375, brand: "BMW", canonicalModel: "S 1000 R / M 1000 R" },
  { id: 1298, brand: "BMW", canonicalModel: "R 1300 GS / ADVENTURE" },
  { id: 1419, brand: "BMW", canonicalModel: "R 1300 R / RS" },
  { id: 1446, brand: "Ducati", canonicalModel: "Panigale / Streetfighter V2" },
];

async function main() {
  const skuMap = new Map<string, { years: Set<number>; models: Set<string>; productId: number }>();

  for (const model of MODEL_IDS) {
    const url = `https://api2.akrapovic.com/en/products/motorcycle?ModelId=${model.id}`;
    console.log(`Fetching from ${url}...`);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          Origin: "https://www.akrapovic.com",
          Referer: "https://www.akrapovic.com/",
        },
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      if (data.Items) {
        data.Items.forEach((item: any) => {
          const sku = item.Product?.SalesId;
          const productId = item.Product?.ProductId;
          const year = item.ModelYear?.ModelYear ? Number(item.ModelYear.ModelYear) : 0;
          if (!sku || !productId) return;

          if (!skuMap.has(sku)) {
            skuMap.set(sku, { years: new Set(), models: new Set(), productId });
          }
          const entry = skuMap.get(sku)!;
          if (year >= 2019 && year <= 2026) {
            entry.years.add(year);
          }
          entry.models.add(`${model.brand} ${model.canonicalModel}`);
        });
      }
    } catch (e: any) {
      console.error(`Error fetching for model ${model.id}:`, e.message);
    }
  }

  console.log("\n--- AGGREGATED SKUS AND COMPATIBLE YEARS ---");
  for (const [sku, entry] of skuMap.entries()) {
    const yearsArray = Array.from(entry.years).sort((a, b) => a - b);
    console.log(
      `SKU: ${sku} | ProductId: ${entry.productId} | Models: ${Array.from(entry.models).join(", ")} | Years: ${yearsArray.join(", ")}`
    );
  }
}

main().catch(console.error);
