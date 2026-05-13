import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const r = await p.shopProduct.findMany({
    where: {
      slug: {
        in: ["ipe-ferrari-purosangue-titanium-exhaust", "ipe-mercedes-benz-cla35-c118-exhaust"],
      },
    },
    select: { slug: true, isPublished: true, status: true, titleEn: true },
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
})();
