import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const matches = await p.shopProduct.findMany({
    where: {
      OR: [
        { slug: { contains: "g63", mode: "insensitive" } },
        { slug: { contains: "w465", mode: "insensitive" } },
        { slug: { contains: "w464", mode: "insensitive" } },
      ],
      brand: { contains: "iPE", mode: "insensitive" },
    },
    select: { slug: true, titleEn: true, priceUsd: true, sku: true, isPublished: true },
  });
  console.log("Matches:", matches.length);
  for (const m of matches) console.log(JSON.stringify(m));
  await p.$disconnect();
})();
