import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.shopProduct.findFirst({
  where: { sku: "LF-190-CF" },
  select: {
    slug: true,
    bodyHtmlUa: true,
    bodyHtmlEn: true,
    longDescUa: true,
    longDescEn: true,
    shortDescUa: true,
    shortDescEn: true,
    seoDescriptionUa: true,
  },
});
console.log("slug:", r.slug);
console.log("bodyHtmlUa:", (r.bodyHtmlUa || "").length, "chars");
if (r.bodyHtmlUa) console.log("  body start:", r.bodyHtmlUa.slice(0, 200));
console.log("longDescUa:", (r.longDescUa || "").length, "chars");
console.log("bodyHtmlEn:", (r.bodyHtmlEn || "").length);
console.log("longDescEn:", (r.longDescEn || "").length);
console.log("shortDescUa:", (r.shortDescUa || "").length);
await p.$disconnect();
