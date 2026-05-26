import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { b2bOnlyExcludeWhere } from "../src/lib/shopAudience";

const prisma = new PrismaClient();

async function main() {
  console.log("=== DEBUGGING CLOUD DB PRODUCTS ===");

  // 1. Total products in database
  const totalCount = await prisma.shopProduct.count();
  console.log(`Total products in database: ${totalCount}`);

  // 2. Total published products in database
  const publishedCount = await prisma.shopProduct.count({
    where: { isPublished: true },
  });
  console.log(`Total published products (isPublished = true): ${publishedCount}`);

  // 3. Total non-published products
  const unpublishedCount = await prisma.shopProduct.count({
    where: { isPublished: false },
  });
  console.log(`Total unpublished products (isPublished = false): ${unpublishedCount}`);

  // 4. Products matching b2bOnlyExcludeWhere
  const excludedB2bCount = await prisma.shopProduct.count({
    where: { ...b2bOnlyExcludeWhere() },
  });
  console.log(`Products matching NOT audience:b2b: ${excludedB2bCount}`);

  // 5. Combined: isPublished = true AND NOT audience:b2b
  const storefrontCount = await prisma.shopProduct.count({
    where: { isPublished: true, ...b2bOnlyExcludeWhere() },
  });
  console.log(
    `Products visible on storefront (isPublished = true AND NOT audience:b2b): ${storefrontCount}`
  );

  // 6. Let's see counts per brand for visible storefront products
  const storefrontCountsByBrand = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where: { isPublished: true, ...b2bOnlyExcludeWhere() },
    _count: { id: true },
  });
  console.log("Storefront-visible products count grouped by brand:");
  console.log(JSON.stringify(storefrontCountsByBrand, null, 2));

  // 7. Let's see counts per brand for isPublished = false products
  const unpublishedCountsByBrand = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where: { isPublished: false },
    _count: { id: true },
  });
  console.log("Unpublished products count grouped by brand:");
  console.log(JSON.stringify(unpublishedCountsByBrand, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
