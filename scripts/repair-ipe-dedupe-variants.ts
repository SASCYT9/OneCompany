#!/usr/bin/env tsx
/**
 * Collapses iPE variants that share an identical option-signature
 * (option1+option2+option3) into a single variant. When duplicates exist
 * we keep the variant with the cheapest price (so the listing "from $X"
 * matches the entry-level configuration the customer expects to see).
 *
 * Duplicates arise when past Excel-driven rebuilds mapped multiple Excel
 * rows to the same product handle without disambiguating section labels —
 * e.g., three "Cat Back System" Audi A6 catback SKUs all collapsed to the
 * same axis value, leaving the customer with three visually-identical
 * option buttons.
 *
 * Foreign-key safety: 0 ShopOrderItem/ShopCartItem refs on iPE variants
 * confirmed at Phase 1 audit time; delete is safe.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const p = new PrismaClient();

function sig(o1: string | null, o2: string | null, o3: string | null) {
  return [o1, o2, o3]
    .map((s) => (s ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: { orderBy: [{ position: "asc" }] } },
  });

  let touchedProducts = 0;
  let deletedVariants = 0;
  for (const prod of products) {
    if (prod.variants.length < 2) continue;
    const groups = new Map<string, typeof prod.variants>();
    for (const v of prod.variants) {
      const k = sig(v.option1Value, v.option2Value, v.option3Value);
      const list = groups.get(k) ?? [];
      list.push(v);
      groups.set(k, list);
    }
    let productHadDup = false;
    for (const [k, list] of groups) {
      if (list.length < 2) continue;
      productHadDup = true;
      // Keep cheapest; delete the rest. If priceUsd null, deprioritize.
      const sorted = [...list].sort((a, b) => {
        const aP = a.priceUsd != null ? Number(a.priceUsd) : Number.POSITIVE_INFINITY;
        const bP = b.priceUsd != null ? Number(b.priceUsd) : Number.POSITIVE_INFINITY;
        return aP - bP;
      });
      const keep = sorted[0];
      const drop = sorted.slice(1);
      console.log(
        `[${prod.slug}] sig="${k}" — ${list.length}x → keep id=${keep.id.slice(-8)} sku=${keep.sku} $${keep.priceUsd}; drop ${drop
          .map((v) => `${v.sku ?? "-"}@$${v.priceUsd}`)
          .join(", ")}`
      );
      if (APPLY) {
        for (const v of drop) {
          await p.shopProductVariant.delete({ where: { id: v.id } });
          deletedVariants += 1;
        }
      }
    }
    if (productHadDup) touchedProducts += 1;
  }
  console.log(
    `\nProducts ${APPLY ? "deduped" : "with dupes"}: ${touchedProducts}; variants ${APPLY ? "deleted" : "to delete"}: ${deletedVariants}`
  );
  await p.$disconnect();
})();
