import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const slug = "do88-icm-360-cr";
  const oldSku = "ICM-360-Cr";
  const newSku = "ICM-360-SD";

  const before = await p.shopProduct.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      priceEur: true,
      variants: { select: { id: true, sku: true, priceEur: true } },
    },
  });

  console.log("BEFORE:", JSON.stringify(before, null, 2));

  if (!before) {
    console.error("product not found by slug:", slug);
    process.exit(1);
  }
  if (before.sku !== oldSku) {
    console.error(`unexpected current product sku: ${before.sku} (expected ${oldSku})`);
    process.exit(1);
  }

  const [productUpdate, variantUpdate] = await p.$transaction([
    p.shopProduct.update({
      where: { id: before.id },
      data: { sku: newSku },
      select: { slug: true, sku: true },
    }),
    p.shopProductVariant.updateMany({
      where: { productId: before.id, sku: oldSku },
      data: { sku: newSku },
    }),
  ]);

  const after = await p.shopProduct.findUnique({
    where: { id: before.id },
    select: {
      slug: true,
      sku: true,
      variants: { select: { id: true, sku: true } },
    },
  });

  console.log("AFTER:", JSON.stringify(after, null, 2));
  console.log(
    `Updated product ${productUpdate.slug} (sku=${productUpdate.sku}) and ${variantUpdate.count} variant(s).`
  );

  await p.$disconnect();
})();
