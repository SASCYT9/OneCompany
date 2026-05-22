import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const r = await prisma.shopProduct.findFirst({
  where: { sku: "LF-190-CF" },
  select: { slug: true, longDescUa: true, longDescEn: true, updatedAt: true },
});
console.log("slug:", r.slug);
console.log("updatedAt:", r.updatedAt);
console.log("uaLen:", r.longDescUa.length);
console.log("enLen:", r.longDescEn.length);
console.log("uaStart:", r.longDescUa.slice(0, 200));
await prisma.$disconnect();
