import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { prisma } from "../src/lib/prisma";

async function main() {
  const total = await prisma.turn14Item.count();
  const withPrice = await prisma.turn14Item.count({ where: { price: { gt: 0 } } });
  const withZeroPrice = await prisma.turn14Item.count({ where: { price: 0 } });
  console.log(`Turn14 total: ${total}; price>0: ${withPrice}; price=0: ${withZeroPrice}`);

  const samples = await prisma.turn14Item.findMany({
    take: 5,
    orderBy: { id: "asc" },
    select: { id: true, name: true, brand: true, price: true, attributes: true, inStock: true },
  });
  for (const s of samples) {
    const attrs: any = s.attributes ?? {};
    console.log("---");
    console.log({
      brand: s.brand,
      name: (s.name || "").slice(0, 50),
      inStock: s.inStock,
      price_field: s.price,
      attr_retail_price: attrs.retail_price,
      attr_list_price: attrs.list_price,
      attr_jobber_price: attrs.jobber_price,
      attr_map_price: attrs.map_price,
      attr_price: attrs.price,
      attr_keys: Object.keys(attrs).filter((k) => /price|cost/i.test(k)),
    });
  }

  const markups = await prisma.turn14BrandMarkup.findMany({ take: 5 });
  console.log("---\nMarkups (first 5):", markups);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
