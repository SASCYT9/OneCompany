import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findEmails() {
  try {
    const customers = await prisma.shopCustomer.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { email: true, firstName: true, updatedAt: true },
      take: 15
    });
    console.log('--- RECENT EMAILS IN DB ---');
    customers.forEach(x => console.log(`${x.email} | ${x.firstName} | ${x.updatedAt}`));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

findEmails();
