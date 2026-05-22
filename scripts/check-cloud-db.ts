import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const customers = await prisma.shopCustomer.findMany({
      include: {
        account: true,
      },
    });
    console.log("--- DATABASE CUSTOMERS ---");
    console.log(
      JSON.stringify(
        customers.map((c) => ({
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          group: c.group,
          hasAccount: !!c.account,
        })),
        null,
        2
      )
    );
  } catch (err) {
    console.error("Error querying database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
