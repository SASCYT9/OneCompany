import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: true, options: true },
  });
  const tipKeywords =
    /tips?|tailpipe|tip\b|carbon fiber|titanium blue|chrome black|chrome silver|satin silver|satin gold|polished silver|mamba/i;

  let withTipAxis = 0;
  let withTipInVariantValue = 0;
  let noTipMentioned = 0;
  const examples: any[] = [];

  for (const prod of products) {
    const optAxisHasTip = prod.options.some((o) => /tip|насад/i.test(o.name));
    const variantValuesHaveTip = prod.variants.some((v) =>
      [v.option1Value, v.option2Value, v.option3Value]
        .filter(Boolean)
        .some((val) => tipKeywords.test(val ?? ""))
    );
    if (optAxisHasTip) withTipAxis += 1;
    else if (variantValuesHaveTip) withTipInVariantValue += 1;
    else noTipMentioned += 1;

    if (examples.length < 15 && !optAxisHasTip && !variantValuesHaveTip) {
      examples.push({
        slug: prod.slug,
        variantCount: prod.variants.length,
        options: prod.options.map((o) => o.name),
      });
    }
  }
  console.log(`Total iPE products: ${products.length}`);
  console.log(`  With dedicated TIP option-axis: ${withTipAxis}`);
  console.log(
    `  With tip keyword in some variant option value (no axis): ${withTipInVariantValue}`
  );
  console.log(`  No tip mentioned at all: ${noTipMentioned}`);
  console.log("\nSample products with NO tip option:");
  for (const e of examples)
    console.log(
      `  ${e.slug.padEnd(60)} variants=${e.variantCount} axes=${e.options.join(",") || "-"}`
    );
  await p.$disconnect();
})();
