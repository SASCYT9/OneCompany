import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: true },
    orderBy: { slug: "asc" },
  });

  let dupCount = 0;
  for (const prod of products) {
    if (prod.variants.length < 2) continue;
    const sigCount = new Map<string, number>();
    for (const v of prod.variants) {
      const sig = [v.option1Value, v.option2Value, v.option3Value]
        .map((s) => (s ?? "").trim().toLowerCase())
        .filter(Boolean)
        .join(" | ");
      sigCount.set(sig, (sigCount.get(sig) ?? 0) + 1);
    }
    for (const [sig, count] of sigCount) {
      if (count > 1) {
        dupCount += 1;
        console.log(`[${prod.slug}] DUP signature "${sig}" appears ${count}x`);
      }
    }
  }
  console.log(`\nTotal duplicate-signature variant groups: ${dupCount}`);
  await p.$disconnect();
})();
