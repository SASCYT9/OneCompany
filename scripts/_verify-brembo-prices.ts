import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const updated = await prisma.turn14Item.findMany({
    where: { brand: "Brembo", price: { gt: 0 } },
    select: { id: true, partNumber: true, name: true, price: true },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });
  console.log("Last 10 Brembo with price>0:");
  for (const r of updated) {
    console.log(`  ${r.id}  ${r.partNumber}  $${r.price}  ${r.name.slice(0, 50)}`);
  }
  const totalPriced = await prisma.turn14Item.count({
    where: { brand: "Brembo", price: { gt: 0 } },
  });
  const totalAll = await prisma.turn14Item.count({ where: { brand: "Brembo" } });
  console.log(`\nBrembo total: ${totalAll} | priced: ${totalPriced}`);
}
main()
  .catch(console.error)
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
