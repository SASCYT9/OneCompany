#!/usr/bin/env tsx
/**
 * Renumber variant.position to be contiguous 1..N for any iPE product where
 * a gap exists. Position uniqueness in the Prisma schema is enforced on
 * (productId, position), so we use a two-pass update: shift everything to
 * temporary high positions (10_000+), then assign 1..N in the desired order.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const p = new PrismaClient();

(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: { orderBy: { position: "asc" } } },
  });
  let fixed = 0;
  for (const prod of products) {
    if (prod.variants.length === 0) continue;
    const positions = prod.variants.map((v) => v.position);
    const isContiguous = positions.every((pos, idx) => pos === idx + 1);
    if (isContiguous) continue;
    console.log(
      `[${prod.slug}] positions=[${positions.join(",")}] → renumber to [1..${prod.variants.length}]`
    );
    if (!APPLY) continue;
    // Two-pass to avoid uniqueness violations on (productId, position)
    let temp = 10_000;
    for (const v of prod.variants) {
      await p.shopProductVariant.update({ where: { id: v.id }, data: { position: temp++ } });
    }
    let final = 1;
    for (const v of prod.variants) {
      await p.shopProductVariant.update({ where: { id: v.id }, data: { position: final++ } });
    }
    fixed += 1;
  }
  console.log(`\nProducts ${APPLY ? "fixed" : "would be fixed"}: ${fixed}`);
  await p.$disconnect();
})();
