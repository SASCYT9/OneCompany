import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const x = await p.shopProduct.findFirst({
  where: { slug: "brabus-y13-464-bp" },
  select: {
    sku: true,
    slug: true,
    titleEn: true,
    titleUa: true,
    tags: true,
    image: true,
    gallery: true,
    longDescEn: true,
    longDescUa: true,
    shortDescEn: true,
    shortDescUa: true,
    bodyHtmlEn: true,
    bodyHtmlUa: true,
    highlights: true,
    options: { select: { id: true, name: true, values: true } },
    variants: {
      select: {
        id: true,
        title: true,
        sku: true,
        priceEur: true,
        option1Value: true,
        option2Value: true,
        option3Value: true,
      },
    },
    metafields: { select: { namespace: true, key: true, value: true } },
  },
});
console.log(
  JSON.stringify(
    {
      sku: x.sku,
      slug: x.slug,
      titleEn: x.titleEn?.slice(0, 120),
      titleUa: x.titleUa?.slice(0, 120),
      tags: x.tags,
      image: x.image,
      gallery: x.gallery,
      shortDescEn: x.shortDescEn?.slice(0, 200),
      shortDescUa: x.shortDescUa?.slice(0, 200),
      longDescEn: x.longDescEn?.slice(0, 400),
      longDescUa: x.longDescUa?.slice(0, 400),
      bodyHtmlEnLen: x.bodyHtmlEn?.length,
      bodyHtmlUaLen: x.bodyHtmlUa?.length,
      highlights: x.highlights,
      options: x.options,
      variants: x.variants,
      metafields: x.metafields,
    },
    null,
    2
  )
);
await p.$disconnect();
