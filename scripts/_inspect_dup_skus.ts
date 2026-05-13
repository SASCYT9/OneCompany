import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  for (const slug of [
    "ipe-audi-a6-c8-2-0t-45-tfsi-exhaust",
    "ipe-porsche-911-turbo-turbo-s-997-exhaust",
  ]) {
    const r = await p.shopProduct.findFirst({
      where: { slug },
      include: { variants: { orderBy: { position: "asc" } } },
    });
    if (!r) continue;
    console.log(`\n[${slug}]`);
    for (const v of r.variants) {
      console.log(
        `  pos=${v.position}  sku=${v.sku}  $${v.priceUsd}  [${v.option1Value} / ${v.option2Value ?? "-"}]`
      );
    }
  }
  await p.$disconnect();
})();
