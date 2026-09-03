import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { extractSupportedExternalVideos } from "../src/lib/shopProductVideo";

type PublicVariant = {
  id: number;
  title: string;
  sku: string;
  price: string;
  compare_at_price?: string | null;
  available?: boolean;
};

type PublicProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images: Array<{ id: number; src: string; alt?: string | null; position?: number }>;
  options: Array<{ name: string; values: string[] }>;
  variants: PublicVariant[];
};

function duplicateGroups(values: Array<{ key: string; product: string }>) {
  const groups = new Map<string, string[]>();
  for (const row of values) {
    if (!row.key) continue;
    groups.set(row.key, [...(groups.get(row.key) ?? []), row.product]);
  }
  return [...groups.entries()]
    .filter(([, products]) => products.length > 1)
    .map(([key, products]) => ({ key, products }))
    .sort((left, right) => right.products.length - left.products.length || left.key.localeCompare(right.key));
}

async function main() {
  const sourcePath = resolve(process.argv[2] ?? "backups/shopify/fi-exhaust/2026-09-03/products.json");
  const outputPath = resolve(process.argv[3] ?? `${sourcePath}.full-audit.json`);
  const products = JSON.parse(await readFile(sourcePath, "utf8")) as PublicProduct[];
  const variants = products.flatMap((product) =>
    product.variants.map((variant) => ({ ...variant, product: product.title }))
  );
  const videos = products.flatMap((product) =>
    extractSupportedExternalVideos(product.body_html).map((video, index) => ({
      productId: String(product.id),
      handle: product.handle,
      position: index + 1,
      ...video,
    }))
  );
  const nonDefaultOptions = products.flatMap((product) =>
    product.options.filter(
      (option) => option.name !== "Title" || option.values.length !== 1 || option.values[0] !== "Default Title"
    )
  );
  const duplicateSkus = duplicateGroups(
    variants.map((variant) => ({ key: variant.sku.trim().toUpperCase(), product: variant.product }))
  );

  const report = {
    schemaVersion: 1,
    auditedAt: new Date().toISOString(),
    sourcePath,
    counts: {
      products: products.length,
      variants: variants.length,
      productsWithMultipleVariants: products.filter((product) => product.variants.length > 1).length,
      nonDefaultOptions: nonDefaultOptions.length,
      images: products.reduce((sum, product) => sum + product.images.length, 0),
      productsWithoutImages: products.filter((product) => product.images.length === 0).length,
      productsWithoutDescriptions: products.filter((product) => !product.body_html.trim()).length,
      productsWithoutProductType: products.filter((product) => !product.product_type.trim()).length,
      productsWithVideos: new Set(videos.map((video) => video.productId)).size,
      videos: videos.length,
      duplicateSkuGroups: duplicateSkus.length,
    },
    decisions: {
      defaultTitleIsTechnicalPlaceholder: true,
      duplicateSkuProductsRemainSeparate: true,
      descriptionComponentsAreNotShopifyVariants: true,
      sourceCurrency: "UAH",
      publicationMode: "DRAFT_FIRST",
    },
    duplicateSkus,
    videoBindings: videos,
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, ...report.counts, decisions: report.decisions }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
