import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const products = await p.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
    AND: [
      {
        OR: [
          { titleEn: { contains: "widestar", mode: "insensitive" } },
          { titleUa: { contains: "widestar", mode: "insensitive" } },
          { sku: { contains: "widestar", mode: "insensitive" } },
        ],
      },
    ],
  },
  select: {
    id: true,
    sku: true,
    slug: true,
    titleEn: true,
    titleUa: true,
    tags: true,
    isPublished: true,
    priceEur: true,
  },
});
console.log(`Widestar matches: ${products.length}\n`);
for (const x of products) {
  console.log(
    `  ${x.isPublished ? "[PUB]" : "[unp]"} ${x.sku}  €${x.priceEur}  | ${(x.titleEn || x.titleUa || "").slice(0, 110)}`
  );
  console.log(`        tags: ${JSON.stringify(x.tags)}`);
}
await p.$disconnect();
