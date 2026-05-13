import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: {
      variants: { orderBy: { position: "asc" } },
      options: { orderBy: { position: "asc" } },
    },
    orderBy: { slug: "asc" },
  });
  const dump = products.map((prod) => ({
    slug: prod.slug,
    titleEn: prod.titleEn,
    sku: prod.sku,
    isPublished: prod.isPublished,
    priceUsd: prod.priceUsd ? Number(prod.priceUsd) : null,
    priceUah: prod.priceUah ? Number(prod.priceUah) : null,
    priceEur: prod.priceEur ? Number(prod.priceEur) : null,
    options: prod.options.map((o) => ({ name: o.name, position: o.position, values: o.values })),
    variants: prod.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      position: v.position,
      isDefault: v.isDefault,
      option1Value: v.option1Value,
      option2Value: v.option2Value,
      option3Value: v.option3Value,
      option1LinkedTo: v.option1LinkedTo,
      option2LinkedTo: v.option2LinkedTo,
      option3LinkedTo: v.option3LinkedTo,
      priceUsd: v.priceUsd ? Number(v.priceUsd) : null,
      priceUah: v.priceUah ? Number(v.priceUah) : null,
      priceEur: v.priceEur ? Number(v.priceEur) : null,
      compareAtUsd: v.compareAtUsd ? Number(v.compareAtUsd) : null,
      compareAtUah: v.compareAtUah ? Number(v.compareAtUah) : null,
      compareAtEur: v.compareAtEur ? Number(v.compareAtEur) : null,
      image: v.image,
    })),
  }));
  console.log(
    JSON.stringify(
      { capturedAt: new Date().toISOString(), productCount: dump.length, products: dump },
      null,
      2
    )
  );
  await p.$disconnect();
})();
