import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const customers = await prisma.shopCustomer.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { email: true, firstName: true }
  });
  console.log('--- RECENT TEST CUSTOMERS IN DB ---');
  console.log(customers);
  await prisma.$disconnect();
}
check();
