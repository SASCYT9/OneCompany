import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { extractSupportedExternalVideos } from "../src/lib/shopProductVideo";

type ShopifyPublicProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  variants: unknown[];
  options: unknown[];
  images: unknown[];
};

function nextUrl(header: string | null) {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/i);
  return match?.[1] ?? null;
}

async function main() {
  const targetDir = resolve(process.argv[2] ?? "backups/shopify/fi-exhaust/2026-09-03");
  let url: string | null = "https://fiexhaust.shop/products.json?limit=250";
  const products: ShopifyPublicProduct[] = [];
  const vehicleDataUrl =
    "https://cdn.shopify.com/s/files/1/0739/6284/8488/files/vehicle_data.csv?v=1787940761";

  while (url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OneCompany-Catalog-Snapshot/1.0" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Shopify public catalog request failed: ${response.status}`);
    const payload = (await response.json()) as { products?: ShopifyPublicProduct[] };
    products.push(...(payload.products ?? []));
    url = nextUrl(response.headers.get("link"));
  }

  const duplicateIds = products.length - new Set(products.map((product) => product.id)).size;
  const videoProducts = products.filter((product) => extractSupportedExternalVideos(product.body_html).length > 0);
  const vehicleResponse = await fetch(vehicleDataUrl, {
    headers: { Accept: "text/csv", "User-Agent": "OneCompany-Catalog-Snapshot/1.0" },
  });
  if (!vehicleResponse.ok) {
    throw new Error(`Shopify vehicle CSV request failed: ${vehicleResponse.status}`);
  }
  const vehicleCsv = await vehicleResponse.text();
  const vehicleCsvSha256 = createHash("sha256").update(vehicleCsv).digest("hex");
  const vehicleCsvRows = vehicleCsv.split(/\r?\n/u).filter((line) => line.trim()).length - 1;
  const report = {
    source: "https://fiexhaust.shop/products.json",
    fetchedAt: new Date().toISOString(),
    productCount: products.length,
    duplicateIds,
    variantCount: products.reduce((sum, product) => sum + product.variants.length, 0),
    imageCount: products.reduce((sum, product) => sum + product.images.length, 0),
    videoProductCount: videoProducts.length,
    videoCount: videoProducts.reduce(
      (sum, product) => sum + extractSupportedExternalVideos(product.body_html).length,
      0
    ),
    vehicleCsv: {
      source: vehicleDataUrl,
      rows: vehicleCsvRows,
      bytes: Buffer.byteLength(vehicleCsv),
      sha256: vehicleCsvSha256,
    },
  };

  await mkdir(targetDir, { recursive: true });
  await writeFile(resolve(targetDir, "products.json"), `${JSON.stringify(products, null, 2)}\n`, "utf8");
  await writeFile(resolve(targetDir, "vehicle_data.csv"), vehicleCsv, "utf8");
  await writeFile(resolve(targetDir, "audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
