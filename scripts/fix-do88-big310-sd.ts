import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const slug = "do88-big-310-cr";
  const oldSku = "BIG-310-Cr";
  const newSku = "BIG-310-SD";

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

  const matchingVariants = before.variants.filter((v) => v.sku === oldSku);
  if (matchingVariants.length !== before.variants.filter((v) => v.sku != null).length) {
    console.error(
      "some variants have different SKUs than expected:",
      before.variants.map((v) => v.sku)
    );
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
