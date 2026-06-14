import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import readline from "readline";

// Config
const EXCLUDED_PRODUCT_IDS = [
  "gid://shopify/Product/8691279102123", // 25325081
  "gid://shopify/Product/8691251642539", // 35225081
  "gid://shopify/Product/8691217989803", // 3a725081
];

const DEFAULT_STORE = "dhs4v6-0y.myshopify.com";
const API_VERSION = "2024-04";

process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const isWriteMode = process.argv.includes("--write");
const store =
  process.argv.find((arg) => arg.startsWith("--store="))?.split("=")[1] || DEFAULT_STORE;

async function getAccessToken(storeDomain: string): Promise<string> {
  // 1. Try process.env first
  if (process.env.SHOPIFY_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ACCESS_TOKEN;
  }

  // 2. Query ShopifyStore table in DB
  console.log(`[Auth] Looking up access token for ${storeDomain} in database...`);
  const storeData = await prisma.shopifyStore.findUnique({
    where: { shopDomain: storeDomain },
  });

  if (storeData?.accessToken) {
    console.log(`[Auth] ✅ Found access token in database.`);
    return storeData.accessToken;
  }

  throw new Error(
    `No access token found for ${storeDomain} in DB or Env.\n` +
      `Please install the app on your store first by visiting:\n` +
      `  https://onecompany.global/api/shopify/auth/init?shop=${storeDomain}\n` +
      `(or locally: http://localhost:3000/api/shopify/auth/init?shop=${storeDomain})`
  );
}

async function shopifyFetch(accessToken: string, query: string, variables: any = {}) {
  const url = `https://${store}/admin/api/${API_VERSION}/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": accessToken,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${text}`);
  }

  const result: any = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.data;
}

async function fetchAllVariants(accessToken: string) {
  console.log(`Fetching all products and variants from ${store}...`);
  let hasNextPage = true;
  let cursor = null;
  const allVariants: any[] = [];

  const query = `
    query getProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            priceEur: metafield(namespace: "custom", key: "custom_price_eur") {
              value
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                }
              }
            }
          }
        }
      }
    }
  `;

  let page = 1;
  while (hasNextPage) {
    const data = await shopifyFetch(accessToken, query, { cursor });
    const products = data.products.edges;

    for (const pEdge of products) {
      const product = pEdge.node;
      const isExcluded = EXCLUDED_PRODUCT_IDS.includes(product.id);

      const priceEurMeta = product.priceEur?.value;
      const hasEurPrice = priceEurMeta !== undefined && priceEurMeta !== null;

      for (const vEdge of product.variants.edges) {
        const variant = vEdge.node;
        const currentPrice = parseFloat(variant.price);

        let newPrice;
        let calculationMethod;

        if (hasEurPrice) {
          const eurPrice = parseFloat(priceEurMeta);
          newPrice = Math.floor(eurPrice) * 53;
          calculationMethod = `EUR (${eurPrice}) * 53 = ${newPrice}`;
        } else {
          newPrice = Math.round((currentPrice * 53) / 52);
          calculationMethod = `UAH (${currentPrice}) * 53/52 = ${newPrice}`;
        }

        allVariants.push({
          productId: product.id,
          productTitle: product.title,
          variantId: variant.id,
          variantTitle: variant.title,
          price: currentPrice,
          newPrice,
          calculationMethod,
          sku: variant.sku,
          isExcluded,
        });
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
    console.log(`Page ${page++} fetched. Total variants so far: ${allVariants.length}`);
  }

  return allVariants;
}

async function executeBatchUpdate(accessToken: string, updates: any[]) {
  const batchSize = 30;
  console.log(
    `\nExecuting price updates for ${updates.length} variants in batches of ${batchSize}...`
  );

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    let mutation = "mutation {\n";
    batch.forEach((update, index) => {
      mutation += `
        v${index}: productVariantUpdate(input: { id: "${update.variantId}", price: "${update.newPrice.toFixed(2)}" }) {
          productVariant {
            id
            price
          }
          userErrors {
            field
            message
          }
        }
      `;
    });
    mutation += "\n}";

    console.log(
      `Updating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}...`
    );
    const data = await shopifyFetch(accessToken, mutation);

    batch.forEach((update, index) => {
      const result = data[`v${index}`];
      if (result && result.userErrors && result.userErrors.length > 0) {
        console.error(
          `  Error updating variant ${update.variantId} (${update.productTitle}):`,
          result.userErrors
        );
      }
    });

    await new Promise((res) => setTimeout(res, 1000));
  }
}

async function main() {
  try {
    if (!isWriteMode) {
      console.log("--------------------------------------------------");
      console.log("Running in DRY-RUN mode. No changes will be saved.");
      console.log("To write changes to Shopify, append the --write flag.");
      console.log("--------------------------------------------------\n");
    }

    const accessToken = await getAccessToken(store);
    const variants = await fetchAllVariants(accessToken);
    const updates: any[] = [];

    console.log("\nAnalyzing price changes...");
    for (const v of variants) {
      if (v.isExcluded) {
        console.log(
          `[SKIP] Excluded (Already updated): ${v.productTitle} (${v.variantTitle || "Default"}) - current price: ${v.price} UAH`
        );
        continue;
      }

      if (v.price !== v.newPrice) {
        updates.push(v);
      }
    }

    console.log("\n--- PRICE UPDATE PREVIEW ---");
    updates.forEach((u) => {
      console.log(`${u.productTitle} (${u.variantTitle || "Default"}):`);
      console.log(`  Old Price: ${u.price.toFixed(2)} UAH`);
      console.log(`  New Price: ${u.newPrice.toFixed(2)} UAH (${u.calculationMethod})`);
    });

    console.log(`\nSummary: ${updates.length} of ${variants.length} variants will be updated.`);

    if (isWriteMode) {
      if (updates.length === 0) {
        console.log("\nNo price updates needed.");
        return;
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(
        `\nAre you sure you want to write these ${updates.length} updates to Shopify? (type 'yes' to confirm): `,
        async (answer) => {
          rl.close();
          if (answer.toLowerCase() === "yes") {
            await executeBatchUpdate(accessToken, updates);
            console.log("\nAll price updates completed successfully!");
          } else {
            console.log("\nUpdate cancelled. No changes were made.");
          }
        }
      );
    } else {
      console.log("\nDry-run completed. To apply these changes, run the command with --write.");
    }
  } catch (error: any) {
    console.error("\nAn error occurred:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
