import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");
  const c = await prisma.shopCustomer.findUnique({
    where: { email: "b2b@gmail.com" },
    select: { id: true, b2bDiscountPercent: true, group: true },
  });
  console.log(c);
  await prisma.$disconnect();
})();
