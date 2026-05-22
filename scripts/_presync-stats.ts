import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const rows = await prisma.$queryRaw<Array<{ brand: string; total: bigint; priced: bigint }>>`
    SELECT brand, COUNT(*)::bigint AS total,
           SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END)::bigint AS priced
    FROM "Turn14Item"
    GROUP BY brand
    HAVING COUNT(*) > 100
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `;
  console.log("brand                          | total | priced");
  console.log("-".repeat(58));
  for (const x of rows) {
    const t = x.total.toString().padStart(5);
    const p = x.priced.toString().padStart(6);
    console.log(`${x.brand.padEnd(30)} | ${t} | ${p}`);
  }
  const total = await prisma.turn14Item.count();
  const priced = await prisma.turn14Item.count({ where: { price: { gt: 0 } } });
  console.log(`\nTOTAL Turn14 items: ${total} | priced: ${priced} | TODO: ${total - priced}`);
  const minutes = Math.round(((total - priced) * 0.26) / 60);
  console.log(`Estimated time: ${minutes} min (${(minutes / 60).toFixed(1)} hrs) @ ~4 req/s`);
  await prisma.$disconnect();
}
main().catch(console.error);
