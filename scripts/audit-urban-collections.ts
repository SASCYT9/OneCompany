/**
 * Diagnostic: Audit Urban collection matching.
 * Run with: npx tsx scripts/audit-urban-collections.ts
 */

import { getShopProductsServer } from '../src/lib/shopCatalogServer';
import { getUrbanCatalogProducts } from '../src/lib/urbanCollectionMatcher';
import {
  getProductsForUrbanCollection,
  getUrbanCollectionHandleForProduct,
} from '../src/lib/urbanCollectionMatcher';
import { URBAN_COLLECTION_CARDS } from '../src/app/[locale]/shop/data/urbanCollectionsList';

async function main() {
  const allProducts = await getShopProductsServer();
  const urbanProducts = getUrbanCatalogProducts(allProducts);

  console.log(`\n=== URBAN CATALOG AUDIT ===`);
  console.log(`Total products in shop: ${allProducts.length}`);
  console.log(`Urban products detected: ${urbanProducts.length}\n`);

  // 1. Check each collection — how many products it gets
  console.log(`--- COLLECTION PRODUCT COUNTS ---`);
  const productToCollections = new Map<string, string[]>();

  for (const card of URBAN_COLLECTION_CARDS) {
    const matched = getProductsForUrbanCollection(
      urbanProducts,
      card.collectionHandle,
      card.title,
      card.brand
    );
    console.log(`${card.title.padEnd(30)} (${card.collectionHandle.padEnd(45)}) => ${matched.length} products`);

    for (const p of matched) {
      const existing = productToCollections.get(p.slug) ?? [];
      existing.push(card.collectionHandle);
      productToCollections.set(p.slug, existing);
    }
  }

  // 2. Find duplicates — products appearing in multiple collections
  console.log(`\n--- PRODUCTS IN MULTIPLE COLLECTIONS (DUPLICATES) ---`);
  let dupeCount = 0;
  for (const [slug, handles] of productToCollections) {
    if (handles.length > 1) {
      dupeCount++;
      const product = urbanProducts.find(p => p.slug === slug);
      const titleEn = product?.title?.en ?? slug;
      console.log(`  [${handles.length}x] ${titleEn}`);
      console.log(`        slug: ${slug}`);
      console.log(`        collections: ${handles.join(', ')}`);
      console.log(`        product.collection.en: "${product?.collection?.en ?? ''}"`);
      console.log(`        product.collections: ${JSON.stringify(product?.collections?.map(c => c.handle) ?? [])}`);
    }
  }
  if (dupeCount === 0) {
    console.log('  None found! ✓');
  } else {
    console.log(`\n  Total: ${dupeCount} products appear in multiple collections.`);
  }

  // 3. Find orphans — urban products not matched to any collection
  console.log(`\n--- ORPHAN PRODUCTS (NO COLLECTION MATCH) ---`);
  let orphanCount = 0;
  for (const product of urbanProducts) {
    if (!productToCollections.has(product.slug)) {
      orphanCount++;
      console.log(`  ${product.title.en} (${product.slug})`);
      console.log(`    collection.en: "${product.collection?.en ?? ''}"`);
      console.log(`    collections: ${JSON.stringify(product.collections?.map(c => ({ handle: c.handle, title: c.title.en })) ?? [])}`);
      console.log(`    brand: ${product.brand}, vendor: ${product.vendor}`);
    }
  }
  if (orphanCount === 0) {
    console.log('  None found! ✓');
  } else {
    console.log(`\n  Total: ${orphanCount} products not matched to any collection.`);
  }

  // 4. Check for potential mismatches — product assigned via fuzzy match where title doesn't obviously match
  console.log(`\n--- POTENTIAL MISMATCHES (score < 100) ---`);
  let mismatchCount = 0;
  for (const product of urbanProducts) {
    const handle = getUrbanCollectionHandleForProduct(product);
    if (!handle) continue;
    const card = URBAN_COLLECTION_CARDS.find(c => c.collectionHandle === handle);
    if (!card) continue;
    // Check if the product title or collection name actually contains the vehicle model
    const titleLower = (product.title?.en ?? '').toLowerCase();
    const collLower = (product.collection?.en ?? '').toLowerCase();
    const cardTitleLower = card.title.toLowerCase();
    const brandLower = card.brand.toLowerCase();
    if (
      !titleLower.includes(cardTitleLower.split(' ')[0].toLowerCase()) &&
      !collLower.includes(cardTitleLower.split(' ')[0].toLowerCase()) &&
      !titleLower.includes(brandLower.split(' ')[0].toLowerCase()) &&
      !collLower.includes(brandLower.split(' ')[0].toLowerCase())
    ) {
      mismatchCount++;
      console.log(`  ⚠ "${product.title.en}" => matched to "${card.title}" (${handle})`);
      console.log(`    product.collection.en: "${product.collection?.en ?? ''}"`);
    }
  }
  if (mismatchCount === 0) {
    console.log('  None found! ✓');
  } else {
    console.log(`\n  Total: ${mismatchCount} potential mismatches.`);
  }

  console.log(`\n=== AUDIT COMPLETE ===\n`);
}

main().catch(console.error);
