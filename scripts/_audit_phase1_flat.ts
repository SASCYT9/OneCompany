import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const PHASE1_HANDLES = [
  "ipe-bmw-m2-g87-exhaust-system",
  "ipe-bmw-m240i-g42-exhaust-system",
  "ipe-bmw-m3-m4-g80-g82-exhaust",
  "ipe-bmw-x3m-x4m-f97-f98-exhaust",
  "ipe-bmw-x5m-x6m-f95-f96-exhaust-system",
  "ipe-ferrari-296-gtb-exhaust-system",
  "ipe-lamborghini-huracan-tecnica-exhaust-system",
  "ipe-mercedes-benz-amg-g63-w465-exhaust-system",
  "ipe-porsche-718-cayman-boxster-2-5t-982-with-718-gt4-bodykit-exhaust-system",
  "ipe-porsche-911-carrera-4-s-4s-992-exhaust",
  "ipe-porsche-911-gt3-992-catback-system",
  "ipe-porsche-911-gt3-gt3-rs-992-full-exhaust-system",
  "ipe-porsche-992-gt3-full-exhaust-system",
  "ipe-subaru-brz-zd8-exhaust-system",
  "ipe-volkswagen-golf-r-mk8-exhaust-system",
  "ipe-volkswagen-golf-r-variant-mk8-exhaust-system",
  "ipe-volkswagen-tiguan-r-exhaust-system",
];

(async () => {
  for (const slug of PHASE1_HANDLES) {
    const r = await p.shopProduct.findFirst({
      where: { slug },
      include: { variants: true },
    });
    if (!r) continue;
    if (r.variants.length < 2) continue;
    const prices = new Set(r.variants.map((v) => v.priceUsd?.toString() ?? "null"));
    const skus = new Set(r.variants.map((v) => v.sku ?? "null"));
    const flag = prices.size === 1 ? " ❌ FLAT" : "";
    const skuFlag = skus.size === 1 && r.variants.length > 1 ? " ⚠ same SKU all variants" : "";
    console.log(
      `${slug.padEnd(70)} ${r.variants.length}v  ${prices.size} unique prices  ${skus.size} unique SKUs${flag}${skuFlag}`
    );
    if (prices.size === 1) {
      console.log(`  all = $${[...prices][0]}  sku=${[...skus][0]}`);
    }
  }
  await p.$disconnect();
})();
